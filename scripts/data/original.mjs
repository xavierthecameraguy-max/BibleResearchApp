// Builds the original-language (Hebrew, Aramaic and Greek) study data for
// Foundations: every word of the Bible in its original language with a
// transliteration, Strong's number, grammar code and English gloss, plus a
// brief lexicon, a list of where each word occurs, and a grammar-code decoder.
//
//   node scripts/data/original.mjs                         # build everything
//   node scripts/data/original.mjs --no-hebrew-meanings    # leave out the long Hebrew definitions (see licence note)
//
// SOURCE
//   STEPBible-Data by Tyndale House Cambridge, curated by STEPBible.org
//   https://github.com/STEPBible/STEPBible-Data, pinned to commit COMMIT below
//   (24 Oct 2026). Files used:
//     TAHOT  Translators Amalgamated Hebrew OT (4 files; Leningrad Codex text)
//     TAGNT  Translators Amalgamated Greek NT (2 files; NA27/28 + Textus Receptus words)
//     TBESH  Translators Brief lexicon of Extended Strongs for Hebrew
//     TBESG  Translators Brief lexicon of Extended Strongs for Greek
//     TEHMC / TEGMC  Translators Expansion of Hebrew / Greek Morphology Codes
//   Each download is checked against the git blob hash recorded below, so the
//   output is always built from exactly the same data.
//
// LICENCE
//   CC BY 4.0 (stated in the repository README and in the header of every
//   file). Credit: "STEP Bible" linked to https://www.STEPBible.org, data
//   created by Tyndale House Cambridge. Changes made here: reformatted to
//   JSON, versification mapped to KJV verse numbers, HTML removed from the
//   definitions and long definitions shortened.
//   Note: TBESH says its "Meaning" column is based on the Abridged BDB by
//   Online Bible (Larry Pierce) and asks projects to get permission from
//   Online Bible before using those definitions. The app is for personal use;
//   pass --no-hebrew-meanings to leave them out (glosses are kept). The Greek
//   definitions are from Abbott-Smith's Manual Greek Lexicon (public domain,
//   1922), as edited by STEPBible. The English glosses in TAGNT are based on
//   the Berean Study Bible (public domain since 2023).
//
// OUTPUT (public/data/original/, compact JSON; numbers are plain numbers and
// books are USFM ids like GEN, 1CO, REV)
//   words/<BOOK>.json   {"b":"GEN","c":[chapter1, chapter2, ...]}
//       chapterN = array indexed by verse number (index 0 = verse 0, which only
//       holds Psalm titles; it is [] otherwise). Each verse = array of words in
//       original order. Each word = an array:
//         [text, translit, strong, morph, gloss, sense?, flag?, also?]
//         text     original word. Hebrew keeps "/" between prefix, root and
//                  suffix pieces (e.g. "בְּ/רֵאשִׁ֖ית"); Greek has no "/".
//         translit simple transliteration ("bereshit", "egapesen")
//         strong   Strong's number of the root word, no leading zeros ("H7225", "G2316")
//         morph    STEPBible grammar code ("HR/Ncfsa", "HVqp3ms", "V-AAI-3S");
//                  "/" splits Hebrew pieces, "+" splits merged Greek words
//         gloss    English gloss; for Hebrew "/" lines up with the pieces of text
//         sense    letter(s) of STEPBible's extended Strong's, e.g. "G" means H7225G ("" if none)
//         flag     "" normal, "K" Greek word only in the KJV's Greek text (Textus
//                  Receptus), "N" Greek word only in modern critical texts (NA27/28),
//                  "X" Hebrew words supplied from the Septuagint (not in the KJV)
//         also     extra root Strong's for words that merge two roots, space separated ("G2532")
//       Trailing optional fields are left out. Verse numbers follow the KJV
//       (STEPBible's own KJV mapping is used where it differs from the NRSV).
//   lexicon/<H|G><bucket>.json   bucket = floor(number / 500), e.g. H430 -> H0.json, G2316 -> G4.json
//       { "H430": { "id":"H430G", "lemma":"אֱלֹהִים", "translit":"elohim", "gloss":"God",
//                   "definition":"...", "pos":"Hebrew noun, masculine",
//                   "senses":[ {"id":"H430H", "gloss":"...", "definition":"..."} ] } }
//       id is the main extended Strong's; senses lists the other extended
//       numbers (people/places sharing a name, or distinct meanings).
//   occurrences/<H|G><bucket>.json   same buckets
//       { "H430": { "count": 2601, "refs": [1001001, ...], "forms": {"H430G": 2598, ...} } }
//       refs are unique verses as BBCCCVVV (BB = book number 1-66 in BOOKS order,
//       CCC = chapter, VVV = verse), sorted; count = number of word occurrences.
//       forms (only when more than one) = occurrences per extended Strong's.
//   morph.json   { "HVqp3ms": ["Hebrew verb, Qal stem, perfect, 3rd person masculine singular",
//                              "<what the form means>", "<example>"], "V-AAI-3S": [...] }
//       Hebrew/Aramaic keys are single pieces with their language letter
//       (the "Ncfsa" in "HR/Ncfsa" is looked up as "HNcfsa").
//   meta.json    source, licence, commit and counts.

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BOOKS, getBook, findBook } from '../../src/lib/books.ts'

const COMMIT = 'be4191f0082aeedddb0eff0c02c966292b2bd641'
const REPO = 'https://github.com/STEPBible/STEPBible-Data'
const RAW = `https://raw.githubusercontent.com/STEPBible/STEPBible-Data/${COMMIT}/`

// path in the repository -> git blob hash at COMMIT (from `git ls-tree`)
const FILES = {
  tahot1: ['Translators Amalgamated OT+NT/TAHOT Gen-Deu - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt', 'eb051292f8cee648c4f3eaf1b48cd0f1f30dc1d5'],
  tahot2: ['Translators Amalgamated OT+NT/TAHOT Jos-Est - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt', 'e3824344f6dea1a3f51932d1b0a53537c3c2023e'],
  tahot3: ['Translators Amalgamated OT+NT/TAHOT Job-Sng - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt', '2eee6774c609eb1313ace03d202e85556d4e4f15'],
  tahot4: ['Translators Amalgamated OT+NT/TAHOT Isa-Mal - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt', '1cfe6718a1dae0d5d45a57a942d3f7f716ac6342'],
  tagnt1: ['Translators Amalgamated OT+NT/TAGNT Mat-Jhn - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt', '705c1bc1cf752e013efcef99b8d9a3b7853bf843'],
  tagnt2: ['Translators Amalgamated OT+NT/TAGNT Act-Rev - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt', '4bbea2c14681b01eb889d5a2d1dc0856858a32de'],
  tbesh: ['Lexicons/TBESH - Translators Brief lexicon of Extended Strongs for Hebrew - STEPBible.org CC BY.txt', 'a64990a674d13245ae1e9ed426bc69197c2fbad5'],
  tbesg: ['Lexicons/TBESG - Translators Brief lexicon of Extended Strongs for Greek - STEPBible.org CC BY.txt', 'efe271a1dbb73fa01f8fa6e0f164c6687757a9ae'],
  tehmc: ['Morphology codes/TEHMC - Translators Expansion of Hebrew Morphology Codes - STEPBible.org CC BY.txt', 'fa08a680ed8084e8041bdfd6e6ac6d93a00f2efb'],
  tegmc: ['Morphology codes/TEGMC - Translators Expansion of Greek Morphhology Codes - STEPBible.org CC BY.txt', '314ac3d791df69c0736b1df8aabca7ac0956b1e1'],
}

const NO_HEBREW_MEANINGS = process.argv.includes('--no-hebrew-meanings')
const BUCKET = 500
const MAX_DEFINITION = 900 // characters; longer definitions are cut at a line or sentence end

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const outDir = join(root, 'public', 'data', 'original')
const cacheDir = process.env.STEPBIBLE_CACHE || join(tmpdir(), `foundations-stepbible-${COMMIT.slice(0, 10)}`)

// ---------------------------------------------------------------- download

function blobHash(buf) {
  return createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex')
}

async function download(key) {
  const [path, hash] = FILES[key]
  const file = join(cacheDir, `${key}.txt`)
  if (existsSync(file)) {
    const buf = readFileSync(file)
    if (blobHash(buf) === hash) return buf.toString('utf8')
  }
  const url = RAW + path.split('/').map(encodeURIComponent).join('/')
  console.log(`Downloading ${path.split('/').pop()}…`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not download ${url}: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (blobHash(buf) !== hash) throw new Error(`${path} does not match the pinned version (blob ${hash})`)
  mkdirSync(cacheDir, { recursive: true })
  writeFileSync(file, buf)
  return buf.toString('utf8')
}

// ---------------------------------------------------------------- helpers

const BOOK_NUMBER = new Map(BOOKS.map((b, i) => [b.id, i + 1]))

function usfm(abbr) {
  const book = getBook(abbr.toUpperCase()) ?? findBook(abbr)
  if (!book) throw new Error(`Unknown book abbreviation ${abbr}`)
  return book.id
}

/** "H0430G" -> { base: "H430", sense: "G" }; null when it is not a Strong's number */
function splitStrong(s) {
  const m = /^([HG])0*(\d+)([A-Za-z]*)$/.exec(s.trim())
  if (!m) return null
  return { base: m[1] + m[2], sense: m[3] }
}

const refInt = (book, c, v) => BOOK_NUMBER.get(book) * 1_000_000 + c * 1000 + v

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&')
}

/** Lexicon HTML -> short plain text with line breaks */
function plainDefinition(html) {
  let s = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|li)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
  s = decodeEntities(s)
    .replace(/__/g, '')
    .replace(/^\s*:\s*/, '')
    .replace(/\s*\((AS|ML|MD)\)\s*$/, '')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
  if (s.length <= MAX_DEFINITION) return s
  const cut = s.slice(0, MAX_DEFINITION)
  const at = Math.max(cut.lastIndexOf('\n'), cut.lastIndexOf('. '), cut.lastIndexOf('; '))
  return (at > MAX_DEFINITION * 0.5 ? cut.slice(0, at + 1) : cut).trim() + ' …'
}

// Brief lexicon grammar ("H:N-M", "G:V", "N:N-M-P") -> plain English
const POS_TYPES = {
  a: 'adjective', adv: 'adverb', art: 'article', cond: 'conditional', conj: 'conjunction', cor: 'correlative',
  demp: 'demonstrative pronoun', impp: 'impersonal pronoun', indp: 'indefinite pronoun', intg: 'interrogative',
  intj: 'interjection', inj: 'interjection', n: 'noun', neg: 'negative', part: 'particle', prt: 'particle',
  prep: 'preposition', perp: 'personal pronoun', posp: 'possessive pronoun', refp: 'reflexive pronoun',
  relp: 'relative pronoun', v: 'verb', t: 'article', p: 'personal pronoun', r: 'relative pronoun',
  d: 'demonstrative pronoun', i: 'interrogative pronoun', k: 'correlative pronoun',
  q: 'correlative or interrogative pronoun', x: 'indefinite pronoun', s: 'possessive pronoun',
  f: 'reflexive pronoun', c: 'reciprocal pronoun',
}
const POS_EXTRA = {
  M: 'masculine', F: 'feminine', N: 'neuter', C: 'common', 'M/F': 'masculine or feminine', 'M/N': 'masculine or neuter',
  'F/N': 'feminine or neuter', CS: 'common singular', CP: 'common plural', MS: 'masculine singular',
  MP: 'masculine plural', FS: 'feminine singular', FP: 'feminine plural', L: 'place', P: 'person',
  LG: 'people of a place', PG: 'descendants of a person', T: 'title', TG: 'group title', LI: 'letter, indeclinable',
  PRI: 'proper name, indeclinable', NUI: 'number, indeclinable', I: 'interrogative', S: 'superlative',
  1: '1st person', 2: '2nd person', 3: '3rd person',
}
const POS_LANG = { H: 'Hebrew', A: 'Aramaic', G: 'Greek' }

function plainPos(code) {
  const one = (c) => {
    const m = /^([HAGN]):(.*)$/.exec(c.trim())
    if (!m) return c.trim().replace(/\.$/, '').toLowerCase()
    const [type, ...rest] = m[2].split('-')
    const t = POS_TYPES[type.toLowerCase()] ?? type.toLowerCase()
    const head = m[1] === 'N' ? (t === 'noun' ? 'proper name' : `proper name (${t})`) : `${POS_LANG[m[1]]} ${t}`
    const extra = rest.filter(Boolean).map((x) => POS_EXTRA[x] ?? (x === 'N' ? 'negative' : x.toLowerCase()))
    // "A--C" (comparative) uses an empty gender slot
    if (/--C$/.test(m[2])) extra.splice(extra.length - 1, 1, 'comparative')
    return [head, ...extra].join(', ')
  }
  if (!code.trim()) return undefined
  return code
    .split(/\s+\/\s+/)
    .map((alt) => alt.split(/\s*\+\s*/).map(one).join(' + '))
    .join(' or ')
}

// ---------------------------------------------------------------- lexicons

/** Map extended Strong's ("H430G") -> entry */
function parseLexicon(text, lang) {
  const out = new Map()
  for (const line of text.split(/\r?\n/)) {
    const c = line.split('\t')
    if (!/^[HG]\d{4,5}[A-Za-z]?$/.test(c[0]) || c.length < 8) continue
    const id = splitStrong(c[1].split(/\s*=/)[0])
    if (!id) continue
    const ext = id.base + id.sense
    if (out.has(ext)) continue
    const def = lang === 'H' && NO_HEBREW_MEANINGS ? '' : plainDefinition(c[7] ?? '')
    out.set(ext, {
      ext,
      base: id.base,
      lemma: c[3].trim(),
      translit: c[4].trim().replace(/\./g, ''),
      gloss: c[6].trim(),
      definition: def,
      pos: plainPos(c[5]),
    })
  }
  return out
}

// ---------------------------------------------------------------- morphology

/** TEHMC / TEGMC "FULL MORPHOLOGY CODES" blocks -> Map code -> {kv, summary, meaning, example} */
function parseMorphBlocks(text) {
  const out = new Map()
  const lines = text.split(/\r?\n/)
  let i = lines.findIndex((l) => /^FULL MORPHOLOGY CODES/.test(l))
  let cur = null
  for (; i < lines.length; i++) {
    const l = lines[i]
    if (l.startsWith('$')) {
      cur = null
      continue
    }
    const m = /^(\S+)\t(.*)$/.exec(l)
    if (m && !cur && m[2].includes('=')) {
      cur = { kv: m[2].trim(), lines: [] }
      out.set(m[1], cur)
    } else if (cur && l.startsWith('\t')) {
      cur.lines.push(plainMorphLine(l))
    }
  }
  return out
}

/** "Function=Verb ; Stem=Qal (hence Action=Simple; Voice=Active); ..." -> {Function: 'Verb', Stem: 'Qal', Mood: 'Active', ...} */
function parseKv(kv) {
  const out = {}
  let depth = 0
  let part = ''
  const parts = []
  for (const ch of kv) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ';' && depth === 0) {
      parts.push(part)
      part = ''
    } else part += ch
  }
  parts.push(part)
  for (const p of parts) {
    const eq = p.indexOf('=')
    if (eq < 0) continue
    const key = p.slice(0, eq).trim()
    let value = p.slice(eq + 1).trim()
    const hence = /\(hence (.*)\)/.exec(value)
    if (hence) {
      for (const h of hence[1].split(';')) {
        const [k, v] = h.split('=')
        if (k && v) out[`hence ${k.trim()}`] = v.trim()
      }
    }
    value = value.replace(/\s*\(.*\)\s*/, ' ').trim()
    if (!value) continue
    out[key] = out[key] && out[key] !== value ? `${out[key]} ${value}` : value
  }
  return out
}

const ORDINAL = { First: '1st', Second: '2nd', Third: '3rd' }
const HEB_GENDER = { Masculine: 'masculine', Feminine: 'feminine', 'Either gender': 'common', Location: 'place', Title: 'title' }

function describeHebrew(code, kv) {
  const lang = code[0] === 'A' ? 'Aramaic' : 'Hebrew'
  const fn = (kv.Function ?? '').toLowerCase()
  let form = (kv.Form ?? '').replace(/\s*\(Hebrew\)/, '')
  const out = []
  const pgn = [kv.Person && `${ORDINAL[kv.Person] ?? kv.Person} person`, HEB_GENDER[kv.Gender] ?? kv.Gender?.toLowerCase(), kv.Number?.toLowerCase()]
    .filter(Boolean)
    .join(' ')
  let state = kv.State?.toLowerCase()
  if (fn === 'verb') {
    out.push(`${lang} verb`)
    if (kv.Stem) out.push(`${kv.Stem} stem`)
    if (form === 'Infinitive' && state) {
      form = `Infinitive ${state}`
      state = undefined
    }
    let f = form.toLowerCase().replace('conjunction+imperfect', 'imperfect with conjunction')
    const mood = kv['hence Mood']
    if (mood === 'Jussive' || mood === 'Cohortative') f += ` (${mood.toLowerCase()})`
    if (f) out.push(f)
  } else if (fn === 'particle') {
    const names = { 'Definite article': 'definite article', 'Object indicator': 'direct object marker', Interjection: 'interjection' }
    out.push(`${lang} ${names[form] ?? `${form.toLowerCase()} particle`}`.replace(/\s+/g, ' '))
  } else if (fn === 'suffix') {
    const names = {
      Directional: 'directional suffix (toward)',
      'Paragogic Hé': 'paragogic he suffix',
      'Paragogic Nun': 'paragogic nun suffix',
      Personal: 'pronoun suffix',
      Definite: 'definite (emphatic) suffix',
    }
    out.push(`${lang} ${names[form] ?? `${form.toLowerCase()} suffix`}`)
  } else if (fn === 'conjunction' && form === 'Consecutive') {
    out.push(`${lang} conjunction (consecutive)`)
  } else {
    const names = { Numerical: 'number', 'Numerical position': 'ordinal number' }
    const f = form && fn === 'adjective' && names[form] ? names[form] : form ? `${form.toLowerCase()} ${fn}` : fn
    out.push(`${lang} ${f}`)
  }
  if (pgn) out.push(pgn)
  if (state) out.push(state)
  return out.join(', ')
}

const GRK_FUNCTION = {
  'Adverb or adverb and particle combined': 'adverb',
  'Particle or Disjunctive': 'particle',
  'Indeclinable Noun of Other type': 'indeclinable noun',
  'Indeclinable Proper Noun': 'indeclinable proper noun',
  'Aramaic transliterated word': 'Aramaic word (transliterated)',
  'Demonstrative pronoun+Conjunction': 'demonstrative pronoun merged with conjunction',
}

/** Lower-case a phrase but keep language names capitalised */
const lc = (s) => s.toLowerCase().replace(/\b(hebrew|aramaic|greek|attic|aeolic)\b/g, (w) => w[0].toUpperCase() + w.slice(1))

function describeGreek(kv) {
  const fn = GRK_FUNCTION[kv.Function] ?? lc(kv.Function ?? 'word')
  const out = [`Greek ${fn}`]
  const verbal = lc([kv.Tense, kv.Voice, kv.Mood ?? kv.Form].filter(Boolean).join(' '))
  if (verbal) out.push(verbal)
  const person = /(1st|2nd|3rd)/.exec(kv.Person ?? '')?.[1]
  // nouns, adjectives, participles: case gender number; finite verbs: person number
  const cgn = kv.Case ? lc([kv.Case, kv.Gender, kv.Number].filter(Boolean).join(' ')) : ''
  if (person) out.push(cgn ? `${person} person` : [`${person} person`, kv.Number && lc(kv.Number)].filter(Boolean).join(' '))
  else if (!cgn && kv.Number) out.push(lc(kv.Number))
  if (cgn) out.push(cgn)
  const extras = new Set(
    [kv.Extra, kv['Name type'], kv['Original language'], kv['Name in Original language'], kv['Adj.Numb.']]
      .filter(Boolean)
      .map(lc),
  )
  // "Negative Particle" already says negative
  for (const e of extras) if (!fn.toLowerCase().includes(e.toLowerCase())) out.push(e)
  return out.join(', ')
}

/** Tidy STEPBible's explanation / example lines into plain text */
function plainMorphLine(line) {
  let s = line.trim().replace(/^Example:\s*/, '').replace(/‚/g, ',')
  // "giving to, rich _and_ poor": "and"  ->  giving to, rich “and” poor
  const pair = /^"(.*)":\s*"(.*)"$/.exec(s)
  if (pair) s = pair[1]
  s = s.replace(/^"(.*)"$/, '$1').replace(/"/g, '')
  s = s.replace(/_\s*([^_]*?)\s*_/g, '“$1”').replace(/_/g, '')
  // STEPBible writes key words in capitals for emphasis
  s = s.replace(/\b[A-Z]{2,}\b/g, (w) => w.toLowerCase())
  s = s.replace(/\s+/g, ' ').trim()
  return /[\p{L}\p{N}]/u.test(s) ? s : ''
}

// ---------------------------------------------------------------- texts

const books = new Map() // USFM id -> chapters: (word[][] | undefined)[]
const occ = new Map() // base strong -> { count, refs:Set, forms:Map }
const hebMorph = new Map() // code piece -> uses
const grkMorph = new Map()
const usedExt = new Map() // ext strong -> uses
const stats = { hebrewWords: 0, greekWords: 0, skippedPlaceholders: 0, skippedOtherGreek: 0, noStrong: 0 }

function addWord(book, c, v, word, roots) {
  if (!books.has(book)) books.set(book, [])
  const chapters = books.get(book)
  const verses = (chapters[c - 1] ??= [])
  ;(verses[v] ??= []).push(word)
  const ref = refInt(book, c, v)
  for (const ext of roots) {
    const s = splitStrong(ext)
    if (!s) continue
    const key = s.base + s.sense
    usedExt.set(key, (usedExt.get(key) ?? 0) + 1)
    let o = occ.get(s.base)
    if (!o) occ.set(s.base, (o = { count: 0, refs: new Set(), forms: new Map() }))
    o.count++
    o.refs.add(ref)
    o.forms.set(key, (o.forms.get(key) ?? 0) + 1)
  }
}

/** Remove trailing empty optional fields from a word array */
function trimWord(w) {
  while (w.length > 5 && (w[w.length - 1] === '' || w[w.length - 1] == null)) w.pop()
  return w
}

const REF = /^([1-3A-Z][A-Za-z][a-z])\.(\d+)\.(\d+)((?:[[({][^\])}]*[\])}])*)#(\d+)=(.*)$/

function parseHebrew(text) {
  for (const line of text.split(/\r?\n/)) {
    const c = line.split('\t')
    const m = REF.exec(c[0])
    if (!m) continue
    const [, abbr, ch, vs, , , type] = m
    const hebrew = c[1].trim()
    if (!hebrew) {
      // a Ketiv word the Qere leaves unread: nothing is translated here
      stats.skippedPlaceholders++
      continue
    }
    const textClean = hebrew
      .replace(/\/ \/|\/\//g, ' ')
      .replace(/\\ \\[פס׆]/g, '')
      .replace(/\\׀/g, ' ׀')
      .replace(/\\/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    const translit = c[2]
      .replace(/\/ \/|\/\//g, ' ')
      .replace(/[./\\]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
    const gloss = c[3].replace(/\/ \/|\/\//g, ' ').replace(/\s+/g, ' ').trim()
    const strongs = c[4]
    let roots = [...strongs.matchAll(/\{([HG]\d+[A-Za-z]*)\}/g)].map((x) => x[1])
    if (!roots.length) roots = [...strongs.matchAll(/H\d+[A-Za-z]*/g)].map((x) => x[0]).filter((s) => +s.slice(1, 5) < 9000)
    const morph = c[5].trim()
    const pieces = morph.split('/')
    const lang = pieces[0][0]
    pieces.forEach((p, i) => {
      if (!p) return
      const key = i ? lang + p : p
      hebMorph.set(key, (hebMorph.get(key) ?? 0) + 1)
    })
    const first = roots.length ? splitStrong(roots[0]) : null
    if (!first) stats.noStrong++
    const flag = type.startsWith('X') ? 'X' : ''
    const also = roots.slice(1).map((r) => {
      const s = splitStrong(r)
      return s ? s.base + s.sense : r
    })
    const book = usfm(abbr)
    addWord(book, +ch, +vs, trimWord([textClean, translit, first?.base ?? '', morph, gloss, first?.sense ?? '', flag, also.join(' ')]), roots)
    stats.hebrewWords++
  }
}

function parseGreek(text) {
  for (const line of text.split(/\r?\n/)) {
    const c = line.split('\t')
    const m = REF.exec(c[0])
    if (!m) continue
    const [, abbr, ch, vs, brackets, , type] = m
    const inN = /[Nn]/.test(type)
    const inK = /[Kk]/.test(type)
    if (!inN && !inK) {
      // only in "other" editions, which almost no translation follows
      stats.skippedOtherGreek++
      continue
    }
    // [c.v] gives the KJV reference when it differs from the NRSV numbering
    const kjv = /\[(\d+)\.(\d+)\]/.exec(brackets)
    const chapter = kjv ? +kjv[1] : +ch
    const verse = kjv ? +kjv[2] : +vs
    const gm = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(c[1].trim())
    const word = (gm ? gm[1] : c[1]).replace(/¶/g, '').trim()
    const translit = gm ? gm[2].trim() : ''
    const gloss = c[2].replace(/^\[\d+(?:[.:]\d+)?[a-z]?\]\s*/, '').trim() // drop verse-number markers like "[13.1] And"
    const parts = c[3].split(/\s*\+\s*/).map((p) => {
      const [s, g] = p.split('=')
      return { strong: (s ?? '').trim(), morph: (g ?? '').trim() }
    })
    for (const p of parts) if (p.morph) grkMorph.set(p.morph, (grkMorph.get(p.morph) ?? 0) + 1)
    const roots = parts.map((p) => p.strong).filter(Boolean)
    const first = roots.length ? splitStrong(roots[0]) : null
    if (!first) stats.noStrong++
    const flag = inN && inK ? '' : inN ? 'N' : 'K'
    const also = roots.slice(1).map((r) => {
      const s = splitStrong(r)
      return s ? s.base + s.sense : r
    })
    const morph = parts.map((p) => p.morph).join('+')
    addWord(usfm(abbr), chapter, verse, trimWord([word, translit, first?.base ?? '', morph, gloss, first?.sense ?? '', flag, also.join(' ')]), roots)
    stats.greekWords++
  }
}

// ---------------------------------------------------------------- build

const t0 = Date.now()
const src = {}
for (const key of Object.keys(FILES)) src[key] = await download(key)

console.log('Reading the Hebrew Old Testament…')
for (const k of ['tahot1', 'tahot2', 'tahot3', 'tahot4']) parseHebrew(src[k])
console.log('Reading the Greek New Testament…')
for (const k of ['tagnt1', 'tagnt2']) parseGreek(src[k])

console.log('Reading the lexicons and grammar codes…')
const lexH = parseLexicon(src.tbesh, 'H')
const lexG = parseLexicon(src.tbesg, 'G')
const tehmc = parseMorphBlocks(src.tehmc)
const tegmc = parseMorphBlocks(src.tegmc)

rmSync(outDir, { recursive: true, force: true })
for (const d of ['words', 'lexicon', 'occurrences']) mkdirSync(join(outDir, d), { recursive: true })

// words/<BOOK>.json
for (const b of BOOKS) {
  const chapters = books.get(b.id)
  if (!chapters) throw new Error(`No words found for ${b.id}`)
  const c = []
  for (let i = 0; i < b.chapters; i++) {
    const verses = chapters[i] ?? []
    const out = []
    for (let v = 0; v < verses.length; v++) out.push(verses[v] ?? [])
    if (!out.length) out.push([])
    c.push(out)
  }
  if (chapters.length > b.chapters) console.warn(`  ${b.id}: words found beyond chapter ${b.chapters}`)
  writeFileSync(join(outDir, 'words', `${b.id}.json`), JSON.stringify({ b: b.id, c }))
}

// lexicon buckets: every Hebrew entry, and Greek entries that are classic
// Strong's numbers (1-5624) or that occur in the New Testament text
const bucketName = (base) => `${base[0]}${Math.floor(+base.slice(1) / BUCKET)}`
const lexBuckets = new Map()
const missingLex = new Set()
for (const [lang, lex] of [['H', lexH], ['G', lexG]]) {
  const byBase = new Map()
  for (const e of lex.values()) {
    if (!byBase.has(e.base)) byBase.set(e.base, [])
    byBase.get(e.base).push(e)
  }
  for (const [base, entries] of byBase) {
    const num = +base.slice(1)
    if (lang === 'G' && num > 5624 && !occ.has(base)) continue
    // the main sense is the one used most in the text (or the first listed)
    const ranked = [...entries].sort((a, b) => (usedExt.get(b.ext) ?? 0) - (usedExt.get(a.ext) ?? 0))
    const main = (usedExt.get(ranked[0].ext) ?? 0) > 0 ? ranked[0] : entries[0]
    const entry = { id: main.ext, lemma: main.lemma, translit: main.translit, gloss: main.gloss, definition: main.definition }
    if (main.pos) entry.pos = main.pos
    const senses = entries
      .filter((e) => e !== main)
      .map((e) => {
        const s = { id: e.ext }
        if (e.lemma !== main.lemma) s.lemma = e.lemma
        if (e.translit !== main.translit) s.translit = e.translit
        s.gloss = e.gloss
        if (e.definition) s.definition = e.definition
        if (e.pos && e.pos !== main.pos) s.pos = e.pos
        return s
      })
    if (senses.length) entry.senses = senses
    const name = bucketName(base)
    if (!lexBuckets.has(name)) lexBuckets.set(name, {})
    lexBuckets.get(name)[base] = entry
  }
}
for (const ext of usedExt.keys()) {
  const s = splitStrong(ext)
  if (!(s.base[0] === 'H' ? lexH : lexG).has(ext) && !lexBuckets.get(bucketName(s.base))?.[s.base]) missingLex.add(ext)
}
const sortKeys = (obj) => Object.fromEntries(Object.entries(obj).sort((a, b) => +a[0].slice(1) - +b[0].slice(1)))
for (const [name, obj] of lexBuckets) writeFileSync(join(outDir, 'lexicon', `${name}.json`), JSON.stringify(sortKeys(obj)))

// occurrences buckets
const occBuckets = new Map()
for (const [base, o] of occ) {
  const name = bucketName(base)
  if (!occBuckets.has(name)) occBuckets.set(name, {})
  const entry = { count: o.count, refs: [...o.refs].sort((a, b) => a - b) }
  if (o.forms.size > 1) entry.forms = Object.fromEntries([...o.forms].sort((a, b) => b[1] - a[1]))
  occBuckets.get(name)[base] = entry
}
for (const [name, obj] of occBuckets) writeFileSync(join(outDir, 'occurrences', `${name}.json`), JSON.stringify(sortKeys(obj)))

// morph.json: every grammar code used in the texts
const morph = {}
const missingMorph = []
for (const [code] of [...hebMorph].sort((a, b) => b[1] - a[1])) {
  const block = tehmc.get(code)
  if (!block) {
    missingMorph.push(code)
    continue
  }
  morph[code] = [describeHebrew(code, parseKv(block.kv)), block.lines[1] ?? '', block.lines[2] ?? '']
}
for (const [code] of [...grkMorph].sort((a, b) => b[1] - a[1])) {
  const block = tegmc.get(code)
  if (!block) {
    missingMorph.push(code)
    continue
  }
  morph[code] = [describeGreek(parseKv(block.kv)), block.lines[1] ?? '', block.lines[2] ?? '']
}
writeFileSync(join(outDir, 'morph.json'), JSON.stringify(morph))

// meta.json
const meta = {
  name: 'Original-language words, lexicon and grammar (Hebrew, Aramaic, Greek)',
  source: 'STEPBible-Data (TAHOT, TAGNT, TBESH, TBESG, TEHMC, TEGMC)',
  creator: 'Tyndale House Cambridge, curated by STEPBible.org',
  url: REPO,
  commit: COMMIT,
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  credit: 'Original-language data from STEP Bible (www.STEPBible.org), created by Tyndale House Cambridge, CC BY 4.0.',
  notes: [
    'Reformatted to JSON, verse numbers mapped to the KJV, HTML removed and long definitions shortened.',
    'Hebrew definitions are based on the Abridged BDB by Online Bible (Larry Pierce); Greek definitions on Abbott-Smith, Manual Greek Lexicon of the New Testament.',
    'Greek glosses are based on the Berean Study Bible.',
  ],
  hebrewMeanings: !NO_HEBREW_MEANINGS,
  built: new Date().toISOString().slice(0, 10),
  counts: {
    hebrewWords: stats.hebrewWords,
    greekWords: stats.greekWords,
    lexiconEntries: [...lexBuckets.values()].reduce((n, b) => n + Object.keys(b).length, 0),
    strongsWithOccurrences: occ.size,
    morphCodes: Object.keys(morph).length,
  },
}
writeFileSync(join(outDir, 'meta.json'), JSON.stringify(meta, null, 1))

// ---------------------------------------------------------------- report

// Compare verse numbers with the bundled KJV, if it is there
const kjvDir = join(root, 'public', 'bible', 'kjv')
if (existsSync(kjvDir)) {
  const extra = []
  const empty = []
  for (const b of BOOKS) {
    const file = join(kjvDir, `${b.id}.json`)
    if (!existsSync(file)) continue
    const kjv = JSON.parse(readFileSync(file, 'utf8'))
    const chapters = books.get(b.id) ?? []
    kjv.chapters.forEach((verses, i) => {
      const have = new Set(verses.map((v) => v.v))
      const words = chapters[i] ?? []
      words.forEach((w, v) => {
        if (w?.length && v > 0 && !have.has(v)) extra.push(`${b.id} ${i + 1}:${v}`)
      })
      for (const v of have) if (!words[v]?.length) empty.push(`${b.id} ${i + 1}:${v}`)
    })
  }
  console.log(`KJV check: ${extra.length} verses with words but not in the KJV${extra.length ? ' (' + extra.slice(0, 20).join(', ') + ')' : ''}`)
  console.log(`           ${empty.length} KJV verses with no words${empty.length ? ' (' + empty.slice(0, 20).join(', ') + ')' : ''}`)
}

function dirSize(d) {
  let n = 0
  for (const f of readdirSync(d)) {
    const p = join(d, f)
    const s = statSync(p)
    n += s.isDirectory() ? dirSize(p) : s.size
  }
  return n
}
const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`
console.log(
  `Words: ${stats.hebrewWords} Hebrew/Aramaic, ${stats.greekWords} Greek (skipped ${stats.skippedPlaceholders} unread Ketiv placeholders, ${stats.skippedOtherGreek} Greek words found only in minor editions, ${stats.noStrong} words without a Strong's number)`,
)
console.log(`Lexicon: ${meta.counts.lexiconEntries} entries in ${lexBuckets.size} files; ${missingLex.size} extended numbers used in the text have no entry${missingLex.size ? ' (' + [...missingLex].slice(0, 15).join(' ') + ')' : ''}`)
console.log(`Occurrences: ${occ.size} Strong's numbers in ${occBuckets.size} files`)
console.log(`Morphology: ${Object.keys(morph).length} codes${missingMorph.length ? `, ${missingMorph.length} without an explanation (${missingMorph.slice(0, 10).join(' ')})` : ''}`)
console.log(`Wrote ${outDir} (${mb(dirSize(outDir))}: words ${mb(dirSize(join(outDir, 'words')))}, lexicon ${mb(dirSize(join(outDir, 'lexicon')))}, occurrences ${mb(dirSize(join(outDir, 'occurrences')))}) in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
