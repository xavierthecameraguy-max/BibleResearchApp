// Builds the offline topical Bible the app reads from public/data/topics/.
//
//   node scripts/data/topics.mjs                  (downloads and re-generates everything)
//   node scripts/data/topics.mjs --zip Nave.zip   (use an already-downloaded module zip)
//   node scripts/data/topics.mjs --allow-update   (accept a newer CrossWire file)
//   node scripts/data/topics.mjs --verbose        (print dropped references and how "See X"
//                                                  links to missing names were matched)
//
// SOURCE — Nave's Topical Bible by Orville J. Nave (first published 1896–97), which is in
// the public domain. The text is the CrossWire Bible Society's SWORD module "Nave"
// (version 3.0, 2021, re-made from CCEL's edition at https://ccel.org/ccel/n/nave/bible.xml).
// The module's own .conf file says "DistributionLicense=Public Domain"; the script checks
// that line and refuses to continue if it ever changes. The download is pinned by SHA-256.
// (CCEL's edition adds a few modern glosses, e.g. "Ass (Donkey)". Its XML carries only a
// generic "Copyright Christian Classics Ethereal Library" comment and no rights statement on
// the book's page; https://www.ccel.org/about/copyright.html says its editions of
// public-domain books may be used for personal purposes and asks to be contacted before
// republishing them or using them commercially. This app is for personal use.)
//   https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/Nave.zip
//
// (OpenBible.info's crowd-voted topical data, CC BY 4.0, was also evaluated. It has no
// subtopics and many of its 6,700 "topics" are raw search phrases — "feng shui", "kung
// pao", misspellings — so Nave's hand-made index was chosen.)
//
// WHAT IT DOES
// Reads the zLD (zlib-compressed lexicon) files straight from the zip. Each of the 5,322
// entries is a topic; its lines ("→ General scriptures concerning …", "1. Son of Aaron …")
// and list items become subtopics, in the book's order. Scripture references are read from
// the plain text with Nave's own abbreviations (Ge, Ex, … Jud = Judges, Jude, Re) rather
// than from the module's <ref osisRef> tags, because the tags have known faults: one-chapter
// books lose their verses ("Jude 1</ref>:21,24,25"), names are tagged as books ("Son of
// <ref>Ezra 1</ref>Ch 4:17" is really "Ezra, 1Ch 4:17"), "2Co" is tagged as Colossians, and
// a few references are not tagged at all. Continuations are followed the way Nave writes
// them: "Ps 9:9,10; 18:30" (verse, then chapter:verse), "Ex 28; 29" (chapters),
// "Job 30:20; with 42:12". Every reference is checked against the KJV's real chapter and
// verse counts (public/bible/kjv); impossible ones are dropped and counted. "See X" links
// become seeAlso ids; links to topics that do not exist under that exact name are matched
// to the nearest real topic ("JESUS" → "JESUS, THE CHRIST", "COURTS" → "COURT").
// The two topics that appear twice in the module (REVERENCE, SIN) are merged.
//
// OUTPUT (compact JSON; book ids are USFM codes like GEN, JHN, 1CO; numbers are plain)
//   index.json         [{id, name, count}] for every topic, sorted by name (A–Z).
//                      count = number of references in the topic.
//   <letter>.json      [{id, name, subtopics: [{label, refs, level?, seeAlso?}], seeAlso?: [ids]}]
//                      for the topics whose id starts with that letter (a.json … z.json).
//                      refs: [{book, startChapter, startVerse?, endChapter, endVerse?}];
//                      no verses = whole chapter(s). level 1 = an indented line under the
//                      line before it (level 0 is left out). A subtopic with no refs is a
//                      heading for the indented lines after it, or a "See …" line whose
//                      seeAlso holds the linked topic ids (label "See God, Grace of").
//                      The topic's own seeAlso lists every linked topic once.
//   byVerse/<BOOK>.json {"<chapter>": {"<verse>": [topic ids]}} — the topics that cite each
//                      verse, most specific first (a topic citing just that verse comes
//                      before one citing a long passage). Verse "0" lists topics that cite
//                      the whole chapter or a passage of more than 40 verses in it.
//   meta.json          title, credit, licence, source version and counts.
// Topic ids are slugs of the headword: "GRACE OF GOD" → "grace-of-god",
// "JESUS, THE CHRIST" → "jesus-the-christ".

import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { inflateSync } from 'node:zlib'
import { unzipSync, strFromU8 } from 'fflate'
import { BOOKS, getBook } from '../../src/lib/books.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(root, 'public', 'data', 'topics')
const args = process.argv.slice(2)
const ALLOW_UPDATE = args.includes('--allow-update')
const VERBOSE = args.includes('--verbose')
const ZIP_ARG = args.includes('--zip') ? args[args.indexOf('--zip') + 1] : null

const MODULE = {
  name: 'Nave',
  url: 'https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/Nave.zip',
  version: '3.0',
  sha256: '52d9b7cde04c2abb5187ae804bcb97d93c7344a1358539f50ebc178ac0c945f0',
}
const CREDIT =
  "Nave's Topical Bible by Orville J. Nave (1896). Public domain. Text from the CrossWire Bible Society SWORD module \"Nave\" v3.0 (from CCEL). Changes: markup removed, scripture references re-read and checked against the KJV, duplicate topics merged."

// Passages longer than this many verses are filed under the chapter ("0") in byVerse.
const MAX_EXPAND = 40

// ---- Reading the SWORD module ---------------------------------------------------

function parseConf(text) {
  const conf = {}
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_0-9]+)=(.*)$/)
    if (m && !(m[1] in conf)) conf[m[1]] = m[2].trim()
  }
  return conf
}

const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0

/** zLD lexicon → [{key, body}] in module order (bodies still TEI markup). */
function readZld(files, conf) {
  if (conf.ModDrv?.toLowerCase() !== 'zld') throw new Error(`Unsupported SWORD driver ${conf.ModDrv}`)
  const base = conf.DataPath.replace(/^\.\//, '')
  const get = (ext) => {
    const f = files[base + ext]
    if (!f) throw new Error(`Module file ${base + ext} is missing`)
    return f
  }
  const [idx, dat, zdx, zdt] = ['.idx', '.dat', '.zdx', '.zdt'].map(get)
  const decoder = new TextDecoder('utf-8')
  const blocks = new Map()
  const block = (n) => {
    if (!blocks.has(n)) blocks.set(n, inflateSync(zdt.subarray(u32(zdx, n * 8), u32(zdx, n * 8) + u32(zdx, n * 8 + 4))))
    return blocks.get(n)
  }
  const out = []
  for (let i = 0; i + 8 <= idx.length; i += 8) {
    const start = u32(idx, i)
    const rec = dat.subarray(start, start + u32(idx, i + 4))
    const nl = rec.indexOf(10)
    const key = decoder.decode(rec.subarray(0, nl)).replace(/\r$/, '').trim()
    const rest = rec.subarray(nl + 1)
    if (decoder.decode(rest.subarray(0, 5)) === '@LINK') continue
    const b = block(u32(rest, 0))
    const e = u32(rest, 4)
    const off = u32(b, 4 + e * 8)
    let text = b.subarray(off, off + u32(b, 8 + e * 8))
    if (text[text.length - 1] === 0) text = text.subarray(0, -1)
    out.push({ key, body: decoder.decode(text) })
  }
  return out
}

async function loadModule() {
  let bytes
  if (ZIP_ARG) {
    console.log(`Reading ${ZIP_ARG}`)
    bytes = new Uint8Array(readFileSync(ZIP_ARG))
  } else {
    console.log(`Downloading ${MODULE.url}`)
    const res = await fetch(MODULE.url)
    if (!res.ok) throw new Error(`Could not download ${MODULE.url}: ${res.status}`)
    bytes = new Uint8Array(await res.arrayBuffer())
  }
  const hash = createHash('sha256').update(bytes).digest('hex')
  if (hash !== MODULE.sha256) {
    const msg = `Nave.zip has changed upstream (sha256 ${hash}). Check its licence and re-run with --allow-update.`
    if (!ALLOW_UPDATE) throw new Error(msg)
    console.warn('  ' + msg)
  }
  const files = unzipSync(bytes)
  const confName = Object.keys(files).find((n) => /^mods\.d\/.+\.conf$/i.test(n))
  if (!confName) throw new Error('Nave: no .conf file in the zip')
  const conf = parseConf(strFromU8(files[confName]))
  if (conf.DistributionLicense !== 'Public Domain') {
    throw new Error(`Nave: licence is "${conf.DistributionLicense}", expected "Public Domain"`)
  }
  if (conf.Version !== MODULE.version) {
    const msg = `Nave: module version is ${conf.Version}, expected ${MODULE.version}`
    if (!ALLOW_UPDATE) throw new Error(msg)
    console.warn('  ' + msg)
  }
  return { conf, records: readZld(files, conf) }
}

// ---- Verse counts (to reject impossible references) -----------------------------

const VERSE_COUNTS = new Map()
{
  const dir = join(root, 'public', 'bible', 'kjv')
  for (const b of BOOKS) {
    const f = join(dir, `${b.id}.json`)
    if (!existsSync(f)) continue
    const book = JSON.parse(readFileSync(f, 'utf8'))
    VERSE_COUNTS.set(b.id, book.chapters.map((ch) => ch.reduce((m, v) => Math.max(m, v.v), 0)))
  }
  if (VERSE_COUNTS.size < 66) throw new Error('KJV verse counts not found in public/bible/kjv (run the Bible build first)')
}
const versesIn = (book, ch) => VERSE_COUNTS.get(book)[ch - 1] ?? 0
const chaptersIn = (book) => getBook(book).chapters

// ---- Small text helpers ----------------------------------------------------------

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
    return ENTITIES[e.toLowerCase()] ?? m
  })
}

/** "GRACE OF GOD" → "grace-of-god" */
function slugify(s) {
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’‘`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
const compact = (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')

const SMALL_WORDS = new Set(['of', 'the', 'and', 'or', 'in', 'on', 'to', 'a', 'an', 'at', 'by', 'for', 'with', 'from', 'into', 'upon', 'as', 'unto'])
/** Nave's headwords are all capitals; "GRACE OF GOD" → "Grace of God", "ABED-NEGO" → "Abed-nego". */
function titleCase(s) {
  let first = true
  return s
    .replace(/' S\b/g, "'S")
    .toLowerCase()
    .replace(/[a-z][a-z’']*\.?/g, (w, at, all) => {
      const keep = !first && SMALL_WORDS.has(w)
      first = false
      if (all[at - 1] === '-') return w // "Abed-nego", "Mercy-seat"
      if (/^[a-z]\.$/.test(w)) return w.toUpperCase() // R. V., A. V.
      if (/^(i|ii|iii|iv)$/.test(w)) return w.toUpperCase()
      return keep ? w : w[0].toUpperCase() + w.slice(1)
    })
}
/** Uses the entry's own n="" spelling where it has lower-case parts ("ANGEL (a spirit)"). */
function displayName(key, n) {
  if (n && n !== key && /[a-z]/.test(n)) {
    return n.replace(/[A-Z][A-Z’'\-. ]*[A-Z.]|[A-Z]/g, (run) => titleCase(run))
  }
  return titleCase(key)
}

// ---- Reading scripture references from Nave's plain text ------------------------

// Nave's abbreviations (taken from the module itself), plus the few longer forms it uses.
const ABBR = {
  Ge: 'GEN', Ex: 'EXO', Le: 'LEV', Nu: 'NUM', Num: 'NUM', De: 'DEU', Jos: 'JOS', Jud: 'JDG', Ru: 'RUT',
  '1Sa': '1SA', '2Sa': '2SA', '1Ki': '1KI', '2Ki': '2KI', '1Ch': '1CH', '2Ch': '2CH', Ezr: 'EZR', Ne: 'NEH',
  Neh: 'NEH', Es: 'EST', Job: 'JOB', Ps: 'PSA', Pr: 'PRO', Ec: 'ECC', So: 'SNG', Isa: 'ISA', Jer: 'JER',
  La: 'LAM', Eze: 'EZK', Da: 'DAN', Dan: 'DAN', Ho: 'HOS', Hos: 'HOS', Joe: 'JOL', Am: 'AMO', Ob: 'OBA',
  Jon: 'JON', Mic: 'MIC', Na: 'NAM', Hab: 'HAB', Zep: 'ZEP', Hag: 'HAG', Zec: 'ZEC', Mal: 'MAL',
  Mt: 'MAT', Mr: 'MRK', Lu: 'LUK', Joh: 'JHN', Ac: 'ACT', Ro: 'ROM', '1Co': '1CO', '2Co': '2CO',
  Ga: 'GAL', Eph: 'EPH', Php: 'PHP', Col: 'COL', '1Th': '1TH', '2Th': '2TH', '1Ti': '1TI', '2Ti': '2TI',
  Tit: 'TIT', Phm: 'PHM', Heb: 'HEB', Jas: 'JAS', '1Pe': '1PE', '2Pe': '2PE', '1Jo': '1JN', '1Joh': '1JN',
  '2Jo': '2JN', '3Jo': '3JN', Jude: 'JUD', Re: 'REV',
}
// Full book names are accepted too, but only with chapter:verse ("Jonah 1:17"), because
// Nave often writes a person's name right before a reference ("Son of Micah 1Ch 8:35").
const FULL = {}
for (const b of BOOKS) FULL[b.name] = b.id
FULL.Psalm = 'PSA'
FULL['Song of Solomon'] = 'SNG'

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/^([123])/, '$1\\s?')
const BOOK_ALTS = [...Object.keys(ABBR), ...Object.keys(FULL)].sort((a, b) => b.length - a.length).map(esc).join('|')
// A book name, not glued to a word or number before it, followed by a chapter number that
// is not itself the start of another book ("Ezra 1Ch 4:17").
const BOOK_RE = new RegExp(`(?<![A-Za-z0-9:])(${BOOK_ALTS})(?![A-Za-z])\\.?\\s*(?=\\d+(?![A-Za-z\\d]))`, 'y')
const NUM = /\d+(?![A-Za-z\d])/y

function bookOf(token) {
  const t = token.replace(/\s+/g, '')
  if (ABBR[t]) return { id: ABBR[t], full: false }
  const f = Object.keys(FULL).find((k) => k.replace(/\s+/g, '') === t)
  return f ? { id: FULL[f], full: true } : null
}

const stats = { refs: 0, dropped: 0, clamped: 0 }
let currentKey = ''
function drop(why, text) {
  stats.dropped++
  if (VERBOSE) console.log(`  dropped ${why}: ${currentKey}: "${text}"`)
}

/** Checks a reference against the KJV and builds the Passage (or null). */
function makeRef(book, c1, v1, c2, v2, text) {
  const nCh = chaptersIn(book)
  if (!(c1 >= 1 && c1 <= nCh)) return drop('chapter', text), null
  if (c2 === undefined) c2 = c1
  if (c2 < c1 || c2 > nCh) {
    if (v1 === undefined) return drop('chapter range', text), null
    c2 = c1
    v2 = undefined
  }
  if (v1 === undefined) {
    return { book, startChapter: c1, endChapter: c2 }
  }
  if (!(v1 >= 1 && v1 <= versesIn(book, c1))) return drop('verse', text), null
  if (v2 === undefined) v2 = c2 === c1 ? v1 : versesIn(book, c2)
  if (c2 === c1 && v2 < v1) v2 = v1
  if (v2 > versesIn(book, c2)) {
    stats.clamped++
    v2 = versesIn(book, c2)
  }
  return { book, startChapter: c1, startVerse: v1, endChapter: c2, endVerse: v2 }
}

/**
 * Finds every reference in one line of plain text.
 * Returns { refs: Passage[], spans: [start, end][] } where spans cover the reference text.
 */
function findRefs(text) {
  const refs = []
  const spans = []
  let i = 0
  while (i < text.length) {
    BOOK_RE.lastIndex = i
    const bm = BOOK_RE.exec(text)
    if (!bm) {
      i++
      continue
    }
    const b = bookOf(bm[1])
    if (!b) {
      i++
      continue
    }
    const start = i
    const res = readChain(text, BOOK_RE.lastIndex, b)
    if (!res) {
      i = BOOK_RE.lastIndex
      continue
    }
    refs.push(...res.refs)
    spans.push([start, res.end])
    i = res.end
  }
  return { refs, spans }
}

const AFTER_BARE = /\s*(?:$|[,;.)\]:]|(?:with|and|also|compare|comp\.|cf\.)\s)/y
/** True when what follows a bare number shows it was a chapter or verse, not a count. */
function endsBare(text, q) {
  AFTER_BARE.lastIndex = q
  if (AFTER_BARE.test(text)) return true
  const ws = /\s*/y
  ws.lastIndex = q
  ws.exec(text)
  BOOK_RE.lastIndex = ws.lastIndex
  return BOOK_RE.test(text)
}

/** Reads "18:23-32,35; 19:1; with 20:4" after a book name. */
function readChain(text, pos, b) {
  const book = b.id
  const oneChapter = chaptersIn(book) === 1
  const out = []
  let chapter = 0
  let hasVerse = false
  let end = pos

  // One unit: N, N:V, N-M, N:V-W, N:V-M:W. `sep` is what came before it.
  const unit = (p, sep) => {
    NUM.lastIndex = p
    const a = NUM.exec(text)
    if (!a) return null
    let q = NUM.lastIndex
    let n1 = +a[0]
    let colon = null
    let range = null
    let rangeColon = null
    if (text[q] === ':') {
      NUM.lastIndex = q + 1
      const v = NUM.exec(text)
      if (!v) return null
      colon = +v[0]
      q = NUM.lastIndex
    }
    const dash = /\s?[-–]\s?/y
    dash.lastIndex = q
    if (dash.exec(text)) {
      NUM.lastIndex = dash.lastIndex
      const r = NUM.exec(text)
      if (r) {
        let q2 = NUM.lastIndex
        range = +r[0]
        if (text[q2] === ':') {
          NUM.lastIndex = q2 + 1
          const rv = NUM.exec(text)
          if (rv) {
            rangeColon = +rv[0]
            q2 = NUM.lastIndex
          }
        }
        q = q2
      }
    }
    if (colon === null && b.full && sep === 'book') return null
    const src = text.slice(p, q)
    let ref
    if (colon !== null) {
      // chapter:verse[-verse | -chapter:verse]
      chapter = n1
      hasVerse = true
      if (rangeColon !== null) ref = makeRef(book, n1, colon, range, rangeColon, src)
      else ref = makeRef(book, n1, colon, n1, range ?? colon, src)
    } else if (oneChapter && !(sep === 'book' && n1 === 1 && range === null)) {
      // "Jude 6", "Phm 1:2,3; 5": numbers are verses ("Jude 1" alone is the whole book)
      chapter = 1
      hasVerse = true
      ref = makeRef(book, 1, n1, 1, range ?? n1, src)
    } else if (sep === ',' && hasVerse) {
      // ", 10" or ", 17-22" after a verse: more verses of the same chapter
      ref = makeRef(book, chapter, n1, chapter, range ?? n1, src)
    } else {
      // "Ex 28", "; 29", "Jos 6-8": whole chapters
      chapter = n1
      hasVerse = false
      ref = makeRef(book, n1, undefined, range ?? n1, undefined, src)
    }
    return { ref, end: q, colon: colon !== null }
  }

  const first = unit(pos, 'book')
  if (!first) return null
  if (first.ref) out.push(first.ref)
  end = first.end
  // Continuations: ", 10", "; 18:30", "; with 42:12", ", and 5:3"
  const CONT = /\s*([,;])?\s*(?:(?:with|and|also|compare|comp\.|cf\.)\s+)?(?=\d)/y
  while (true) {
    CONT.lastIndex = end
    const m = CONT.exec(text)
    if (!m || CONT.lastIndex === end) break
    const sep = m[1] ?? ''
    const usedWord = /[a-z]/.test(m[0])
    if (!sep && !usedWord) break
    const p = CONT.lastIndex
    // A number that starts the next book ("; 1Ki 3:4", "; 2 Ch 5:1") ends the chain; the
    // outer loop reads it. A connecting word must be followed by chapter:verse.
    BOOK_RE.lastIndex = p
    if (BOOK_RE.exec(text)) break
    const u = unit(p, sep === ',' && !usedWord ? ',' : ';')
    if (!u) break
    // A bare number ("; 29", "with 20") must end the reference: "with 600 men" is not one.
    if (!u.colon && !endsBare(text, u.end)) break
    if (u.ref) out.push(u.ref)
    end = u.end
  }
  stats.refs += out.length
  return { refs: out, end }
}

// ---- Turning an entry into subtopics ----------------------------------------------

/** Splits an entry body into lines: [{level, html}] */
function entryLines(body) {
  const inner = body
    .replace(/^[\s\S]*?<def>/, '')
    .replace(/<\/def>[\s\S]*$/, '')
  const lines = []
  let inList = false
  for (const m of inner.matchAll(/<lb\/>|<list>|<\/list>|<item>([\s\S]*?)<\/item>|([^<]+|<ref[\s\S]*?<\/ref>|<[^>]*>)/g)) {
    const tok = m[0]
    if (tok === '<lb/>') lines.push({ kind: 'lb', html: '' })
    else if (tok === '<list>') inList = true
    else if (tok === '</list>') inList = false
    else if (m[1] !== undefined) lines.push({ kind: 'item', html: m[1] })
    else if (lines.length && !(inList && lines[lines.length - 1].kind === 'item')) lines[lines.length - 1].html += tok
    else if (tok.trim()) lines.push({ kind: 'lb', html: tok })
  }
  const out = []
  for (const l of lines) {
    // A stray "&gt;" in CCEL's e-text ("See DEATH&amp;gt;", "See &amp;gt;GOD, GOODNESS OF").
    let html = l.html.replace(/&amp;gt;/g, '').replace(/\s+/g, ' ').trim()
    let level = 1
    if (l.kind === 'lb') {
      if (/^→/.test(html) || /^\d+\.\s/.test(html)) level = 0
      html = html.replace(/^→\s*/, '')
    }
    // CCEL marks indented lines with a leading "."; in 28 places the conversion ran a line
    // into the one before it ("Incorruptible .Balaam Nu 22:18", "INSTANCES OF .Abraham Ge 13:8").
    // Split them back into a heading and an indented line (never inside a tag).
    const parts = html.split(/\s+\.(?=[A-Z(])(?![^<]*>)/)
    out.push({ level, html: parts[0] })
    for (const p of parts.slice(1)) out.push({ level: 1, html: p })
  }
  return out
}

/** Repairs small faults in the module's text before references are read. */
function cleanText(s) {
  return s
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/([A-Z]{2})([A-Z][a-z]{1,3} ?\d)/g, '$1 $2') // "REVERENCEGe 35:5"
    .replace(/\b0F\b/g, 'OF') // OCR: "0F MAN FOR JESUS"
    .replace(/(\w)' ([sS])\b/g, "$1'$2") // "God' s"
    .replace(/^(\d+)[.,](?=[A-Za-z])/, '$1. ') // "1.Translated", "1, A Levite"
    .replace(/^(\d+), (?=[A-Z])/, '$1. ')
    .replace(/\b([123]) \1 ?(?=(?:Sa|Ki|Ch|Co|Th|Ti|Pe|Jo)\b)/g, '$1') // "Jeremiah 2 2 Ch 36:12"
}

/** Nave writes headings and names in capitals: "INSTANCES OF", "Also called ACHBOR". */
function tidyCaps(label) {
  if (!/[a-z]/.test(label)) return titleCase(label)
  return label.replace(/\b[A-Z][A-Z'’-]+(?:[ ,]+[A-Z][A-Z'’-]+)*\b/g, (run) => titleCase(run))
}

/** Removes the reference text from a line and tidies what is left into a label. */
function makeLabel(text, spans) {
  let s = ''
  let at = 0
  for (const [a, b] of spans) {
    s += text.slice(at, a) + ' \u0000 '
    at = b
  }
  s += text.slice(at)
  s = s
    .replace(/\s+/g, ' ')
    // separators and connecting words that only joined references
    .replace(/(?:[\s,;:.]*(?:\b(?:with|and|also|compare|comp\.|cf\.)\b)?[\s,;:.]*\u0000)+[\s,;:.]*/g, (m, off, str) =>
      off + m.length >= str.length ? '' : ' ',
    )
    .replace(/\u0000/g, '')
    .replace(/\s+([,;:.)])/g, '$1')
    .replace(/\(\s*\)/g, '')
    .replace(/[\s,;:(]+$/, '')
    .replace(/^[\s.,;:]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
  return s
}

// ---- See-also links -----------------------------------------------------------------

const ALIAS = {
  JESUS: 'JESUS, THE CHRIST',
  CHRIST: 'JESUS, THE CHRIST',
  MINISTER: 'MINISTER, CHRISTIAN',
  MINISTERS: 'MINISTER, CHRISTIAN',
  ANGEL: 'ANGEL (A SPIRIT)',
  ANGELS: 'ANGEL (A SPIRIT)',
  GRACE: 'GRACE OF GOD',
  'MINISTER, PRIME': 'MINISTER, CIVIL',
  // SHISHA "See SERIAH, number one": David's scribe Seraiah (2Sa 8:17), not Serah, which is
  // equally close by spelling.
  SERIAH: 'SERAIAH',
  'RAB-SHAKEH': 'RAB-SHAKEH (RABSHAKEH)',
  AFFILICTION: 'AFFLICTIONS AND ADVERSITIES',
  BACKSLIDING: 'BACKSLIDERS',
  DOUBT: 'DOUBTING',
  MIDWIFE: 'MIDWIFERY',
  'PRUNING-HOOK': 'PRUNING',
}
/** Levenshtein distance, stopping early once it is over `max`. */
function editDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      best = Math.min(best, cur[j])
    }
    if (best > max) return max + 1
    prev = cur
  }
  return prev[b.length]
}

function makeResolver(keys) {
  const exact = new Set(keys)
  const byCompact = new Map()
  for (const k of keys) if (!byCompact.has(compact(k))) byCompact.set(compact(k), k)
  const variants = (c) => [
    ...new Set([c, c.replace(/S$/, ''), c.replace(/ES$/, ''), c.replace(/IES$/, 'Y'), c.replace(/Y$/, 'IES'), c.replace(/MAN$/, 'MEN'), c + 'S', c + 'ES']),
  ]
  const tryOne = (t) => {
    if (exact.has(t)) return t
    if (ALIAS[t]) return ALIAS[t]
    const vs = variants(compact(t))
    for (const v of vs) if (byCompact.has(v)) return byCompact.get(v)
    // "ABSTINENCE" → "ABSTINENCE, TOTAL", "ENON" → "ENON (AENON)", "SYMBOL" → "SYMBOLS AND SIMILITUDES"
    const plain = t.replace(/[^A-Z ]/g, '')
    const forms = [...new Set([plain, plain.replace(/S$/, ''), plain + 'S'])]
    // "X (…)" is preferred to "X, …", then "X …": "DEAD" → "DEAD (PEOPLE)", not "DEAD SEA".
    const rank = (k) => {
      const f = forms.find((f) => k.startsWith(f + ' ') || k.startsWith(f + ','))
      if (!f) return -1
      return k[f.length] === ',' ? 1 : k[f.length + 1] === '(' ? 0 : 2
    }
    const longer = keys.filter((k) => rank(k) >= 0)
    if (longer.length) return longer.sort((a, b) => rank(a) - rank(b) || a.length - b.length)[0]
    // Misspellings: "PERSERVERANCE", "ZERUBBABAL", "JUDGEMENT" (at most 2 letters off)
    const c = compact(t)
    if (c.length >= 5) {
      let best = null
      const limit = c.length >= 8 ? 2 : 1
      for (const [kc, k] of byCompact) {
        if (kc[0] !== c[0]) continue // "REASON" is not "TREASON"
        const d = editDistance(c, kc, limit)
        if (d <= limit && (!best || d < best.d)) best = { k, d }
      }
      if (best) return best.k
    }
    return null
  }
  /** target = the link's key; after = the text right after it (", FEAST OF") */
  return (target, after) => {
    const t = target.trim().toUpperCase()
    const tail = after.match(/^,\s*([A-Z][A-Z ,'-]*[A-Z])/)
    if (tail && exact.has(`${t}, ${tail[1]}`)) return `${t}, ${tail[1]}`
    const hit = tryOne(t)
    if (hit) return hit
    // "GOD, PROVIDENCE OF" → "GOD"; "FAITH IN CHRIST" → "FAITH"; "FALSE WITNESS" → "WITNESS, FALSE";
    // "JOHN THE BAPTIST" → "JOHN"; "PRAYER ANSWERED" → "PRAYER"
    const words = t.split(/\s+/)
    if (words.length === 2 && exact.has(`${words[1]}, ${words[0]}`)) return `${words[1]}, ${words[0]}`
    const head = t.split(/,| OF | IN | FOR | AND | TO | THE /)[0].trim()
    if (head && head !== t) {
      const h = tryOne(head)
      if (h) return h
    }
    if (words.length > 1 && exact.has(words[0])) return words[0]
    return null
  }
}

// ---- Build --------------------------------------------------------------------------

const { conf, records } = await loadModule()
console.log(`Nave v${conf.Version}: ${records.length} entries`)

// Merge duplicate headwords (REVERENCE and SIN appear twice).
const entries = []
const byKey = new Map()
for (const r of records) {
  const n = r.body.match(/<entryFree n="([^"]*)"/)?.[1] ?? r.key
  if (byKey.has(r.key)) byKey.get(r.key).bodies.push(r.body)
  else {
    const e = { key: r.key, n, bodies: [r.body] }
    byKey.set(r.key, e)
    entries.push(e)
  }
}
const resolve = makeResolver(entries.map((e) => e.key))
const idOfKey = new Map()
{
  const used = new Set()
  for (const e of entries) {
    let id = slugify(e.key) || 'topic'
    while (used.has(id)) id += '-2'
    used.add(id)
    idOfKey.set(e.key, id)
  }
}

const topics = []
const seeStats = { links: 0, resolved: 0, unresolved: new Map() }
for (const e of entries) {
  currentKey = e.key
  const id = idOfKey.get(e.key)
  const subtopics = []
  const seeAlso = []
  for (const body of e.bodies) {
    for (const line of entryLines(body)) {
      // See-also links: <ref target="Nave:GOD">GOD</ref>, GRACE OF
      let html = line.html
      const lineSee = []
      html = html.replace(/<ref target="Nave:([^"]*)">([^<]*)<\/ref>([^<]*)/g, (_, target, shown, after) => {
        seeStats.links++
        const k = resolve(decodeEntities(target), decodeEntities(after))
        if (VERBOSE && k && k !== target) console.log(`  see-also "${target}" → "${k}"`)
        if (k && idOfKey.has(k)) {
          seeStats.resolved++
          const sid = idOfKey.get(k)
          if (sid !== id) {
            if (!seeAlso.includes(sid)) seeAlso.push(sid)
            if (!lineSee.includes(sid)) lineSee.push(sid)
          }
        } else {
          seeStats.unresolved.set(target, (seeStats.unresolved.get(target) ?? 0) + 1)
        }
        return shown + after
      })
      const text = cleanText(decodeEntities(html.replace(/<[^>]+>/g, '')))
      const { refs, spans } = findRefs(text)
      const label = tidyCaps(makeLabel(text, spans)).replace(/;(?=\S)/g, '; ')
      if (!label && !refs.length) continue
      const sub = { label, refs }
      if (line.level) sub.level = line.level
      if (lineSee.length) sub.seeAlso = lineSee
      subtopics.push(sub)
    }
  }
  const name = displayName(e.key, e.n)
  const count = subtopics.reduce((n, s) => n + s.refs.length, 0)
  const t = { id, name, subtopics }
  if (seeAlso.length) t.seeAlso = seeAlso
  topics.push({ topic: t, count })
}

// ---- Write files ------------------------------------------------------------------

rmSync(OUT, { recursive: true, force: true })
mkdirSync(join(OUT, 'byVerse'), { recursive: true })

const sortName = (a, b) => a.topic.name.localeCompare(b.topic.name, 'en', { sensitivity: 'base' }) || a.topic.id.localeCompare(b.topic.id)
topics.sort(sortName)
writeFileSync(join(OUT, 'index.json'), JSON.stringify(topics.map(({ topic, count }) => ({ id: topic.id, name: topic.name, count }))))

const byLetter = new Map()
for (const { topic } of topics) {
  const letter = topic.id[0]
  if (!byLetter.has(letter)) byLetter.set(letter, [])
  byLetter.get(letter).push(topic)
}
for (const [letter, list] of byLetter) writeFileSync(join(OUT, `${letter}.json`), JSON.stringify(list))

// byVerse: book → chapter → verse → Map(topic id → smallest passage length citing it)
const verseMap = new Map()
const countOf = new Map(topics.map(({ topic, count }) => [topic.id, count]))
const note = (book, ch, v, id, span) => {
  if (!verseMap.has(book)) verseMap.set(book, new Map())
  const chs = verseMap.get(book)
  if (!chs.has(ch)) chs.set(ch, new Map())
  const vs = chs.get(ch)
  if (!vs.has(v)) vs.set(v, new Map())
  const m = vs.get(v)
  if (!m.has(id) || m.get(id) > span) m.set(id, span)
}
for (const { topic } of topics) {
  for (const s of topic.subtopics) {
    for (const r of s.refs) {
      if (r.startVerse === undefined) {
        for (let c = r.startChapter; c <= r.endChapter; c++) note(r.book, c, 0, topic.id, versesIn(r.book, c))
        continue
      }
      let total = 0
      for (let c = r.startChapter; c <= r.endChapter; c++) {
        const a = c === r.startChapter ? r.startVerse : 1
        const z = c === r.endChapter ? r.endVerse : versesIn(r.book, c)
        total += z - a + 1
      }
      for (let c = r.startChapter; c <= r.endChapter; c++) {
        const a = c === r.startChapter ? r.startVerse : 1
        const z = c === r.endChapter ? r.endVerse : versesIn(r.book, c)
        if (total > MAX_EXPAND) note(r.book, c, 0, topic.id, total)
        else for (let v = a; v <= z; v++) note(r.book, c, v, topic.id, total)
      }
    }
  }
}
let verseLinks = 0
for (const b of BOOKS) {
  const chs = verseMap.get(b.id) ?? new Map()
  const out = {}
  for (const ch of [...chs.keys()].sort((x, y) => x - y)) {
    const vs = chs.get(ch)
    const o = {}
    for (const v of [...vs.keys()].sort((x, y) => x - y)) {
      const m = vs.get(v)
      // Most specific first; then bigger (more central) topics first.
      o[v] = [...m.keys()].sort((x, y) => m.get(x) - m.get(y) || countOf.get(y) - countOf.get(x) || x.localeCompare(y))
      verseLinks += o[v].length
    }
    out[ch] = o
  }
  writeFileSync(join(OUT, 'byVerse', `${b.id}.json`), JSON.stringify(out))
}

const totalRefs = topics.reduce((n, t) => n + t.count, 0)
writeFileSync(
  join(OUT, 'meta.json'),
  JSON.stringify({
    title: "Nave's Topical Bible",
    author: 'Orville J. Nave',
    year: 1896,
    license: 'Public Domain',
    credit: CREDIT,
    source: { module: MODULE.name, version: conf.Version, url: MODULE.url, sha256: MODULE.sha256, textSource: conf.TextSource },
    topics: topics.length,
    subtopics: topics.reduce((n, t) => n + t.topic.subtopics.length, 0),
    references: totalRefs,
    letters: [...byLetter.keys()].sort(),
    maxExpand: MAX_EXPAND,
  }),
)

// ---- Report ------------------------------------------------------------------------

const dirSize = (d) => readdirSync(d).reduce((n, f) => {
  const p = join(d, f)
  const s = statSync(p)
  return n + (s.isDirectory() ? dirSize(p) : s.size)
}, 0)
console.log(`Topics: ${topics.length}, subtopics: ${topics.reduce((n, t) => n + t.topic.subtopics.length, 0)}, references: ${totalRefs}`)
console.log(`References read: ${stats.refs}, dropped as impossible: ${stats.dropped}, range ends clamped: ${stats.clamped}`)
console.log(
  `See-also links: ${seeStats.links}, resolved: ${seeStats.resolved}, unresolved: ${seeStats.links - seeStats.resolved}` +
    (VERBOSE ? ' — ' + [...seeStats.unresolved.keys()].join(', ') : ''),
)
console.log(`Verse→topic links: ${verseLinks}`)
console.log(`Wrote ${(dirSize(OUT) / 1024 / 1024).toFixed(1)} MB to public/data/topics/`)
