// Builds the offline Bible dictionaries the app reads from public/data/dictionary/.
//
//   node scripts/data/dictionary.mjs                 (re-generates everything)
//   node scripts/data/dictionary.mjs --allow-update  (accept newer CrossWire files)
//   node scripts/data/dictionary.mjs --verbose       (also print references found in
//                                                     plain text, corrected or dropped)
//
// SOURCES — three public-domain works, as packaged by the CrossWire Bible Society
// (SWORD project). Each module's own .conf file says "DistributionLicense=Public
// Domain"; the script checks that line and refuses to continue if it changes.
//   easton     Easton's Illustrated Bible Dictionary, 3rd ed. (M. G. Easton, 1897)
//              SWORD module "Easton" v2.0.1 (TEI markup, text from CCEL)
//   hitchcock  Hitchcock's Dictionary of Bible Names (Roswell D. Hitchcock, 1869)
//              SWORD module "Hitchcock" v2.0 (TEI markup, text from CCEL)
//   smith      Smith's Bible Dictionary (William Smith, 1884 revised ed.)
//              SWORD module "Smith" v1.3 (ThML markup)
// Downloads come from https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/
// and are pinned by SHA-256 below, so a silent upstream change stops the build.
//
// WHAT IT DOES
// Reads the SWORD lexicon files directly (zLD = zlib-compressed blocks, RawLD =
// plain), strips the markup to plain text with paragraph breaks ("\n\n"), and
// turns every scripture reference into a structured passage using the app's own
// parseReference(). References come from the markup (<ref osisRef>, <scripRef>)
// and, conservatively, from plain text ("2Sam 14:27", or a bare "(20:16)" that
// refers to the book cited just before it, or to the book an article is about).
// Known faults in the modules are repaired: Easton's short follow-on tags ("19" in
// "Gen. 35:16, 19") often carry a wrong osisRef, so they are re-read from the
// text; Smith writes "phm" for Philippians as well as Philemon. Every reference is
// checked against the KJV's real chapter and verse counts; impossible ones (typos,
// Apocrypha) are dropped. "See X" links between entries are kept too, and
// Hitchcock's combined entries ("Caleb" + "Caleb-Ephratah") are split.
//
// OUTPUT (all compact JSON; book ids are USFM codes like GEN, JHN, 1CO)
//   index.json            [{id, term, source, preview}] for every entry, A–Z
//   <source>/<letter>.json  [{id, term, text, refs, see?}] — entries whose id
//                          starts with that letter. refs: [{book, startChapter,
//                          startVerse?, endChapter, endVerse?, at?, len?}] where
//                          at/len give the characters of `text` to make a link.
//                          see: [{id, at, len}] links to other entries.
//   verses/<BOOK>.json    {"<chapter>": {"<verse>": [entry ids]}} — which entries
//                          cite each verse ("0" = the whole chapter is cited)
//   meta.json             titles, licences and counts for the credits page
// Entry ids look like "easton:abraham" or "smith:ab-2"; the letter file is the
// first character after the colon.

import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { inflateSync } from 'node:zlib'
import { unzipSync, strFromU8 } from 'fflate'
import { findBook, allBookNames, BOOKS } from '../../src/lib/books.ts'
import { parseReference } from '../../src/lib/references.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(root, 'public', 'data', 'dictionary')
const ALLOW_UPDATE = process.argv.includes('--allow-update')
const VERBOSE = process.argv.includes('--verbose')
const BASE_URL = 'https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/'

const SOURCES = [
  {
    id: 'easton',
    module: 'Easton',
    version: '2.0.1',
    sha256: 'f6dd054554764e2e97d5d189a697eb26039054578a9ccf98ce668ab810341c6e',
    title: "Easton's Bible Dictionary",
    year: 1897,
    author: 'M. G. Easton',
    credit:
      "Easton's Illustrated Bible Dictionary, 3rd edition, by M. G. Easton (Thomas Nelson, 1897). Public domain. Text from the CrossWire Bible Society SWORD module \"Easton\" (from CCEL). Changes: markup removed, scripture references linked.",
  },
  {
    id: 'hitchcock',
    module: 'Hitchcock',
    version: '2.0',
    sha256: '1c22a6482246274f463a5365232de8f79b445971f2de336b670a9b4d73fc74e4',
    title: "Hitchcock's Dictionary of Bible Names",
    year: 1869,
    author: 'Roswell D. Hitchcock',
    credit:
      "Hitchcock's Dictionary of Bible Names, from Hitchcock's New and Complete Analysis of the Holy Bible (1869). Public domain. Text from the CrossWire Bible Society SWORD module \"Hitchcock\" (from CCEL). Changes: markup removed, combined entries split.",
  },
  {
    id: 'smith',
    module: 'Smith',
    version: '1.3',
    sha256: '88a2c2d11f70b2484fa39d61a8e821849dca799d51e1593e8a2839f6313a8f9a',
    title: "Smith's Bible Dictionary",
    year: 1884,
    author: 'William Smith',
    credit:
      "Smith's Bible Dictionary by William Smith (revised edition, 1884). Public domain. Text from the CrossWire Bible Society SWORD module \"Smith\". Changes: markup removed, scripture references linked.",
  },
]

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

/** "ABRAHAM’S BOSOM" → "abrahams-bosom" */
function slugify(s) {
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’‘`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Spaces, hyphens and punctuation removed: "Beth-lehem" and "BETHLEHEM" both → "bethlehem". */
function compact(s) {
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

const SMALL_WORDS = new Set(['of', 'the', 'and', 'or', 'in', 'on', 'to', 'a', 'an', 'at', 'by', 'for', 'with', 'from', 'into', 'upon'])
/** Smith's headwords are all capitals; "ZUPH, LAND OF" → "Zuph, Land of". */
function titleCase(s) {
  let first = true
  return s.toLowerCase().replace(/[a-z][a-z’']*/g, (w) => {
    const keep = !first && SMALL_WORDS.has(w)
    first = false
    if (/^(i|ii|iii|iv)$/.test(w)) return w.toUpperCase()
    return keep ? w : w[0].toUpperCase() + w.slice(1)
  })
}

// ---- Reading SWORD lexicon modules --------------------------------------------

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

/** Returns [{key, body}] in module order. Bodies are still marked up. */
function readLexicon(files, conf) {
  const base = conf.DataPath.replace(/^\.\//, '')
  const get = (ext) => {
    const f = files[base + ext]
    if (!f) throw new Error(`Module file ${base + ext} is missing`)
    return f
  }
  const decoder = new TextDecoder(/utf-?8/i.test(conf.Encoding ?? '') ? 'utf-8' : 'windows-1252')
  const idx = get('.idx')
  const dat = get('.dat')
  const out = []
  const keyOf = (rec) => {
    const nl = rec.indexOf(10)
    return [decoder.decode(rec.subarray(0, nl)).replace(/\r$/, '').trim(), rec.subarray(nl + 1)]
  }
  const driver = conf.ModDrv.toLowerCase()
  if (driver === 'zld') {
    const zdx = get('.zdx')
    const zdt = get('.zdt')
    const blocks = new Map()
    const block = (n) => {
      if (!blocks.has(n)) blocks.set(n, inflateSync(zdt.subarray(u32(zdx, n * 8), u32(zdx, n * 8) + u32(zdx, n * 8 + 4))))
      return blocks.get(n)
    }
    for (let i = 0; i + 8 <= idx.length; i += 8) {
      const start = u32(idx, i)
      const [key, rest] = keyOf(dat.subarray(start, start + u32(idx, i + 4)))
      if (decoder.decode(rest.subarray(0, 5)) === '@LINK') {
        out.push({ key, link: decoder.decode(rest.subarray(5)).trim() })
        continue
      }
      const b = block(u32(rest, 0))
      const e = u32(rest, 4)
      const off = u32(b, 4 + e * 8)
      let text = b.subarray(off, off + u32(b, 8 + e * 8))
      if (text[text.length - 1] === 0) text = text.subarray(0, -1)
      out.push({ key, body: decoder.decode(text) })
    }
  } else if (driver === 'rawld' || driver === 'rawld4') {
    const width = driver === 'rawld4' ? 8 : 6
    for (let i = 0; i + width <= idx.length; i += width) {
      const start = u32(idx, i)
      const size = width === 8 ? u32(idx, i + 4) : u16(idx, i + 4)
      const [key, rest] = keyOf(dat.subarray(start, start + size))
      const body = decoder.decode(rest)
      if (body.startsWith('@LINK')) out.push({ key, link: body.slice(5).trim() })
      else out.push({ key, body })
    }
  } else {
    throw new Error(`Unsupported SWORD driver ${conf.ModDrv}`)
  }
  return out
}

async function loadModule(src) {
  const url = BASE_URL + src.module + '.zip'
  console.log(`Downloading ${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not download ${url}: ${res.status}`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  const hash = createHash('sha256').update(bytes).digest('hex')
  if (hash !== src.sha256) {
    const msg = `${src.module}.zip has changed upstream (sha256 ${hash}). Check its licence and re-run with --allow-update.`
    if (!ALLOW_UPDATE) throw new Error(msg)
    console.warn('  ' + msg)
  }
  const files = unzipSync(bytes)
  const confName = Object.keys(files).find((n) => /^mods\.d\/.+\.conf$/i.test(n))
  if (!confName) throw new Error(`${src.module}: no .conf file in the zip`)
  const conf = parseConf(strFromU8(files[confName]))
  if (conf.DistributionLicense !== 'Public Domain') {
    throw new Error(`${src.module}: licence is "${conf.DistributionLicense}", expected "Public Domain"`)
  }
  if (conf.Version !== src.version) {
    const msg = `${src.module}: module version is ${conf.Version}, expected ${src.version}`
    if (!ALLOW_UPDATE) throw new Error(msg)
    console.warn('  ' + msg)
  }
  return { conf, records: readLexicon(files, conf) }
}

// ---- Verse counts (to reject impossible references) ---------------------------

const VERSE_COUNTS = new Map()
{
  const dir = join(root, 'public', 'bible', 'kjv')
  if (existsSync(dir)) {
    for (const b of BOOKS) {
      const f = join(dir, `${b.id}.json`)
      if (!existsSync(f)) continue
      const book = JSON.parse(readFileSync(f, 'utf8'))
      VERSE_COUNTS.set(b.id, book.chapters.map((ch) => ch.reduce((m, v) => Math.max(m, v.v), 0)))
    }
  }
  if (VERSE_COUNTS.size < 66) console.warn('KJV verse counts not found in public/bible/kjv — references will not be checked')
}

const stats = { dropped: 0 }
let current = '' // entry being converted, for --verbose messages

/** Turns parsed numbers into a checked Passage via the app's parseReference. */
function makePassage(bookId, it) {
  const book = findBook(bookId)
  if (!book) return null
  // (In one-chapter books a lone number is a verse, which parseReference handles.)
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
  if (counts) {
    if (p.startChapter > counts.length || p.endChapter > counts.length) return dropped(s)
    if (p.startVerse !== undefined) {
      if (p.startVerse < 1 || p.startVerse > counts[p.startChapter - 1]) return dropped(s)
      if (p.endVerse !== undefined) p.endVerse = Math.min(p.endVerse, counts[p.endChapter - 1])
    }
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
 * Reads a list of chapter/verse numbers such as "12:1-3, 5; 13:2" or "57,58,59"
 * starting at s[i]. A bare number after a comma is a verse when the previous item
 * had a verse, otherwise a chapter. Stops before "2 Kings" or "1Chr".
 * `ctx` continues a list begun earlier: the previous item's chapter, whether it
 * had a verse, and the separator ("," or ";") written before s[i].
 */
const ITEM = /(\d{1,3})(?:(?::\s?|\.(?=\d))(\d{1,3}))?(?:\s?[-–—]\s?(\d{1,3})(?:(?::|\.(?=\d))(\d{1,3}))?)?(?![\d:])/y
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
      if (/^[123]\s?[A-Z]/.test(s.slice(start, start + 3))) break
    }
    ITEM.lastIndex = start
    const m = ITEM.exec(s)
    if (!m) break
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

// Book abbreviations used in Smith's <scripRef passage="..."> attributes (Online
// Bible style). Most are understood by findBook(); these are the ones it reads
// differently ("jud" is Judges here, not Jude) or doesn't know.
const SMITH_ABBREV = { jud: 'JDG', lu: 'LUK', joh: 'JHN', so: 'SNG', joe: 'JOL', de: 'DEU', '1jo': '1JN', '2jo': '2JN', '3jo': '3JN', jude: 'JUD' }

// Extra book names seen in running text: Smith's four-letter forms ("Numb 23:28",
// "Isai 34:4", "2Kin 16") and a few older ones.
const EXTRA_TEXT_NAMES = {
  gene: 'GEN', levi: 'LEV', numb: 'NUM', nehe: 'NEH', psal: 'PSA', isai: 'ISA', jere: 'JER', lame: 'LAM',
  dani: 'DAN', hose: 'HOS', jona: 'JON', mica: 'MIC', nahu: 'NAM', haba: 'HAB', hagg: 'HAG', mala: 'MAL',
  roma: 'ROM', gala: 'GAL', ephe: 'EPH', colo: 'COL', '1the': '1TH', '2the': '2TH', titu: 'TIT', phile: 'PHM',
  philem: 'PHM', hebr: 'HEB', jame: 'JAS', '1joh': '1JN', '2joh': '2JN', '3joh': '3JN', reve: 'REV',
  '1kin': '1KI', '2kin': '2KI', cant: 'SNG', jno: 'JHN', 'acts of the apostles': 'ACT',
}
const TEXT_NAMES = [...new Set([...allBookNames(), ...Object.keys(EXTRA_TEXT_NAMES)])].sort((a, b) => b.length - a.length)
const textBookId = (name) => {
  const k = name.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim()
  return EXTRA_TEXT_NAMES[k] ?? EXTRA_TEXT_NAMES[k.replace(/^(\d) /, '$1')] ?? findBook(k)?.id ?? null
}
const NAME_SRC = TEXT_NAMES.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/^(\d) ?/, '$1\\s?').replace(/ /g, '\\s')).join('|')
// A book name followed by a chapter; any other word followed by "chapter:verse"
// (Tobit, Ecclus., Josephus' "Ant." — consumed so its numbers aren't misread);
// or a bare "chapter:verse".
const TEXT_REF = new RegExp(
  `(?<![A-Za-z])(${NAME_SRC})\\.?\\s?(?=\\d)|(?<![A-Za-z])([A-Za-z]+)\\.?\\s?(?=\\d{1,3}:\\d)|(?<![\\w:.,\\-\\u0001])(?=\\d{1,3}:\\d{1,3}(?![\\d:]))`,
  'gi',
)
// Words that may stand before a bare "3:16" without being a book.
const NOT_BOOKS = new Set(['see', 'comp', 'cf', 'ver', 'vers', 'verse', 'verses', 'ch', 'chap', 'chapter', 'in', 'and', 'also', 'compare', 'or', 'with', 'as', 'so', 'but', 'by', 'of', 'to', 'at', 'from', 'ff', 'etc', 'is', 'it', 'he', 'his', 'the'])
const BOOK_AT_START = new RegExp(`^(${NAME_SRC})\\.?\\s?\\d`, 'i')
const BOOK_BEFORE_PAREN = new RegExp(`(?<![A-Za-z])(${NAME_SRC})\\.?\\s?\\(\\s?$`, 'i')
// A book's full name a few words before a bare "(5:1-4)": "Ezekiel’s (5:1-4)", "Mark says
// (14:5)", "Daniel prophesied (11:30)", "Hosea uses the phrase (1:10)", "Zephaniah also (2:13)".
const FULL_NAME_SRC = BOOKS.map((b) => b.name)
  .sort((a, b) => b.length - a.length)
  .map((n) => n.replace(/^(\d) /, '$1\\s?').replace(/ /g, '\\s'))
  .join('|')
const BOOK_NEAR_PAREN = new RegExp(
  `(?<![A-Za-z])(${FULL_NAME_SRC})(?:['’]s|\\s(?:also\\s)?(?:says|saith|writes|tells|records|relates|describes|speaks|mentions|prophesied|prophesies|declares|calls|uses|refers|alludes|adds|also)(?:\\s[a-z]+){0,2})\\s?\\(\\s?$`,
)

/** Spans of text for each item of a reference label, aligned with `count` passages. */
function labelSpans(label, count) {
  // Skip a leading book name ("1 Samuel ") to reach the first number.
  const m = label.match(/^\s*(?:[123]\s?(?=[A-Za-z]))?[^\d]*/)
  const first = m ? m[0].length : 0
  const items = parseNumberList(label, first)
  if (items.length === count) return items.map((it, i) => ({ start: i === 0 ? 0 : it.start, end: it.end }))
  return [{ start: 0, end: label.length }]
}

// ---- Turning markup into plain text with link spans ---------------------------

class TextBuilder {
  out = ''
  space = false
  brk = false
  open = []
  text(s) {
    for (const ch of s) {
      const c = ch.charCodeAt(0)
      // Stray etext italic markers ("tsori_ or _tseri"); the dictionaries have no real underscores.
      if (c === 95) continue
      if (c === 32 || c === 9 || c === 10 || c === 13 || c === 160) {
        if (this.out) this.space = true
        continue
      }
      if (this.brk) {
        this.out += '\n\n'
      } else if (this.space && !',.;:)!?'.includes(ch) && !this.out.endsWith('(')) {
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

/** Walks markup, calling onTag for tags and builder.text for text. */
function walk(markup, builder, onTag) {
  let last = 0
  for (const m of markup.matchAll(TAG)) {
    if (m.index > last) builder.text(decodeEntities(markup.slice(last, m.index)))
    last = m.index + m[0].length
    onTag({ close: m[1] === '/', name: m[2].toLowerCase(), raw: m[0], selfClose: m[4] === '/' })
  }
  if (last < markup.length) builder.text(decodeEntities(markup.slice(last)))
}

/** Easton (TEI): <p>, <ref osisRef>, <ref target="Easton:KEY">, <foreign>. */
function convertEaston(body) {
  const b = new TextBuilder()
  const refs = []
  const links = []
  const stack = []
  const handlers = {
    p: () => b.para(),
    ref: (t) => {
      if (!t.close) {
        stack.push({ osis: attr(t.raw, 'osisRef'), target: attr(t.raw, 'target'), mark: b.begin() })
        return
      }
      const r = stack.pop()
      if (!r) return
      const span = b.end(r.mark)
      if (!span) return
      if (r.osis) refs.push({ osis: r.osis, ...span })
      else if (r.target) links.push({ target: r.target.replace(/^Easton:/, ''), label: b.out.slice(span.at, span.at + span.len), ...span })
    },
  }
  // The title is the headword, shown separately.
  const markup = body.replace(/<title>[\s\S]*?<\/title>/, '')
  walk(markup, b, (t) => handlers[t.name]?.(t))
  return { text: b.out, refs: eastonRefs(b.out, refs), links }
}

const LABEL_BOOK = /^((?:[123]\s?)?[A-Za-z][A-Za-z.]*(?:\s(?:of\s)?[A-Za-z]+\.?)?)\s?(?=\d)/
const eastonStats = { checked: 0, corrected: 0, unknownBook: 0 }

/**
 * Easton's tags carry an osisRef, which is right whenever the label names the book
 * ("Gen. 35:16") but often wrong for the short follow-on labels ("19", "18:15"),
 * where the module's tagger fell back to Genesis. Those are read from the label
 * itself, continuing the book and chapter of the reference before it.
 */
function eastonRefs(text, refs) {
  const out = []
  let prev = null // { book, chapter, verse } of the last reference, or 'unknown'
  for (const r of refs) {
    const label = text.slice(r.at, r.at + r.len)
    // A few tags wrap just the "1" of "1 Tim. 3:16"; leave those to the text scanner.
    if (/^[123]$/.test(label) && BOOK_AT_START.test(text.slice(r.at, r.at + 20))) continue
    const fromOsis = r.osis ? osisToPassage(r.osis) : null
    let found = []
    const bm = label.match(LABEL_BOOK)
    if (bm) {
      const bookId = textBookId(bm[1])
      if (!bookId) {
        // "1 Macc. 1:23" — not in the Protestant canon (the osisRef is a guess).
        eastonStats.unknownBook++
        prev = 'unknown'
        continue
      }
      found = itemsToRefs(bookId, label, parseNumberList(label, bm[0].length), r.at)
      if (!found.length && fromOsis?.book === bookId) found = [{ ...fromOsis, at: r.at, len: r.len }]
    } else if (/^\d/.test(label) && prev === 'unknown') {
      continue
    } else if (/^\d/.test(label) && prev) {
      const sepChar = text.slice(0, r.at).trimEnd().slice(-1)
      const ctx = { chapter: prev.chapter, verse: prev.verse, sep: sepChar === ';' ? ';' : sepChar === ',' || prev.verse ? ',' : ';' }
      found = itemsToRefs(prev.book, label, parseNumberList(label, 0, ctx), r.at)
      eastonStats.checked++
      const a = found[0]
      if (a && !(fromOsis && fromOsis.book === a.book && fromOsis.startChapter === a.startChapter && (fromOsis.startVerse ?? 1) === (a.startVerse ?? 1))) {
        eastonStats.corrected++
        if (VERBOSE && fromOsis?.book === a.book) {
          console.log(`    easton follow-on: …${text.slice(Math.max(0, r.at - 30), r.at + r.len).replace(/\n/g, ' ')} → ${a.book} ${a.startChapter}:${a.startVerse ?? ''} (osisRef said ${r.osis})`)
        }
      }
    } else if (fromOsis) {
      found = [{ ...fromOsis, at: r.at, len: r.len }]
    }
    if (!found.length) continue
    out.push(...found)
    const last = found[found.length - 1]
    prev = { book: last.book, chapter: last.endChapter, verse: last.startVerse !== undefined }
  }
  return out
}

/** Passages for the number items of a label, each with the span of text it covers. */
function itemsToRefs(bookId, label, items, at) {
  const out = []
  items.forEach((it, i) => {
    const p = makePassage(bookId, it)
    if (!p) return
    const start = i === 0 ? 0 : it.start
    const end = i === items.length - 1 ? Math.max(it.end, label.trimEnd().length) : it.end
    out.push({ ...p, at: at + start, len: end - start })
  })
  return out
}

function osisToPassage(osis) {
  const m = osis.replace(/^Bible:/, '').match(/^([1-4]?[A-Za-z]+)\.(\d+)(?:\.(\d+))?(?:-(?:([1-4]?[A-Za-z]+)\.)?(\d+)(?:\.(\d+))?)?$/)
  if (!m) return null
  const [, bk, c, v, bk2, c2, v2] = m
  const book = findBook(bk)
  if (!book || (bk2 && findBook(bk2)?.id !== book.id)) return null
  // "Jude.1" / "Obad.1" is the whole (one-chapter) book, not verse 1.
  if (book.chapters === 1 && !v && !c2) return { book: book.id, startChapter: 1, endChapter: 1 }
  const it = { c1: +c, c2: +c }
  if (v) it.v1 = it.v2 = +v
  if (c2) {
    if (v2) {
      it.c2 = +c2
      it.v2 = +v2
    } else if (v && !bk2) {
      it.v2 = +c2 // "Gen.1.1-3" style
    } else {
      it.c2 = +c2
      if (v) it.v2 = undefined
    }
  }
  return makePassage(book.id, it)
}

/** Smith (ThML): <scripRef passage>, <term>, <i>, <ol>/<li>. */
function convertSmith(body, term) {
  const b = new TextBuilder()
  const refs = []
  const links = []
  const lists = []
  const open = []
  // Section headings like "<i>Roads.</i> --There appear..." start a new paragraph,
  // unless they open a list item, which already has one (and its number: "5. Materials.—").
  const markup = body
    .replace(/\s*\._(?=[A-Z])/g, '.--') // "Apocrypha ._The", a garbled heading dash
    .replace(/(<li>\s*)?<i>([A-Z][^<]{0,79})<\/i>(\s*\.?\s*)--/g, (_, li, head, gap) => `${li ?? '<para/>'}<i>${head}</i>${gap}--`)
    .replace(/\s*--\s*/g, '—')
  walk(markup, b, (t) => {
    if (t.name === 'para') b.para()
    else if (t.name === 'ol') {
      if (t.close) lists.pop()
      else lists.push(0)
      b.para()
    } else if (t.name === 'li') {
      b.para()
      if (!t.close && lists.length) {
        lists[lists.length - 1]++
        b.text(`${lists[lists.length - 1]}. `)
      }
    } else if (t.name === 'scripref' || t.name === 'term') {
      if (!t.close) open.push({ name: t.name, passage: attr(t.raw, 'passage'), mark: b.begin() })
      else {
        const o = open.pop()
        if (!o) return
        const span = b.end(o.mark)
        if (!span) return
        const label = b.out.slice(span.at, span.at + span.len)
        if (o.name === 'term') links.push({ target: label, label, ...span })
        else refs.push(...smithPassages(o.passage ?? label, label, span, refs[refs.length - 1], term))
      }
    }
  })
  return { text: b.out, refs, links }
}

const stats2 = { smithMisaligned: 0 }
function smithPassages(passage, label, span, last, term) {
  let s = passage.trim().replace(/::/g, ':')
  const m = s.match(/^((?:[123]\s?)?[a-z]+)[.,]?\s*/i)
  if (!m) return []
  const abbr = m[1].toLowerCase().replace(/\s/g, '')
  let rest = s.slice(m[0].length)
  let bookId = SMITH_ABBREV[abbr] ?? findBook(abbr)?.id
  // The module writes "phm" for both Philemon and Philippians (and labels both
  // "Philemon"): chapters 2–4 and verses past 25 can only be Philippians.
  if (abbr === 'phm') {
    const cv = rest.match(/^(\d+)(?::(\d+))?/)
    const philemonish = /philemon|onesimus|archippus|apphia|demas|lucas|epaphras|aristarchus/i.test(term)
    if (cv && cv[2] && (+cv[1] > 1 || +cv[2] > 25 || !philemonish)) bookId = 'PHP'
    else if (cv && !cv[2] && last?.book === 'PHP') bookId = 'PHP'
  }
  if (!bookId) return []
  if (!rest.includes(':') && /^\d+;\d/.test(rest)) rest = rest.replace(';', ':')
  // A follow-on label ("23-35" after "Leviticus 25:8-16") may mean verses of the
  // previous chapter when it can't be chapters; parseNumberList records that option.
  const ctx = /^\d/.test(label) && last?.book === bookId ? { chapter: last.endChapter, verse: last.startVerse !== undefined, sep: ';' } : undefined
  const items = parseNumberList(rest, 0, ctx)
  const spans = labelSpans(label, items.length)
  if (spans.length !== items.length && items.length > 1) stats2.smithMisaligned++
  const out = []
  items.forEach((it, i) => {
    const p = makePassage(bookId, it)
    if (!p) return
    const sp = spans[i]
    out.push(sp ? { ...p, at: span.at + sp.start, len: sp.end - sp.start } : p)
  })
  return out
}

/** Hitchcock (TEI): one or more names, each followed by <def> meanings. */
function convertHitchcock(key, body) {
  const head = attr(body, 'n') ?? key
  const parts = []
  let cur = { term: head, defs: [] }
  parts.push(cur)
  const inner = body.replace(/^[\s\S]*?<entryFree[^>]*>/, '').replace(/<\/entryFree>[\s\S]*$/, '')
  let last = 0
  for (const m of inner.matchAll(/<def>([\s\S]*?)<\/def>/g)) {
    const between = decodeEntities(inner.slice(last, m.index).replace(/<[^>]+>/g, '')).trim()
    if (between && cur.defs.length) {
      cur = { term: between.replace(/\s+/g, ' '), defs: [] }
      parts.push(cur)
    }
    cur.defs.push(decodeEntities(m[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim())
    last = m.index + m[0].length
  }
  return parts
    .filter((p) => p.defs.length)
    .map((p) => {
      const text = p.defs.join('; ').replace(/;\s*;/g, ';').replace(/[;,]\s*$/, '')
      // "same as Beth-palet", "see Ephratah" become links.
      const links = []
      for (const lm of text.matchAll(/\b(?:same as|see)\s+([A-Z][A-Za-z'-]+)/g)) {
        const at = lm.index + lm[0].length - lm[1].length
        links.push({ target: lm[1], label: lm[1], at, len: lm[1].length })
      }
      return { term: p.term, text, refs: [], links }
    })
}

/**
 * The book an article is about ("James, Epistle of" → JAS), whose bare "(4:16)"
 * references point to that book rather than to the last one cited.
 */
function subjectBook(term, text) {
  const t = term.toLowerCase()
  // "Amos": the prophet's article also covers "The Book of Amos".
  const named = findBook(t)
  if (named && named.name.toLowerCase() === t && new RegExp(`\\bbook of ${t}\\b`, 'i').test(text)) return named.id
  if (!/\b(book|epistle|gospel|prophecies|prophecy)\b|^acts of the apostles/.test(t) || /\b(books|epistles)\b/.test(t)) return null
  const head = t.split(/,|\s+of the apostles/)[0].trim()
  const ord = /\bfirst\b/.test(t) ? '1 ' : /\bsecond\b/.test(t) ? '2 ' : /\bthird\b/.test(t) ? '3 ' : ''
  return findBook(ord + head)?.id ?? null
}

/** Adds references written as plain text, outside the tagged ones. */
function scanPlainRefs(text, tagged, subject, links = []) {
  const sorted = [...tagged].filter((r) => r.at !== undefined).sort((a, b) => a.at - b.at)
  // Mask tagged references and entry links so the scanner can't match inside them.
  const chars = text.split('')
  for (const r of [...sorted, ...links]) chars.fill('\u0001', r.at, r.at + r.len)
  const masked = chars.join('')
  const found = []
  let ti = 0
  let context = null
  TEXT_REF.lastIndex = 0
  let m
  while ((m = TEXT_REF.exec(masked))) {
    while (ti < sorted.length && sorted[ti].at < m.index) context = sorted[ti++].book
    let bookId = null
    let fallback = null
    const numbersAt = m.index + m[0].length
    const spanStart = m.index
    if (m[1]) {
      // Book name in running text: must look like a proper name ("Gen", "2Sam").
      if (!/^[A-Z]|^\d\s?[A-Z]/.test(m[1])) {
        TEXT_REF.lastIndex = m.index + 1
        continue
      }
      bookId = textBookId(m[1])
    } else if (m[2]) {
      if (!/^[A-Z]/.test(m[2]) || NOT_BOOKS.has(m[2].toLowerCase())) {
        TEXT_REF.lastIndex = m.index + m[2].length
        continue
      }
      // Not a Bible book (Tobit 4:10, Ant. 14:3): skip its numbers.
      const items = parseNumberList(masked, numbersAt)
      context = null
      TEXT_REF.lastIndex = items.length ? items[items.length - 1].end : m.index + m[0].length
      continue
    } else {
      const lead = masked.slice(Math.max(0, m.index - 24), m.index)
      const before = lead.match(BOOK_BEFORE_PAREN)
      const near = before ? null : masked.slice(Math.max(0, m.index - 48), m.index).match(BOOK_NEAR_PAREN)
      const chap = lead.match(/(?<![A-Za-z])([A-Z][a-z]+)\.?,?\s(?:ch|chap)\.\s?$/) // "Judith, ch. 10:3"
      if (chap && !textBookId(chap[1])) {
        TEXT_REF.lastIndex = m.index + 1
        continue
      }
      bookId = before && /^[A-Z]|^\d\s?[A-Z]/.test(before[1]) ? textBookId(before[1]) : chap ? textBookId(chap[1]) : near ? textBookId(near[1]) : (subject ?? context)
      // If the numbers can't belong to that book, try the other likely one.
      if (near) fallback = subject ?? context
      else if (!before && !chap) fallback = subject && context !== subject ? context : subject
    }
    const items = bookId ? parseNumberList(masked, numbersAt) : []
    if (!items.length) {
      TEXT_REF.lastIndex = m.index + 1
      continue
    }
    for (let i = 0; i < items.length; i++) {
      const p = makePassage(bookId, items[i]) ?? (fallback ? makePassage(fallback, items[i]) : null)
      if (!p) continue
      const start = i === 0 ? spanStart : items[i].start
      found.push({ ...p, at: start, len: items[i].end - start })
      context = p.book
    }
    TEXT_REF.lastIndex = items[items.length - 1].end
  }
  return found
}

// ---- Build ----------------------------------------------------------------------

const sourceRank = { easton: 0, smith: 1, hitchcock: 2 }

function preview(text) {
  const flat = text.replace(/\s*\n\n\s*/g, ' ')
  if (flat.length <= 110) return flat
  let cut = flat.slice(0, 100)
  const sp = cut.lastIndexOf(' ')
  if (sp > 60) cut = cut.slice(0, sp)
  return cut.replace(/[\s,;:.(—-]+$/, '') + '…'
}

function resolveLinks(entries) {
  const byKey = new Map()
  const byCompact = new Map()
  const byPart = new Map()
  for (const e of entries) {
    if (!byKey.has(e.key)) byKey.set(e.key, e.id)
    const c = compact(e.term)
    if (!byCompact.has(c)) byCompact.set(c, e.id)
    for (const part of e.term.replace(/\s*\([^)]*\)/g, '').split(/\s*(?:,|;|=|\bor\b|\bOR\b)\s*/)) {
      const pc = compact(part)
      if (pc && !byPart.has(pc)) byPart.set(pc, e.id)
    }
  }
  // Last resorts: singular/plural forms, then the shortest headword that starts
  // with the target as a whole word ("BAPTISM" → "BAPTISM, CHRISTIAN").
  const keysByLength = [...byKey.keys()].sort((a, b) => a.length - b.length)
  const loose = (target) => {
    const t = target.toUpperCase().trim()
    if (t.length < 4) return undefined
    for (const v of [t + 'S', t + 'ES', t.replace(/Y$/, 'IES'), t.replace(/IES$/, 'Y'), t.replace(/E?S$/, '')]) {
      const id = byCompact.get(compact(v))
      if (v !== t && id) return id
    }
    const key = keysByLength.find((k) => k.startsWith(t + ',') || k.startsWith(t + ' '))
    return key ? byKey.get(key) : undefined
  }
  let unresolved = 0
  for (const e of entries) {
    const see = []
    for (const l of e.links) {
      const id =
        byKey.get(l.target) ??
        byCompact.get(compact(l.target)) ??
        byCompact.get(compact(l.label)) ??
        byPart.get(compact(l.target)) ??
        byPart.get(compact(l.label.split(/[,;]/)[0])) ??
        loose(l.target)
      if (id && id !== e.id) see.push({ id, at: l.at, len: l.len })
      else if (!id) unresolved++
    }
    e.see = see
  }
  return unresolved
}

async function main() {
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(OUT, { recursive: true })
  const index = []
  const meta = { built: new Date().toISOString().slice(0, 10), sources: [] }
  const verseMap = new Map() // book → chapter → verse → Set(ids)
  const casing = new Map() // compact term → nicely cased term from Easton / Hitchcock

  for (const src of SOURCES) {
    const { conf, records } = await loadModule(src)
    const usedIds = new Set()
    const entries = []
    let tagged = 0
    let plain = 0
    for (const rec of records) {
      if (rec.link || !rec.body?.trim()) continue
      current = `${src.id} ${rec.key}`
      let converted
      if (src.id === 'easton') {
        const r = convertEaston(rec.body)
        const term = decodeEntities(rec.body.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? titleCase(rec.key))
        converted = [{ term, ...r }]
      } else if (src.id === 'smith') {
        let term = casing.get(compact(rec.key)) ?? titleCase(rec.key)
        const r = convertSmith(rec.body, term)
        // "Abishai, or Abishai" (accents lost upstream) → "Abishai"
        const alts = term.split(/,?\s+or\s+/i)
        if (alts.length > 1 && alts.every((a) => compact(a) === compact(alts[0]))) term = alts[0]
        converted = [{ term, ...r }]
      } else {
        converted = convertHitchcock(rec.key, rec.body)
      }
      for (const c of converted) {
        if (!c.text.trim()) continue
        const base = slugify(c.term) || 'entry'
        let id = `${src.id}:${base}`
        for (let n = 2; usedIds.has(id); n++) id = `${src.id}:${base}-${n}`
        usedIds.add(id)
        const extra = scanPlainRefs(c.text, c.refs, subjectBook(c.term, c.text), c.links)
        tagged += c.refs.length
        plain += extra.length
        if (VERBOSE) {
          for (const r of extra) {
            const ctx = c.text.slice(Math.max(0, r.at - 25), r.at + r.len + 5).replace(/\n/g, ' ')
            console.log(`    ${id}: …${ctx}… → ${r.book} ${r.startChapter}${r.startVerse ? ':' + r.startVerse : ''}${r.endVerse && r.endVerse !== r.startVerse ? '-' + r.endVerse : ''} [${c.text.slice(r.at, r.at + r.len)}]`)
          }
        }
        const refs = [...c.refs, ...extra].sort((a, b) => (a.at ?? 1e9) - (b.at ?? 1e9))
        entries.push({ id, key: rec.key, term: c.term, text: c.text, refs, links: c.links })
        if (!casing.has(compact(c.term))) casing.set(compact(c.term), c.term)
      }
    }
    const unresolved = resolveLinks(entries)

    // Write letter files.
    const byLetter = new Map()
    for (const e of entries) {
      const slug = e.id.slice(e.id.indexOf(':') + 1)
      const letter = /^[a-z]/.test(slug) ? slug[0] : '0'
      if (!byLetter.has(letter)) byLetter.set(letter, [])
      const out = { id: e.id, term: e.term, text: e.text, refs: e.refs }
      if (e.see.length) out.see = e.see
      byLetter.get(letter).push(out)
      index.push({ id: e.id, term: e.term, source: src.id, preview: preview(e.text) })
      for (const r of e.refs) addVerse(verseMap, r, e.id)
    }
    mkdirSync(join(OUT, src.id), { recursive: true })
    for (const [letter, list] of byLetter) writeFileSync(join(OUT, src.id, `${letter}.json`), JSON.stringify(list))

    const refCount = tagged + plain
    console.log(
      `  ${src.id}: ${entries.length} entries, ${refCount} references (${tagged} tagged, ${plain} found in text), ` +
        `${entries.reduce((n, e) => n + e.see.length, 0)} see-links (${unresolved} unresolved), ${byLetter.size} letter files`,
    )
    meta.sources.push({
      id: src.id,
      title: src.title,
      author: src.author,
      year: src.year,
      license: 'Public Domain',
      credit: src.credit,
      module: src.module,
      moduleVersion: conf.Version,
      url: `https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=${src.module}`,
      entries: entries.length,
      references: refCount,
      letters: [...byLetter.keys()].sort(),
    })
  }

  index.sort((a, b) => compact(a.term).localeCompare(compact(b.term)) || sourceRank[a.source] - sourceRank[b.source] || a.id.localeCompare(b.id))
  writeFileSync(join(OUT, 'index.json'), JSON.stringify(index))

  mkdirSync(join(OUT, 'verses'), { recursive: true })
  let verseFiles = 0
  for (const [book, chapters] of verseMap) {
    const obj = {}
    for (const [c, verses] of [...chapters].sort((a, b) => a[0] - b[0])) {
      obj[c] = {}
      for (const [v, ids] of [...verses].sort((a, b) => a[0] - b[0])) {
        obj[c][v] = [...ids].sort((a, b) => sourceRank[a.slice(0, a.indexOf(':'))] - sourceRank[b.slice(0, b.indexOf(':'))])
      }
    }
    writeFileSync(join(OUT, 'verses', `${book}.json`), JSON.stringify(obj))
    verseFiles++
  }
  meta.entries = index.length
  writeFileSync(join(OUT, 'meta.json'), JSON.stringify(meta, null, 1))

  console.log(`  Easton follow-on labels re-read: ${eastonStats.checked} (${eastonStats.corrected} differed from the module's osisRef); non-canonical refs skipped: ${eastonStats.unknownBook}`)
  console.log(`  index: ${index.length} entries; verse files: ${verseFiles}; invalid references dropped: ${stats.dropped}; Smith labels not split: ${stats2.smithMisaligned}`)
  console.log(`  total size of public/data/dictionary: ${(dirSize(OUT) / 1024 / 1024).toFixed(2)} MB`)
}

/** Records which entries cite each verse. Short ranges count for every verse. */
function addVerse(map, r, id) {
  if (!map.has(r.book)) map.set(r.book, new Map())
  const chapters = map.get(r.book)
  const add = (c, v) => {
    if (!chapters.has(c)) chapters.set(c, new Map())
    const verses = chapters.get(c)
    if (!verses.has(v)) verses.set(v, new Set())
    verses.get(v).add(id)
  }
  if (r.startVerse === undefined) {
    for (let c = r.startChapter; c <= r.endChapter && c < r.startChapter + 5; c++) add(c, 0)
    return
  }
  if (r.endChapter === r.startChapter) {
    const end = r.endVerse ?? r.startVerse
    if (end - r.startVerse <= 30) for (let v = r.startVerse; v <= end; v++) add(r.startChapter, v)
    else add(r.startChapter, r.startVerse)
  } else {
    add(r.startChapter, r.startVerse)
  }
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
