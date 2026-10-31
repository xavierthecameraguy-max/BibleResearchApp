// Builds the offline Bible commentary the app reads from public/data/commentary/.
//
//   node scripts/data/commentary.mjs                 (re-generates everything)
//   node scripts/data/commentary.mjs --allow-update  (accept newer upstream files)
//   node scripts/data/commentary.mjs --no-repair     (use the SWORD module only)
//   node scripts/data/commentary.mjs --verbose       (print every repair and every
//                                                     reference found in plain text)
//
// SOURCE — Matthew Henry's Concise Commentary on the Whole Bible, the one-volume
// abridgment of Matthew Henry's Exposition of the Old and New Testaments (1706).
// Public domain.
//   SWORD module "MHCC" v2.0 (2021-02-14) from the CrossWire Bible Society, OSIS
//   markup, KJV versification. Its .conf says "DistributionLicense=Public Domain"
//   (and "Public Domain--Copy Freely"); the script checks that line and refuses to
//   continue if it changes. The module's text comes from CCEL (its TextSource is
//   https://ccel.org/ccel/h/henry/mhcc/cache/mhcc.txt).
//   Download: https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/MHCC.zip
//   pinned by SHA-256, so a silent upstream change stops the build.
// REPAIRS — the module lost two sections of CCEL's text when it was converted, both
// whose first verse is also the last of the section before (1 Samuel 25:39-44
// after "Verses 32-39", Psalm 95:7-11 after "Verses 1-7"). They are filled in from
// the CCEL plain-text edition the module was made from ("Rights: Public Domain"),
// also pinned by SHA-256; --no-repair leaves them out. Each chapter's text was
// checked against that edition: every chapter agrees to within a dozen words.
//
// WHAT IT DOES
// Reads the SWORD zCom files directly (.bzs block index, .bzv verse index, .bzz
// zlib blocks). In a SWORD commentary a passage's note is stored once and every
// verse it covers points at the same bytes, so consecutive verses sharing an entry
// make up one section. Each entry is split on its structural markup: the book
// title and introduction (<title type="x-ms">), the chapter heading
// (<title type="x-s2">), the "Chapter Outline" (tables or inline "Title. (1-8)"
// lists), and the "Verses 1-8" headings (<hi type="bold">) that start each
// section. Chapters treated as a whole ("Esau and his descendants. --The
// registers...") become one section titled with that summary.
// Section ranges come from the headings, checked against the outline and the
// module's own verse linking: when a heading is narrower than the outline item
// it starts (John 3 "Verses 1-8" whose text and outline cover 1-21), and the
// extra verses have no note of their own, the section is widened to match.
// "Verses 24-30, 36-43" (whose second half the module left in the text) gives a
// section with two ranges. Chapter-wide notes with no verse marker sit in the
// chapter-heading entry (Leviticus 19, Psalm 108), as do the introductions of the
// one-chapter books; both are read from there. A trailing "(Rev 14:6-13)" that
// only points at the next section is removed.
// Markup is stripped to plain text with paragraph breaks ("\n\n"); "--" becomes
// an em dash. Scripture references become structured passages via the app's own
// parseReference(): the module's <reference osisRef> tags (short follow-on labels
// such as the "14" in "He 2:11, 14" are re-read from the text, because their
// osisRef is often wrong, and a "2." that only numbers a point is dropped) and,
// conservatively, plain-text ones: "Lu 16:25", "II Kin. 18:17-37", "ch. 17:17"
// (this book), "ver. 18" (this chapter) and bare "22:2" after a reference. Every
// reference is checked against the KJV's real chapter and verse counts.
//
// OUTPUT (compact JSON; book ids are USFM codes like GEN, JHN, 1CO)
//   <BOOK>.json  {
//     "b": "GEN",
//     "intro"?: "...",  "introRefs"?: [ref],      Henry's introduction to the book
//     "c": [ chapter 1, chapter 2, ... ]            (index = chapter - 1)
//   }
//   chapter = {
//     "intro"?: "...", "introRefs"?: [ref],        prose before the first section (rare)
//     "outline"?: [{"t": "God creates heaven and earth.", "r": [[1,2]]}],
//     "sections": [{
//       "from": 1, "to": 2,                         verses covered
//       "also"?: [[36,43]],                         further verses covered
//       "title"?: "God creates heaven and earth.",  from the outline / chapter summary
//       "text": "The first verse of the Bible...",  plain text, "\n\n" between paragraphs
//       "refs": [ref]                               references written in the text
//       "src"?: "ccel"                              filled in from the CCEL edition
//     }]
//   }
//   ref = {book, startChapter, startVerse?, endChapter, endVerse?, at, len}
//         where text.slice(at, at + len) is the reference as written.
//   meta.json  title, author, licence, credit, module version, counts, repairs.

import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { inflateSync } from 'node:zlib'
import { unzipSync, strFromU8 } from 'fflate'
import { findBook, allBookNames, BOOKS } from '../../src/lib/books.ts'
import { parseReference } from '../../src/lib/references.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(root, 'public', 'data', 'commentary')
const ALLOW_UPDATE = process.argv.includes('--allow-update')
const VERBOSE = process.argv.includes('--verbose')
const REPAIR = !process.argv.includes('--no-repair')

const MODULE = {
  name: 'MHCC',
  version: '2.0',
  url: 'https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/MHCC.zip',
  sha256: 'aae5a57fa697b090b0195c0ec4a5c4cfad2a44c1af115438ca5d902ae1c2e0bb',
}
const CCEL = {
  url: 'https://ccel.org/ccel/h/henry/mhcc/cache/mhcc.txt',
  sha256: '7af7f0feef2a8522263d48825a170125f4c421d14250212d83db6aef6d4f5269',
}
const TITLE = "Matthew Henry's Concise Commentary on the Whole Bible"
const CREDIT =
  "Matthew Henry's Concise Commentary on the Whole Bible, the one-volume abridgment of Matthew Henry's Exposition of the Old and New Testaments (1706). Public domain. " +
  'Text from the CrossWire Bible Society SWORD module "MHCC" (from CCEL), with a few passages the module lost restored from ' +
  "CCEL's edition. Changes: markup removed, scripture references linked."

// ---- Small helpers ------------------------------------------------------------

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
    return ENTITIES[e.toLowerCase()] ?? m
  })
}

function attr(tag, name) {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`))
  return m ? decodeEntities(m[1]) : null
}

function parseConf(text) {
  const conf = {}
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_0-9]+)=(.*)$/)
    if (m && !(m[1] in conf)) conf[m[1]] = m[2].trim()
  }
  return conf
}

const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0
const u16 = (b, o) => b[o] | (b[o + 1] << 8)

async function download(url, sha256, what) {
  console.log(`Downloading ${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not download ${url}: ${res.status}`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  const hash = createHash('sha256').update(bytes).digest('hex')
  if (hash !== sha256) {
    const msg = `${what} has changed upstream (sha256 ${hash}). Check its licence and re-run with --allow-update.`
    if (!ALLOW_UPDATE) throw new Error(msg)
    console.warn('  ' + msg)
  }
  return bytes
}

// ---- Versification (KJV, as SWORD lays it out) ------------------------------------

// Verse counts per chapter, from the app's KJV text. They are checked against the
// module's own index sizes below, so a mismatch can't shift every note.
const VERSE_COUNTS = new Map()
{
  const dir = join(root, 'public', 'bible', 'kjv')
  for (const b of BOOKS) {
    const f = join(dir, `${b.id}.json`)
    if (!existsSync(f)) throw new Error(`KJV text not found at ${f} — it is needed for verse counts`)
    const book = JSON.parse(readFileSync(f, 'utf8'))
    VERSE_COUNTS.set(b.id, book.chapters.map((ch) => ch.reduce((m, v) => Math.max(m, v.v), 0)))
  }
}
const versesIn = (book, chapter) => VERSE_COUNTS.get(book)?.[chapter - 1] ?? 0

/**
 * Index of every book / chapter / verse in a SWORD testament file: entry 0 is the
 * module heading, 1 the testament heading, then per book one entry for the book
 * introduction and per chapter one for the chapter heading followed by its verses.
 */
function layout(testamentBooks) {
  const map = new Map()
  let i = 2
  for (const b of testamentBooks) {
    const entry = { book: i++, chapters: [] }
    for (const n of VERSE_COUNTS.get(b.id)) {
      entry.chapters.push(i)
      i += 1 + n
    }
    map.set(b.id, entry)
  }
  return { map, size: i }
}

// ---- Reading the SWORD zCom module ------------------------------------------------

function readZCom(files, conf) {
  const base = conf.DataPath.replace(/^\.\//, '').replace(/\/?$/, '/')
  const get = (name) => {
    const f = files[base + name]
    if (!f) throw new Error(`Module file ${base + name} is missing`)
    return f
  }
  const decoder = new TextDecoder('utf-8')
  const out = {}
  for (const t of ['ot', 'nt']) {
    const bzs = get(`${t}.bzs`)
    const bzv = get(`${t}.bzv`)
    const bzz = get(`${t}.bzz`)
    const blocks = new Map()
    const block = (n) => {
      if (!blocks.has(n)) {
        const off = u32(bzs, n * 12)
        blocks.set(n, inflateSync(bzz.subarray(off, off + u32(bzs, n * 12 + 4))))
      }
      return blocks.get(n)
    }
    const count = bzv.length / 10
    out[t] = {
      count,
      /** {key, text} of index entry i; key is the same for verses sharing one note */
      entry(i) {
        const o = i * 10
        const b = u32(bzv, o)
        const off = u32(bzv, o + 4)
        const size = u16(bzv, o + 8)
        if (!size) return { key: null, text: '' }
        return { key: `${b}:${off}:${size}`, text: decoder.decode(block(b).subarray(off, off + size)) }
      },
    }
  }
  return out
}

async function loadModule() {
  const bytes = await download(MODULE.url, MODULE.sha256, `${MODULE.name}.zip`)
  const files = unzipSync(bytes)
  const confName = Object.keys(files).find((n) => /^mods\.d\/.+\.conf$/i.test(n))
  if (!confName) throw new Error(`${MODULE.name}: no .conf file in the zip`)
  const conf = parseConf(strFromU8(files[confName]))
  if (conf.DistributionLicense !== 'Public Domain') {
    throw new Error(`${MODULE.name}: licence is "${conf.DistributionLicense}", expected "Public Domain"`)
  }
  if (conf.Version !== MODULE.version) {
    const msg = `${MODULE.name}: module version is ${conf.Version}, expected ${MODULE.version}`
    if (!ALLOW_UPDATE) throw new Error(msg)
    console.warn('  ' + msg)
  }
  if (conf.ModDrv?.toLowerCase() !== 'zcom' || conf.Versification !== 'KJV') {
    throw new Error(`${MODULE.name}: expected a zCom module with KJV versification, got ${conf.ModDrv} / ${conf.Versification}`)
  }
  return { conf, data: readZCom(files, conf) }
}

// ---- References -------------------------------------------------------------------

const stats = {
  dropped: 0,
  tagged: 0,
  taggedReread: 0,
  taggedChanged: 0,
  numberedPoints: 0,
  pointers: 0,
  plain: 0,
  widened: 0,
  linkedWidened: 0,
  alsoRanges: 0,
  uncovered: [],
  repairs: [],
  warnings: [],
}
let current = '' // chapter being converted, for messages
const warn = (msg) => {
  stats.warnings.push(`${current}: ${msg}`)
  if (VERBOSE) console.log(`    ${current}: ${msg}`)
}

/** Turns parsed numbers into a checked Passage via the app's parseReference. */
function makePassage(bookId, it) {
  const book = findBook(bookId)
  if (!book) return null
  if (book.chapters > 1 && (it.c1 > book.chapters || it.c2 > book.chapters)) return it.alt ? makePassage(bookId, it.alt) : dropped(`${book.id} ${it.c1}-${it.c2}`)
  let s = `${book.id} ${it.c1}`
  if (it.v1 !== undefined) {
    s += `:${it.v1}`
    if (it.c2 !== it.c1) s += `-${it.c2}:${it.v2 ?? 999}`
    else if (it.v2 !== undefined && it.v2 !== it.v1) s += `-${it.v2}`
  } else if (it.c2 !== it.c1) {
    s += `-${it.c2}`
  }
  const p = parseReference(s)
  if (!p || p.book !== book.id) return dropped(s)
  const counts = VERSE_COUNTS.get(p.book)
  if (p.startChapter > counts.length || p.endChapter > counts.length) return dropped(s)
  if (p.startVerse !== undefined) {
    if (p.startVerse < 1 || p.startVerse > counts[p.startChapter - 1]) return it.alt ? makePassage(bookId, it.alt) : dropped(s)
    if (p.endVerse !== undefined) p.endVerse = Math.min(p.endVerse, counts[p.endChapter - 1])
  }
  const out = { book: p.book, startChapter: p.startChapter }
  if (p.startVerse !== undefined) out.startVerse = p.startVerse
  out.endChapter = p.endChapter
  if (p.endVerse !== undefined) out.endVerse = p.endVerse
  return out
}
function dropped(what) {
  stats.dropped++
  if (VERBOSE) console.log(`    ${current}: dropped impossible reference ${what}`)
  return null
}

/**
 * Reads a list of chapter/verse numbers such as "12:1-3, 5; 13:2" or "57; 60"
 * starting at s[i]. A bare number after a comma is a verse when the previous item
 * had a verse, otherwise a chapter. Stops before "2 Kings" or "1Ch".
 * `ctx` continues a list begun earlier: the previous item's chapter, whether it
 * had a verse, and the separator ("," or ";") written before s[i].
 * (Same reading rules as scripts/data/dictionary.mjs.)
 */
const ITEM = /(\d{1,3})(?:(?::\s?|\.(?=\d))(\d{1,3}))?(?:\s?[-–—]\s?(\d{1,3})(?:(?::|\.(?=\d))(\d{1,3}))?)?(?![\d:A-Za-z])/y
const SEP = /\s?([,;])\s?/y
function parseNumberList(s, i, ctx) {
  const items = []
  let pos = i
  let sep = ctx?.sep ?? null
  const before = ctx ? { c2: ctx.chapter, v1: ctx.verse ? 1 : undefined } : undefined
  for (;;) {
    let start = pos
    if (items.length) {
      SEP.lastIndex = pos
      const m = SEP.exec(s)
      if (!m) break
      sep = m[1]
      start = SEP.lastIndex
      if (/^(?:[123]|I{1,3})\s?[A-Z]/.test(s.slice(start, start + 4))) break
    }
    ITEM.lastIndex = start
    const m = ITEM.exec(s)
    if (!m) break
    // "3. She did eat" numbers a point; it is not a verse.
    if (items.length && /^\.\s[A-Z]/.test(s.slice(ITEM.lastIndex, ITEM.lastIndex + 3)) && !m[2] && !m[3]) break
    const [, a, b, x, y] = m
    const prev = items[items.length - 1] ?? before
    let it
    if (b) it = { c1: +a, v1: +b, c2: y ? +x : +a, v2: y ? +y : x ? +x : +b }
    else if (prev && sep === ',' && prev.v1 !== undefined) it = { c1: prev.c2, v1: +a, c2: y ? +x : prev.c2, v2: y ? +y : x ? +x : +a }
    else {
      it = { c1: +a, c2: x ? +x : +a }
      // "25:8-16; 23-35": if 23-35 can't be chapters, it's verses of chapter 25.
      if (prev && prev.v1 !== undefined && !y) it.alt = { c1: prev.c2, v1: +a, c2: prev.c2, v2: x ? +x : +a }
    }
    it.start = start
    it.end = ITEM.lastIndex
    items.push(it)
    pos = ITEM.lastIndex
  }
  return items
}

// Book abbreviations in the module's text (Online Bible style: "Lu 16:25",
// "Joh 6:48", "1Jo 5:20", "So 2:4") and older forms ("II Kin. 18:17", "Jr 39:1")
// that findBook() reads differently or doesn't know.
const EXTRA_NAMES = {
  de: 'DEU', jud: 'JDG', so: 'SNG', joe: 'JOL', lu: 'LUK', joh: 'JHN', '1jo': '1JN', '2jo': '2JN', '3jo': '3JN', jude: 'JUD',
  he: 'HEB', psa: 'PSA', jr: 'JER', kin: null, '1kin': '1KI', '2kin': '2KI', '1sam': '1SA', '2sam': '2SA', cant: 'SNG',
  numb: 'NUM', isai: 'ISA', jere: 'JER', matth: 'MAT', jno: 'JHN', '1pet': '1PE', '2pet': '2PE', '1tim': '1TI', '2tim': '2TI',
  '1thes': '1TH', '2thes': '2TH', '1chron': '1CH', '2chron': '2CH', heb: 'HEB', rev: 'REV', revel: 'REV',
}
const ROMAN = { i: '1', ii: '2', iii: '3' }
/** "II Kin." → "2KI", "Lu" → "LUK", "Is." → "ISA"; null when it isn't a book. */
function textBookId(name) {
  let k = name.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim()
  k = k.replace(/^(iii|ii|i) /, (m, r) => ROMAN[r] + ' ')
  const tight = k.replace(/^(\d) /, '$1')
  if (tight in EXTRA_NAMES) return EXTRA_NAMES[tight]
  return findBook(k)?.id ?? null
}

const BASE_NAMES = new Set()
for (const n of [...allBookNames(), ...BOOKS.flatMap((b) => b.aliases), ...Object.keys(EXTRA_NAMES)]) {
  BASE_NAMES.add(n.replace(/^\d\s?/, ''))
}
const NAME_ALT = [...BASE_NAMES]
  .filter((n) => n.length >= 2)
  .sort((a, b) => b.length - a.length)
  .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s'))
  .join('|')
// "ch." / "chap." (this book) or "ver." (this chapter) then a number; a book name
// (optionally "1", "2 ", "II ") then a number; or a bare "chapter:verse". The
// keywords come first so "ch. 17:17" isn't read as an unknown book "ch".
const TEXT_REF = new RegExp(
  `(?<![A-Za-z])(ch|chap|chapter)\\.?\\s(?=\\d)` +
    `|(?<![A-Za-z])(ver|vers|verse|verses|vs)\\.?\\s?(\\(?)(?=\\d)` +
    `|(?<![A-Za-z])((?:[123]|III|II|I)\\s?)?(${NAME_ALT})(\\.?)\\s?(?=\\d)` +
    `|(?<![\\w:.,\\-\\u0001])(?=\\d{1,3}:\\d{1,3}(?![\\d:]))`,
  'gi',
)
// Names that also work as ordinary words or personal names: they only count as a
// book when a "chapter:verse" follows ("John 4:14"), never with a chapter alone.
const NEEDS_VERSE = new Set([
  'job', 'mark', 'acts', 'john', 'james', 'jude', 'amos', 'ruth', 'joel', 'jonah', 'ezra', 'esther', 'titus', 'daniel',
  'hosea', 'micah', 'nahum', 'peter', 'timothy', 'samuel', 'kings', 'song', 'is', 'am', 'so', 'ex', 'da', 'na', 'ho', 'ob',
  're', 'ac', 'ro', 'ga', 'col', 'he', 'numbers', 'judges', 'luke', 'matthew', 'genesis', 'isaiah', 'jeremiah', 'ezekiel',
  'malachi', 'haggai', 'joshua', 'philemon', 'lamentations', 'revelation', 'revelations', 'chronicles', 'proverbs', 'ezek',
  'jon', 'mal', 'hag', 'nah', 'joe', 'lu', 'de', 'jud', 'le', 'la', 'ge', 'es', 'ne', 'mic', 'eph', 'tit', 'phil', 'gal',
])

/** Passages for the number items, each with the span of text it covers. */
function itemsToRefs(bookId, items, spanStart) {
  const out = []
  items.forEach((it, i) => {
    const p = makePassage(bookId, it)
    if (!p) return
    const start = i === 0 ? spanStart : it.start
    out.push({ ...p, at: start, len: it.end - start })
  })
  return out
}

function osisToPassage(osis) {
  const m = osis.replace(/^Bible:/, '').match(/^([1-4]?[A-Za-z]+)\.(\d+)(?:\.(\d+))?(?:-(?:([1-4]?[A-Za-z]+)\.)?(\d+)(?:\.(\d+))?)?$/)
  if (!m) return null
  const [, bk, c, v, bk2, c2, v2] = m
  const book = findBook(bk)
  if (!book || (bk2 && findBook(bk2)?.id !== book.id)) return null
  if (book.chapters === 1 && !v && !c2) return { book: book.id, startChapter: 1, endChapter: 1 }
  const it = { c1: +c, c2: +c }
  if (v) it.v1 = it.v2 = +v
  if (c2) {
    if (v2) {
      it.c2 = +c2
      it.v2 = +v2
    } else if (v && !bk2) {
      it.v2 = +c2
    } else {
      it.c2 = +c2
      if (v) it.v2 = undefined
    }
  }
  return makePassage(book.id, it)
}

const LABEL_BOOK = /^((?:(?:[123]|III|II|I)\s?)?[A-Za-z]+\.?)\s?(?=\d)/

/**
 * The module's <reference> tags. A label that names its book ("Lu 17:26") is
 * read from the label (the osisRef agrees in all but a few cases). A follow-on
 * label ("27" in "Lu 17:26, 27", "106:9" in "Ps 114:3; 106:9") continues the
 * reference before it — the module's osisRef is often wrong there ("He 2:11, 14"
 * was tagged 2 Cor 2:14). A lone "2" between full stops numbers a point.
 */
function taggedRefs(text, tags) {
  const out = []
  let prev = null
  for (const r of tags) {
    const label = text.slice(r.at, r.at + r.len)
    const fromOsis = r.osis ? osisToPassage(r.osis) : null
    let found = []
    const bm = label.match(LABEL_BOOK)
    const bookId = bm ? textBookId(bm[1]) : null
    if (bookId) {
      found = itemsToRefs(bookId, parseNumberList(label, bm[0].length), 0)
      if (!found.length && fromOsis?.book === bookId) found = [{ ...fromOsis, at: 0, len: r.len }]
    } else if (/^\d/.test(label)) {
      const before = text.slice(0, r.at).trimEnd()
      const sepChar = before.slice(-1)
      const after = text.slice(r.at + r.len, r.at + r.len + 3)
      if (/^\d+$/.test(label) && (sepChar === '.' || (sepChar === '' && /^\.(\s|$)/.test(after)))) {
        stats.numberedPoints++
        if (VERBOSE) console.log(`    ${current}: "${label}." numbers a point (tag said ${r.osis})`)
        continue
      }
      if (prev) {
        const ctx = { chapter: prev.endChapter, verse: prev.startVerse !== undefined, sep: sepChar === ';' ? ';' : ',' }
        found = itemsToRefs(prev.book, parseNumberList(label, 0, ctx), 0)
        stats.taggedReread++
        const a = found[0]
        if (a && !(fromOsis && fromOsis.book === a.book && fromOsis.startChapter === a.startChapter && (fromOsis.startVerse ?? 0) === (a.startVerse ?? 0))) {
          stats.taggedChanged++
          if (VERBOSE) console.log(`    ${current}: follow-on "${label}" after ${prev.book} ${prev.startChapter}:${prev.startVerse ?? ''} → ${a.book} ${a.startChapter}:${a.startVerse ?? ''} (tag said ${r.osis})`)
        }
      } else if (fromOsis) {
        found = [{ ...fromOsis, at: 0, len: r.len }]
      }
    } else if (fromOsis) {
      found = [{ ...fromOsis, at: 0, len: r.len }]
    }
    if (!found.length) continue
    // Spans are relative to the label; the last one runs to the label's end.
    found = found.map((f, i) => ({ ...f, at: r.at + f.at, len: i === found.length - 1 ? r.at + r.len - (r.at + f.at) : f.len }))
    out.push(...found)
    prev = found[found.length - 1]
  }
  stats.tagged += out.length
  return out
}

/** References written as plain text, outside the tagged ones. */
function plainRefs(text, tagged, here) {
  const sorted = [...tagged].sort((a, b) => a.at - b.at)
  const chars = text.split('')
  for (const r of sorted) chars.fill('\u0001', r.at, r.at + r.len)
  const masked = chars.join('')
  const found = []
  let ti = 0
  let context = null
  TEXT_REF.lastIndex = 0
  let m
  while ((m = TEXT_REF.exec(masked))) {
    while (ti < sorted.length && sorted[ti].at < m.index) context = sorted[ti++]
    const numbersAt = m.index + m[0].length
    let bookId = null
    let ctx
    let verseRequired = false
    let paren = false
    if (m[1]) {
      // "ch. 17:17" is this book, but "Jeremiah chap. 40" is Jeremiah's.
      const named = masked.slice(Math.max(0, m.index - 24), m.index).match(/(?<![A-Za-z])((?:[123]\s?)?[A-Z][a-z]+)\.?,?\s$/)
      bookId = (named && textBookId(named[1])) || here.book
    } else if (m[2]) {
      bookId = here.book
      ctx = { chapter: here.chapter, verse: true, sep: ',' }
      paren = !!m[3]
    } else if (m[5]) {
      // A book name: it must look like a proper name ("Lu", "2Sa", "II Kin.").
      const prefix = m[4] ?? ''
      if (!/^[A-Z]/.test(m[5]) || (/^I/.test(prefix) && !/\s$/.test(prefix))) {
        TEXT_REF.lastIndex = m.index + 1
        continue
      }
      bookId = textBookId(prefix + m[5])
      const lower = m[5].toLowerCase()
      verseRequired = !prefix && ((!m[6] && NEEDS_VERSE.has(lower)) || (lower.length <= 2 && lower !== 'ps'))
    } else {
      // A bare "22:2" continues the last reference's book, or means this book.
      bookId = context?.book ?? here.book
    }
    const items = bookId ? parseNumberList(masked, numbersAt, ctx) : []
    if (!items.length || (verseRequired && items[0].v1 === undefined)) {
      TEXT_REF.lastIndex = m.index + 1
      continue
    }
    const refs = itemsToRefs(bookId, items, m.index)
    if (VERBOSE && refs.length < items.length) console.log(`    ${current}: dropped part of …${masked.slice(Math.max(0, m.index - 30), items[items.length - 1].end + 5).replace(/\n/g, ' ')}…`)
    // "ver. (18)": take in the closing bracket too.
    const lastRef = refs[refs.length - 1]
    if (paren && lastRef && masked[lastRef.at + lastRef.len] === ')') lastRef.len++
    for (const r of refs) {
      found.push(r)
      context = r
      if (VERBOSE) console.log(`    ${current}: …${masked.slice(Math.max(0, r.at - 20), r.at + r.len + 5).replace(/\n/g, ' ')}… → ${fmt(r)}`)
    }
    TEXT_REF.lastIndex = items[items.length - 1].end
  }
  stats.plain += found.length
  return found
}

const fmt = (r) =>
  `${r.book} ${r.startChapter}${r.startVerse ? ':' + r.startVerse : ''}${r.endChapter !== r.startChapter ? '-' + r.endChapter + (r.endVerse ? ':' + r.endVerse : '') : r.endVerse && r.endVerse !== r.startVerse ? '-' + r.endVerse : ''}`

// ---- Turning markup into plain text --------------------------------------------

class TextBuilder {
  out = ''
  space = false
  brk = false
  open = []
  text(s) {
    for (const ch of s) {
      const c = ch.charCodeAt(0)
      if (c === 32 || c === 9 || c === 10 || c === 13 || c === 160) {
        if (this.out) this.space = true
        continue
      }
      if (this.brk) {
        this.out += '\n\n'
      } else if (this.space && !',.;:)!?'.includes(ch) && !this.out.endsWith('(') && !this.out.endsWith('—') && ch !== '—') {
        this.out += ' '
      }
      this.brk = false
      this.space = false
      for (const o of this.open) if (o.start < 0) o.start = this.out.length
      this.out += ch
    }
  }
  para() {
    if (this.out) this.brk = true
  }
  begin() {
    const o = { start: -1 }
    this.open.push(o)
    return o
  }
  end(o) {
    this.open = this.open.filter((x) => x !== o)
    return o.start < 0 ? null : { at: o.start, len: this.out.length - o.start }
  }
}

const TAG = /<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g

/** Normalises the module's punctuation before conversion. */
function prepare(markup) {
  return markup
    .replace(/#\((\d[\d,;:\s–-]*)\)/g, '$1') // CCEL's link marker: "ver. #(18)" → "ver. 18"
    .replace(/#\(/g, '(')
    .replace(/\s*--\s*/g, '—')
}

/** Plain text and tagged references of a piece of OSIS markup. */
function convert(markup) {
  const b = new TextBuilder()
  const tags = []
  const stack = []
  let last = 0
  const src = prepare(markup)
  for (const m of src.matchAll(TAG)) {
    if (m.index > last) b.text(decodeEntities(src.slice(last, m.index)))
    last = m.index + m[0].length
    const close = m[1] === '/'
    const name = m[2].toLowerCase()
    const raw = m[0]
    if (name === 'div') {
      const type = attr(raw, 'type')
      if (type === 'x-p' || type === 'introduction') b.para()
    } else if (name === 'row' || name === 'table' || name === 'title') {
      b.para()
    } else if (name === 'cell') {
      if (close) b.text(' ')
    } else if (name === 'reference') {
      if (!close) stack.push({ osis: attr(raw, 'osisRef'), mark: b.begin() })
      else {
        const r = stack.pop()
        const span = r && b.end(r.mark)
        if (span) tags.push({ osis: r.osis, ...span })
      }
    }
  }
  if (last < src.length) b.text(decodeEntities(src.slice(last)))
  return { text: b.out, tags }
}

/** Text with all its references, relative to the passage being commented on. */
function textWithRefs(markup, here) {
  const { text, tags } = convert(markup)
  const tagged = taggedRefs(text, tags)
  const plain = plainRefs(text, tagged, here)
  const refs = [...tagged, ...plain].sort((a, b) => a.at - b.at)
  return { text, refs }
}

/**
 * Drops a trailing "(Rev 14:6-13)": the source's pointer to the next section of
 * the same chapter, left at the end of the one before it.
 */
function dropNextPointer(t, book, chapter, from) {
  const m = t.text.match(/\s*\(((?:[123]\s?)?[A-Z][a-z]*\.?\s?)?(\d+:\d[^()]*)\)\s*$/)
  if (!m) return t
  // The book is this one (Jude's "Jud" is read as Judges elsewhere, so it isn't checked).
  const ranges = parseRanges(m[2], book, chapter)
  if (!ranges || ranges[0][0] <= from) return t
  const cut = t.text.length - m[0].length
  stats.pointers++
  return { text: t.text.slice(0, cut), refs: t.refs.filter((r) => r.at + r.len <= cut) }
}

/** Trims a converted text, moving reference offsets with it. */
function trimText({ text, refs }, strip = /^[\s—.,;:]+/) {
  const lead = text.match(strip)?.[0].length ?? 0
  const t = text.slice(lead).replace(/\s+$/, '')
  return {
    text: t,
    refs: refs.filter((r) => r.at >= lead && r.at + r.len <= lead + t.length).map((r) => ({ ...r, at: r.at - lead })),
  }
}

const flat = (markup) => convert(markup).text.replace(/\s+/g, ' ').trim()

// ---- Outlines and verse ranges ------------------------------------------------------

/**
 * "1-8", "1, 2", "24-30; 36-43", "Is. 1:1-9", "Eccl. 4:7,8" → [[from, to], ...]
 * for verses of `chapter`, adjacent ranges merged. null if it isn't a range.
 */
function parseRanges(s, book, chapter, { open = false } = {}) {
  let t = s
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\s?-\s?/g, '-') // "8 -16"
    .replace(/[\s,;]+$/, '') // "35-46;"
    .trim()
  const bm = t.match(/^((?:[123]|III|II|I)?\s?[A-Za-z]+\.?)\s?(?=\d+:\d)/)
  if (bm) {
    const id = textBookId(bm[1])
    if (id && id !== book) return null
    t = t.slice(bm[0].length)
  }
  if (!/^\d/.test(t)) return null
  const n = versesIn(book, chapter)
  const ranges = []
  for (const part of t.split(/\s?[,;&]\s?|\s?\band\b\s?/)) {
    const m = part.trim().match(/^(?:(\d+):)?(\d+)(?:\s?-\s?(?:(\d+):)?(\d+))?$/)
    if (!m) return null
    const [, c1, v1, c2, v2] = m
    if (c1 && +c1 !== chapter) return null
    let from = +v1
    let to = v2 ? +v2 : +v1
    if (c2 && +c2 !== chapter) to = n // runs on into the next chapter
    if (from < 1 || from > n) return null
    if (to < from) {
      // A misprint such as "(23-10)" for 23-30: the caller can end it where the next item starts.
      if (!open) return null
      to = -1
    }
    ranges.push([from, to < 0 ? to : Math.min(to, n)])
  }
  return mergeRanges(ranges)
}

function mergeRanges(ranges) {
  const sorted = ranges.map((r) => [...r]).sort((a, b) => a[0] - b[0])
  const out = []
  for (const r of sorted) {
    const last = out[out.length - 1]
    if (last && r[0] <= last[1] + 1) last[1] = Math.max(last[1], r[1])
    else out.push(r)
  }
  return out
}

/**
 * The items of a chapter outline, from flattened text such as
 * "God creates heaven and earth. (1-2) The creation of light. (3-5)".
 * Returns { items: [{t, r}], rest } where rest is text that isn't part of it.
 */
function parseOutline(text, book, chapter) {
  const items = []
  let rest = ''
  let pending = ''
  let last = 0
  for (const m of text.matchAll(/\(([^()]*\d[^()]*)\)/g)) {
    const before = pending + text.slice(last, m.index)
    last = m.index + m[0].length
    const ranges = parseRanges(m[1], book, chapter, { open: true })
    if (!ranges) {
      pending = before + m[0]
      continue
    }
    pending = ''
    const title = cleanTitle(before)
    if (title) items.push({ t: title, r: ranges })
    else if (items.length) items[items.length - 1].r = [...items[items.length - 1].r, ...ranges] // "(Jr 46:27), (28)"
  }
  rest = (pending + text.slice(last)).trim()
  // Misprinted ends run to the verse before the next item (or the chapter's end).
  const n = versesIn(book, chapter)
  items.forEach((item, i) => {
    item.r = item.r.map(([a, b]) => {
      if (b >= 0) return [a, b]
      const next = items.slice(i + 1).map((x) => x.r[0][0]).find((v) => v > a)
      return [a, next ? next - 1 : n]
    })
    item.r = mergeRanges(item.r)
  })
  return { items, rest }
}

function cleanTitle(s) {
  return s
    .replace(/^\s*(?:Chapter Outline)?\s*/i, '')
    .replace(/^[,;.\s]+/, '')
    .replace(/^[a-z]+\.\s+(?=[A-Z])/, '') // "part. An exhortation" (a fragment left in the source)
    .replace(/\s+/g, ' ')
    .trim()
}

/** "Verses 1-8" / "Verse 31" → [[1, 8]] */
function headingRanges(label, book, chapter) {
  const m = label.replace(/\s+/g, ' ').trim().match(/^Verses?\s+(.+)$/i)
  return m ? parseRanges(m[1].replace(/\.$/, ''), book, chapter) : null
}

const inRanges = (ranges, v) => ranges.some(([a, b]) => v >= a && v <= b)

// ---- Splitting one module entry -------------------------------------------------------

const MARK = /<title type="x-ms">([\s\S]*?)<\/title>|<title type="x-s2">([\s\S]*?)<\/title>|<title type="x-IS">[\s\S]*?<\/title>|<hi type="bold">([\s\S]*?)<\/hi>/g

/** Splits an entry into [{kind: lead|book|chapter|outline|section, label, body}]. */
function segments(markup) {
  const out = [{ kind: 'lead', label: '', body: '' }]
  let last = 0
  for (const m of markup.matchAll(MARK)) {
    out[out.length - 1].body += markup.slice(last, m.index)
    last = m.index + m[0].length
    if (m[1] !== undefined) out.push({ kind: 'book', label: flat(m[1]), body: '' })
    else if (m[2] !== undefined) out.push({ kind: 'chapter', label: flat(m[2]), body: '' })
    else if (m[3] !== undefined) out.push({ kind: 'section', label: flat(m[3]), body: '' })
    else out.push({ kind: 'outline', label: '', body: '' })
  }
  out[out.length - 1].body += markup.slice(last)
  return out
}

/** "Verses 24-30" followed in the text by ", 36-43 This parable…": the second range. */
function splitHeadingTail(body, book, chapter) {
  const m = body.match(/^((?:\s*<[^>]+>)*\s*)([,;]\s*\d+(?:\s*[-–]\s*\d+)?(?:\s*[,;]\s*\d+(?:\s*[-–]\s*\d+)?)*)(?=\s+[A-Z"'])/)
  if (!m) return { body, extra: [] }
  const extra = parseRanges(m[2].replace(/^[,;]\s*/, ''), book, chapter)
  if (!extra) return { body, extra: [] }
  return { body: m[1] + body.slice(m[0].length), extra }
}

// ---- Building one book ------------------------------------------------------------------

function buildBook(bookInfo, testament, place) {
  const book = bookInfo.id
  const result = { b: book, c: [] }
  // Check the module's own book and chapter markers line up with our layout.
  const bookEntry = testament.entry(place.book).text
  const osisBook = bookEntry.match(/osisID="([^"]+)"/)?.[1]
  if (osisBook && findBook(osisBook)?.id !== book) throw new Error(`Versification mismatch: ${book} entry is ${osisBook}`)

  for (let c = 1; c <= place.chapters.length; c++) {
    current = `${book} ${c}`
    const base = place.chapters[c - 1]
    const n = versesIn(book, c)
    const head = testament.entry(base).text
    const osisCh = head.match(/<chapter[^>]*osisID="([^"]+)\.(\d+)"/)
    if (osisCh && (findBook(osisCh[1])?.id !== book || +osisCh[2] !== c)) throw new Error(`Versification mismatch at ${current}: ${osisCh[0]}`)

    // Group verses into entries (consecutive verses sharing bytes).
    const units = []
    for (let v = 1; v <= n; v++) {
      const e = testament.entry(base + v)
      if (!e.key) continue
      const lastU = units[units.length - 1]
      if (lastU && lastU.key === e.key && lastU.to === v - 1) lastU.to = v
      else units.push({ key: e.key, from: v, to: v, text: e.text })
    }
    // The chapter-heading entry (verse 0) usually holds only the <chapter> tag. One-
    // chapter books keep their introduction there, and a chapter-wide note with no
    // verse marker lands there too (Leviticus 19, Psalm 108).
    const headText = head.replace(/<chapter[^>]*\/>/g, '')
    let headIntro = null
    if (flat(headText)) {
      if (/<title type="x-s2">|<hi type="bold">/.test(headText)) units.unshift({ key: 'head', from: 1, to: 0, text: headText })
      else if (c === 1) headIntro = trimText(textWithRefs(headText, { book, chapter: 1 }))
      else warn(`text in the chapter heading entry: ${flat(headText).slice(0, 60)}`)
    }

    const chapter = { outline: [], sections: [], introParts: [] }
    for (const u of units) {
      const segs = segments(u.text)
      let pendingIntro = null // chapter markup awaiting a summary/section split
      const flushWhole = () => {
        if (pendingIntro === null) return
        wholeChapter(chapter, pendingIntro, u, book, c)
        pendingIntro = null
      }
      for (const s of segs) {
        if (s.kind === 'lead') {
          if (flat(s.body)) warn(`unexpected text before the first heading: ${flat(s.body).slice(0, 60)}`)
        } else if (s.kind === 'book') {
          // 2 Chronicles has no "Chapter 1" heading: its chapter-wide note
          // ("Solomon's choice of wisdom… --SOLOMON began…") follows the book title.
          if (c === 1 && !segs.some((x) => x.kind === 'chapter' || x.kind === 'outline' || x.kind === 'section') && /\/>\s*--/.test(s.body)) {
            pendingIntro = s.body
            continue
          }
          const t = trimText(textWithRefs(s.body, { book, chapter: 1 }))
          if (t.text) {
            result.intro = t.text
            if (t.refs.length) result.introRefs = t.refs
          }
        } else if (s.kind === 'chapter') {
          if (s.label !== `Chapter ${c}`) warn(`chapter heading "${s.label}"`)
          pendingIntro = s.body
        } else if (s.kind === 'outline') {
          if (pendingIntro !== null) chapter.introParts.push(pendingIntro)
          pendingIntro = null
          chapter.introParts.push(s.body)
        } else {
          if (pendingIntro !== null) chapter.introParts.push(pendingIntro)
          pendingIntro = null
          const ranges = headingRanges(s.label, book, c)
          if (!ranges) {
            warn(`unreadable heading "${s.label}"`)
            continue
          }
          const { body, extra } = splitHeadingTail(s.body, book, c)
          if (extra.length) stats.alsoRanges++
          const t = dropNextPointer(trimText(textWithRefs(body, { book, chapter: c })), book, c, ranges[0][0])
          chapter.sections.push({ ranges: mergeRanges([...ranges, ...extra]), heading: ranges, unit: u, ...t })
        }
      }
      // A chapter heading with no "Verses" heading after it: the chapter as a whole.
      flushWhole()
    }
    if (headIntro && !result.intro) {
      result.intro = headIntro.text
      if (headIntro.refs.length) result.introRefs = headIntro.refs
    } else if (headIntro) {
      warn(`second book introduction: ${headIntro.text.slice(0, 60)}`)
    }
    // Outline (tables and inline lists) and any leftover prose.
    const introText = chapter.introParts.map(flat).join(' ').replace(/\s+/g, ' ').trim()
    if (introText) {
      const { items, rest } = parseOutline(introText, book, c)
      chapter.outline = items
      const prose = rest.replace(/^Chapter Outline\s*/i, '').trim()
      if (prose && !items.length) {
        // Prose before the first section, with no outline in it: the chapter's introduction.
        const t = trimText(textWithRefs(chapter.introParts.join(' '), { book, chapter: c }), /^(?:[\s—]|Chapter Outline)+/)
        if (t.text) {
          chapter.intro = t.text
          if (t.refs.length) chapter.introRefs = t.refs
        }
      } else if (prose) {
        warn(`outline text not understood: "${prose.slice(0, 80)}"`)
      }
    }
    result.c.push(chapter)
  }
  return result
}

/** "Esau and his descendants. --The registers in this chapter…" → one section. */
function wholeChapter(chapter, markup, unit, book, c) {
  const src = prepare(markup)
  // The summary is everything before the first paragraph that starts with "--".
  const m = src.match(/^([\s\S]*?)(?:<div[^>]*type="(?:x-p|introduction)"[^>]*\/>\s*)+—/)
  let title = ''
  let body = markup
  if (m && flat(m[1])) {
    title = flat(m[1])
    body = src.slice(m[0].length - 1)
    if (/^[a-z]/.test(title)) {
      warn(`chapter summary "${title}" is a fragment; left out`) // Leviticus 19: "laws."
      title = ''
    }
  }
  const t = trimText(textWithRefs(body, { book, chapter: c }))
  if (!t.text) return
  const n = versesIn(book, c)
  chapter.sections.push({ ranges: [[unit.from, n]], heading: [[unit.from, n]], unit, whole: true, title: title || undefined, ...t })
}

// ---- The CCEL edition (for repairs) ---------------------------------------------------

/**
 * CCEL's plain-text edition: books (centred titles), "Chapter N" lines, and
 * sections that start either with a "Verses 1-8" line or, in the prophets, with a
 * paragraph beginning "Is. 1:1-9 …". Returns Map book → Map chapter →
 * {paras: [...], sections: [{ranges, text}], intro: [paras]}.
 */
function parseCcel(text) {
  const lines = text.split(/\r?\n/)
  const out = new Map()
  let bi = -1
  let ch = 0
  let chap = null
  let section = null
  let para = []
  const flushPara = () => {
    if (!para.length) return
    const p = para.join(' ').replace(/\s+/g, ' ').trim()
    para = []
    if (!p || !chap) return
    const alt = p.match(/^((?:[123] ?)?[A-Z][a-z]+\.? \d+:\d+(?:\s?[-,]\s?\d+)*) (?=[A-Z"'])/)
    if (alt) {
      const ranges = parseRanges(alt[1], BOOKS[bi].id, ch)
      if (ranges) {
        section = { ranges, paras: [p.slice(alt[0].length)] }
        chap.sections.push(section)
        return
      }
    }
    if (section) section.paras.push(p)
    else chap.intro.push(p)
  }
  for (const l of lines) {
    if (/^\s{20,}\S/.test(l)) {
      const name = l.trim()
      if (name === 'Indexes') break
      if (bi + 1 < BOOKS.length && name === ccelBookName(BOOKS[bi + 1])) {
        flushPara()
        bi++
        ch = 0
        chap = null
        section = null
        out.set(BOOKS[bi].id, new Map())
        continue
      }
    }
    if (bi < 0) continue
    let m
    if ((m = l.match(/^Chapter (\d+)\s*$/))) {
      flushPara()
      ch = +m[1]
      chap = { intro: [], sections: [] }
      section = null
      out.get(BOOKS[bi].id).set(ch, chap)
      continue
    }
    if ((m = l.match(/^Verses? (\d.*?)\s*$/))) {
      flushPara()
      if (!chap) {
        ch = 1
        chap = { intro: [], sections: [] }
        out.get(BOOKS[bi].id).set(1, chap)
      }
      const ranges = parseRanges(m[1], BOOKS[bi].id, ch)
      section = { ranges: ranges ?? [], paras: [] }
      chap.sections.push(section)
      continue
    }
    if (/^\s*_{10,}\s*$/.test(l) || !l.trim()) {
      flushPara()
      continue
    }
    if (!chap && /^\s+Chapter Outline\s*$/.test(l)) {
      ch = 1 // 2 Kings and 2 Chronicles have no "Chapter 1" line
      chap = { intro: [], sections: [] }
      out.get(BOOKS[bi].id).set(1, chap)
    }
    para.push(l.trim())
  }
  flushPara()
  return out
}

function ccelBookName(b) {
  return b.id === 'SNG' ? 'Song of Solomon' : b.name
}

/** A CCEL section as module-like markup (paragraph markers) so it converts the same way. */
function ccelMarkup(paras) {
  return paras.map((p) => `<div type="x-p" sID="c"/>${p.replace(/&/g, '&amp;').replace(/</g, '&lt;')}<div type="x-p" eID="c"/>`).join(' ')
}

const words = (s) => (s.match(/[A-Za-z]+/g) ?? []).length

/** Fills what the module lost from the CCEL edition. */
function repairChapter(chapter, ccelChapter, book, c) {
  if (!ccelChapter) return
  const n = versesIn(book, c)
  if (!chapter.sections.length) {
    // The whole chapter is missing from the module.
    if (ccelChapter.sections.length) {
      for (const s of ccelChapter.sections) addCcelSection(chapter, s.ranges, s.paras, book, c, 'chapter missing from the module')
    } else if (ccelChapter.intro.length) {
      const paras = [...ccelChapter.intro]
      let title
      if (paras.length > 1 && !paras[0].startsWith('--') && paras[1].startsWith('--')) title = cleanTitle(paras.shift())
      if (title && /^[a-z]/.test(title)) title = undefined // "laws." — a fragment in the source
      addCcelSection(chapter, [[1, n]], paras, book, c, 'chapter missing from the module', title)
    }
    return
  }
  // Sections the module dropped: a CCEL section starting on a verse where no module
  // section starts, whose verses the module has no heading for.
  const starts = new Set(chapter.sections.map((s) => s.ranges[0][0]))
  for (const s of ccelChapter.sections) {
    if (!s.ranges.length || starts.has(s.ranges[0][0])) continue
    const [from, to] = s.ranges[0]
    let claimed = false
    for (let v = from + 1; v <= to; v++) if (chapter.sections.some((x) => inRanges(x.heading, v))) claimed = true
    if (claimed) continue
    // Only if the CCEL text isn't already inside a module section (headings the
    // module merely renamed, e.g. "Is. 56:1,2" → "Verse 1").
    const sample = s.paras.join(' ').replace(/[^A-Za-z]+/g, ' ').trim().split(' ').slice(0, 12).join(' ')
    if (chapter.sections.some((x) => x.text.replace(/[^A-Za-z]+/g, ' ').includes(sample))) continue
    addCcelSection(chapter, s.ranges, s.paras, book, c, `section ${from}-${to} missing from the module`)
  }
}

function addCcelSection(chapter, ranges, paras, book, c, why, title) {
  const t = trimText(textWithRefs(ccelMarkup(paras), { book, chapter: c }))
  if (!t.text) return
  chapter.sections.push({ ranges, heading: ranges, unit: null, src: 'ccel', title, ...t })
  stats.repairs.push(`${book} ${c}:${ranges.map((r) => r.join('-')).join(',')} — ${why} (${words(t.text)} words)`)
  if (VERBOSE) console.log(`    ${book} ${c}: restored ${ranges.map((r) => r.join('-')).join(',')} from CCEL (${why})`)
}

// ---- Final ranges, titles and output -------------------------------------------------------

function finishChapter(chapter, book, c, ccelChapter) {
  current = `${book} ${c}`
  const n = versesIn(book, c)
  const secs = chapter.sections.sort((a, b) => a.ranges[0][0] - b.ranges[0][0])
  // A note on the chapter as a whole stops where another section starts.
  for (const s of secs) {
    if (!s.whole) continue
    const next = secs.find((x) => x !== s && x.ranges[0][0] > s.ranges[0][0])
    if (next) s.ranges = s.heading = [[s.ranges[0][0], next.ranges[0][0] - 1]]
  }
  const claimedBy = (v, except) => secs.some((s) => s !== except && inRanges(s.ranges, v))
  // Outline titles: from the module, or from CCEL when the module lost the row.
  let outline = chapter.outline
  if (ccelChapter && REPAIR && !secs.some((s) => s.whole)) {
    const ccelOutline = ccelOutlineItems(ccelChapter, book, c)
    for (const item of ccelOutline) {
      if (!outline.some((o) => o.r[0][0] === item.r[0][0])) {
        outline = [...outline, item].sort((a, b) => a.r[0][0] - b.r[0][0])
        stats.repairs.push(`${book} ${c}: outline item (${item.r.map((r) => r.join('-')).join('; ')}) "${item.t}" restored from CCEL`)
      } else {
        // The module dropped the second half of "(24-30; 36-43)".
        const o = outline.find((x) => x.r[0][0] === item.r[0][0])
        if (item.r.length > o.r.length) o.r = item.r
      }
    }
  }
  for (const s of secs) {
    const item = outline.find((o) => o.r[0][0] === s.ranges[0][0])
    if (!item) continue
    // Widen a heading narrower than its outline item when the extra verses have no
    // note of their own (John 3 "Verses 1-8" whose outline item is 1-21).
    const extra = []
    for (const [a, b] of item.r) for (let v = a; v <= b; v++) if (!inRanges(s.ranges, v)) extra.push(v)
    if (extra.length && extra.every((v) => !claimedBy(v, s))) {
      s.ranges = mergeRanges([...s.ranges, ...extra.map((v) => [v, v])])
      stats.widened++
      if (VERBOSE) console.log(`    ${current}: section ${s.heading.map((r) => r.join('-'))} widened to ${s.ranges.map((r) => r.join('-'))} (outline)`)
    }
  }
  // Verses the module links to a section's entry beyond its heading (1 Sam 25:32-44
  // under "Verses 32-39") belong to it, unless another section covers them.
  for (const s of secs) {
    if (!s.unit) continue
    const extra = []
    for (let v = s.unit.from; v <= s.unit.to; v++) if (!inRanges(s.ranges, v) && !claimedBy(v, s)) extra.push(v)
    if (extra.length && s === secs.filter((x) => x.unit === s.unit).at(-1)) {
      s.ranges = mergeRanges([...s.ranges, ...extra.map((v) => [v, v])])
      stats.linkedWidened++
    }
  }
  // Titles: the outline items that start inside the section (Rev 18 "Verses 1-8"
  // covers the outline's 1-3 and 4-8).
  for (const s of secs) {
    if (s.title) continue
    const items = outline.filter((o) => inRanges(s.ranges, o.r[0][0]))
    if (items.length) s.title = sectionTitle(items.map((o) => o.t).join(' '))
  }
  const uncovered = []
  for (let v = 1; v <= n; v++) if (!secs.some((s) => inRanges(s.ranges, v))) uncovered.push(v)
  if (uncovered.length) stats.uncovered.push(`${book} ${c}:${compressList(uncovered)}`)

  const out = {}
  if (chapter.intro) {
    out.intro = chapter.intro
    if (chapter.introRefs?.length) out.introRefs = chapter.introRefs
  }
  if (outline.length) out.outline = outline.map((o) => ({ t: o.t, r: o.r }))
  out.sections = secs.map((s) => {
    const o = { from: s.ranges[0][0], to: s.ranges[0][1] }
    if (s.ranges.length > 1) o.also = s.ranges.slice(1)
    if (s.title) o.title = s.title
    o.text = s.text
    o.refs = s.refs
    if (s.src) o.src = s.src
    return o
  })
  return out
}

/** "to mortify all corrupt affections;" → "To mortify all corrupt affections" */
function sectionTitle(t) {
  const s = t.replace(/[\s;,:]+$/, '').trim()
  return s ? s[0].toUpperCase() + s.slice(1) : s
}

function ccelOutlineItems(ccelChapter, book, c) {
  // Only the outline paragraphs: those before a chapter-wide note ("--The registers…").
  const paras = []
  for (const p of ccelChapter.intro) {
    if (p.startsWith('--')) break
    paras.push(p)
  }
  const text = paras.join(' ')
  if (!/\(/.test(text)) return []
  return parseOutline(text.replace(/--/g, '—'), book, c).items.filter((i) => i.t.length <= 250)
}

function compressList(vs) {
  const out = []
  for (const v of vs) {
    const last = out[out.length - 1]
    if (last && v === last[1] + 1) last[1] = v
    else out.push([v, v])
  }
  return out.map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`)).join(',')
}

// ---- Main ------------------------------------------------------------------------------

async function main() {
  const { conf, data } = await loadModule()
  const ot = layout(BOOKS.filter((b) => b.testament === 'OT'))
  const nt = layout(BOOKS.filter((b) => b.testament === 'NT'))
  if (ot.size !== data.ot.count || nt.size !== data.nt.count) {
    throw new Error(`KJV verse counts don't match the module index (OT ${ot.size} vs ${data.ot.count}, NT ${nt.size} vs ${data.nt.count})`)
  }
  let ccel = null
  if (REPAIR) {
    const bytes = await download(CCEL.url, CCEL.sha256, 'CCEL mhcc.txt')
    const text = new TextDecoder('utf-8').decode(bytes)
    if (!/Rights:\s*Public Domain/.test(text.slice(0, 2000))) throw new Error('CCEL mhcc.txt no longer says "Rights: Public Domain"')
    ccel = parseCcel(text)
    if (ccel.size !== 66) throw new Error(`CCEL edition: found ${ccel.size} books, expected 66`)
  }

  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(OUT, { recursive: true })
  const meta = {
    title: TITLE,
    short: 'Matthew Henry',
    author: 'Matthew Henry',
    year: 1706,
    license: 'Public Domain',
    credit: CREDIT,
    source: {
      module: MODULE.name,
      moduleVersion: conf.Version,
      moduleDate: conf.SwordVersionDate,
      distributionLicense: conf.DistributionLicense,
      url: `https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=${MODULE.name}`,
      textSource: conf.TextSource,
      repairsFrom: REPAIR ? CCEL.url : null,
    },
    built: new Date().toISOString().slice(0, 10),
    books: {},
  }
  let sections = 0
  let chapters = 0
  let totalRefs = 0
  for (const b of BOOKS) {
    const t = b.testament === 'OT' ? ot : nt
    const book = buildBook(b, b.testament === 'OT' ? data.ot : data.nt, t.map.get(b.id))
    const ccelBook = ccel?.get(b.id)
    book.c = book.c.map((ch, i) => {
      const c = i + 1
      current = `${b.id} ${c}`
      if (REPAIR) repairChapter(ch, ccelBook?.get(c), b.id, c)
      return finishChapter(ch, b.id, c, REPAIR ? ccelBook?.get(c) : null)
    })
    const json = {}
    json.b = book.b
    if (book.intro) json.intro = book.intro
    if (book.introRefs) json.introRefs = book.introRefs
    json.c = book.c
    writeFileSync(join(OUT, `${b.id}.json`), JSON.stringify(json))
    const secCount = book.c.reduce((s, ch) => s + ch.sections.length, 0)
    const refCount = book.c.reduce((s, ch) => s + ch.sections.reduce((x, sec) => x + sec.refs.length, 0), 0) + (book.introRefs?.length ?? 0)
    sections += secCount
    chapters += book.c.length
    totalRefs += refCount
    meta.books[b.id] = { chapters: book.c.length, sections: secCount, refs: refCount, intro: !!book.intro }
  }
  meta.sections = sections
  meta.references = totalRefs
  meta.repairs = stats.repairs
  meta.uncovered = stats.uncovered
  writeFileSync(join(OUT, 'meta.json'), JSON.stringify(meta, null, 1))

  console.log(`  ${chapters} chapters, ${sections} sections, ${totalRefs} references (read: ${stats.tagged} from tags, ${stats.plain} from plain text; ${stats.pointers} "(next section)" pointers removed with theirs)`)
  console.log(`  follow-on tags re-read: ${stats.taggedReread} (${stats.taggedChanged} differed from the osisRef); point numbers not taken as verses: ${stats.numberedPoints}; impossible references dropped: ${stats.dropped}`)
  console.log(`  sections widened to their outline item: ${stats.widened}; to the module's verse links: ${stats.linkedWidened}; with a second range: ${stats.alsoRanges}`)
  console.log(`  repairs from CCEL: ${stats.repairs.length}${stats.repairs.length ? '\n    ' + stats.repairs.join('\n    ') : ''}`)
  console.log(`  verses with no note (Henry passes over them): ${stats.uncovered.length ? stats.uncovered.join('; ') : 'none'}`)
  if (stats.warnings.length) console.log(`  warnings (${stats.warnings.length}):\n    ${stats.warnings.slice(0, 40).join('\n    ')}`)
  console.log(`  total size of public/data/commentary: ${(dirSize(OUT) / 1024 / 1024).toFixed(2)} MB`)
}

function dirSize(dir) {
  let total = 0
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    total += st.isDirectory() ? dirSize(p) : st.size
  }
  return total
}

await main()
