// Original-language study data: every word of the Bible in Hebrew, Aramaic or
// Greek with its transliteration, Strong's number, grammar and English gloss,
// plus a brief lexicon, where each word occurs, and plain-English
// explanations of the grammar codes.
//
// Source: STEPBible-Data by Tyndale House Cambridge, curated by STEPBible.org
// (https://github.com/STEPBible/STEPBible-Data), licensed CC BY 4.0. Credit
// "STEP Bible" with a link to https://www.STEPBible.org wherever this is
// shown (ORIGINAL_CREDIT below). Built by scripts/data/original.mjs, which
// documents the files used and the licence notes on the definitions.
//
// Files (fetched on demand from /data/original/ and kept in memory):
//   words/<BOOK>.json        one book: chapters -> verses (indexed by verse
//                            number, 0 = Psalm title) -> words in original order
//   lexicon/<H|G><n>.json    lexicon entries for Strong's numbers n*500 .. n*500+499
//   occurrences/<H|G><n>.json  verses where each Strong's number occurs (same buckets)
//   morph.json               grammar code -> [description, meaning, example]
// Verse numbers follow the KJV, so they line up with the app's KJV/WEB text.
// Every function returns null or [] when data is missing or offline.

import { BOOKS, findBook, getBook, type BookInfo } from '../books.ts'
import { publicUrl } from '../paths.ts'

const BASE = publicUrl('data/original')
const BUCKET_SIZE = 500

export const ORIGINAL_CREDIT = {
  name: 'STEP Bible',
  text: 'Hebrew, Aramaic and Greek data from STEP Bible (www.STEPBible.org), created by Tyndale House Cambridge, CC BY 4.0.',
  url: 'https://www.STEPBible.org',
  source: 'https://github.com/STEPBible/STEPBible-Data',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
} as const

// ---------------------------------------------------------------- types

export type OriginalLanguage = 'hebrew' | 'aramaic' | 'greek'

/**
 * Which text a word belongs to.
 * all    - in every main text
 * kjv    - Greek word found only in the Textus Receptus (the Greek behind the KJV)
 * modern - Greek word found only in modern critical texts (NA27/28)
 * lxx    - Hebrew words supplied from the Septuagint (not in the Hebrew text or the KJV)
 */
export type WordEdition = 'all' | 'kjv' | 'modern' | 'lxx'

export interface OriginalWord {
  /** 1-based position of the word in its verse */
  position: number
  /** The word as written, e.g. "בְּרֵאשִׁ֖ית" or "ἠγάπησεν" (Hebrew keeps vowel points and accents) */
  text: string
  /** Hebrew: prefix / root / suffix pieces, e.g. ["בְּ", "רֵאשִׁ֖ית"]; Greek: [text] */
  parts: string[]
  /** Simple transliteration, e.g. "bereshit", "ēgapēsen" */
  translit: string
  /** Strong's number of the root word, e.g. "H7225", "G2316" */
  strong: string
  /** STEPBible extended Strong's, e.g. "H7225G" (same as strong when it has no extra letter) */
  strongExt: string
  /** Other roots when one written word joins two (e.g. κἀγώ = "and" + "I"), extended form */
  alsoStrongs: string[]
  /** STEPBible grammar code, e.g. "HR/Ncfsa", "V-AAI-3S" (explainMorph turns it into English) */
  morph: string
  /** English gloss, e.g. "in beginning", "loved" */
  gloss: string
  /** Hebrew: the gloss split to line up with parts; Greek: [gloss] */
  glossParts: string[]
  language: OriginalLanguage
  edition: WordEdition
}

export interface VerseRef {
  /** USFM book id, e.g. "GEN" */
  book: string
  chapter: number
  verse: number
}

export interface LexiconSense {
  /** Extended Strong's for this sense, e.g. "H430G" */
  id: string
  lemma: string
  translit: string
  gloss: string
  /** Plain text, may contain line breaks */
  definition: string
  /** Part of speech in plain English, e.g. "Hebrew noun, masculine" */
  pos?: string
}

export interface LexiconEntry extends LexiconSense {
  /** Base Strong's number, e.g. "H430" */
  strong: string
  /** Every sense under this number, the main one first (people or places sharing a name, distinct meanings) */
  senses: LexiconSense[]
}

export interface Occurrences {
  /** Base Strong's number, e.g. "G26" */
  strong: string
  /** Number of times the word occurs (a verse can contain it more than once) */
  count: number
  /** Verses containing the word, in Bible order */
  refs: VerseRef[]
  /** Occurrences per extended Strong's; empty unless more than one sense is in use */
  forms: Record<string, number>
}

export interface MorphPart {
  /** Single code, e.g. "HNcfsa" (Hebrew pieces carry their language letter) or "V-AAI-3S" */
  code: string
  /** e.g. "Hebrew verb, Qal stem, perfect, 3rd person masculine singular" */
  description: string
  /** What the form means, e.g. "performing an action ... by a male person or thing being discussed" */
  meaning: string
  /** Example translation, e.g. "he/it did or does rise" */
  example: string
}

export interface MorphExplanation {
  code: string
  language: OriginalLanguage
  /** All pieces in one phrase, e.g. "Hebrew preposition + common noun, feminine singular, absolute" */
  description: string
  parts: MorphPart[]
}

// ---------------------------------------------------------------- raw file shapes

/** [text, translit, strong, morph, gloss, sense?, flag?, also?] - see scripts/data/original.mjs */
type RawWord = [string, string, string, string, string, string?, string?, string?]
interface RawBook {
  b: string
  c: RawWord[][][]
}
interface RawLexSense {
  id: string
  lemma?: string
  translit?: string
  gloss: string
  definition?: string
  pos?: string
}
interface RawLexEntry {
  id: string
  lemma: string
  translit: string
  gloss: string
  definition: string
  pos?: string
  senses?: RawLexSense[]
}
interface RawOccurrences {
  count: number
  refs: number[]
  forms?: Record<string, number>
}
type MorphTable = Record<string, [string, string, string]>

// ---------------------------------------------------------------- fetching

const cache = new Map<string, Promise<unknown>>()

/** Fetch a JSON file once; failures resolve to null and are retried on the next call. */
function load<T>(path: string): Promise<T | null> {
  let p = cache.get(path) as Promise<T | null> | undefined
  if (!p) {
    p = fetch(`${BASE}/${path}`)
      .then((res) => (res.ok ? (res.json() as Promise<T>) : null))
      .catch(() => null)
    cache.set(path, p)
    void p.then((value) => {
      if (value === null) cache.delete(path)
    })
  }
  return p
}

function resolveBook(book: string): BookInfo | undefined {
  return getBook(book) ?? findBook(book)
}

// ---------------------------------------------------------------- Strong's numbers

export interface StrongNumber {
  /** "H430" */
  strong: string
  /** "H430G" (or "H430" when no letter was given) */
  ext: string
  /** "G", or "" */
  sense: string
  prefix: 'H' | 'G'
  number: number
}

/**
 * Accepts "H0430G", "h430", "G26", "G0026" ... Returns null for anything else.
 * The sense letter keeps its case: after A-Z STEPBible goes on with a-z, so
 * H5838x (King Azariah) and H5838X are different people.
 */
export function parseStrong(input: string): StrongNumber | null {
  const m = /^\s*([HhGg])0*(\d{1,5})([A-Za-z]?)\s*$/.exec(input)
  if (!m) return null
  const prefix = m[1].toUpperCase() as 'H' | 'G'
  const number = Number(m[2])
  const strong = `${prefix}${number}`
  const sense = m[3]
  return { strong, ext: strong + sense, sense, prefix, number }
}

const bucketOf = (s: StrongNumber) => `${s.prefix}${Math.floor(s.number / BUCKET_SIZE)}`

// ---------------------------------------------------------------- verse references

const BOOK_NUMBER = new Map(BOOKS.map((b, i) => [b.id, i + 1]))

/** BBCCCVVV integer (book number 1-66) -> reference */
export function decodeRef(n: number): VerseRef | null {
  const book = BOOKS[Math.floor(n / 1_000_000) - 1]
  if (!book) return null
  return { book: book.id, chapter: Math.floor(n / 1000) % 1000, verse: n % 1000 }
}

/** Reference -> BBCCCVVV integer, or null for an unknown book */
export function encodeRef(book: string, chapter: number, verse: number): number | null {
  const id = resolveBook(book)?.id
  const num = id ? BOOK_NUMBER.get(id) : undefined
  return num ? num * 1_000_000 + chapter * 1000 + verse : null
}

// ---------------------------------------------------------------- words

const EDITION: Record<string, WordEdition> = { '': 'all', K: 'kjv', N: 'modern', X: 'lxx' }
const chapterCache = new Map<string, OriginalWord[][]>()

function toWord(raw: RawWord, position: number, testament: 'OT' | 'NT'): OriginalWord {
  const [rawText, translit, strong, morph, rawGloss, sense = '', flag = '', also = ''] = raw
  const hebrew = testament === 'OT'
  const parts = hebrew ? rawText.split('/') : [rawText]
  const glossParts = hebrew ? rawGloss.split('/').map((g) => g.trim()) : [rawGloss]
  return {
    position,
    text: parts.join(''),
    parts,
    translit,
    strong,
    strongExt: strong + sense,
    alsoStrongs: also ? also.split(' ') : [],
    morph,
    gloss: hebrew ? glossParts.filter(Boolean).join(' ') : rawGloss,
    glossParts,
    language: hebrew ? (morph.startsWith('A') ? 'aramaic' : 'hebrew') : 'greek',
    edition: EDITION[flag] ?? 'all',
  }
}

/**
 * All the words of a chapter, as an array indexed by verse number
 * (index 0 holds a Psalm title when there is one, otherwise it is empty).
 */
export async function getChapterWords(book: string, chapter: number): Promise<OriginalWord[][]> {
  const info = resolveBook(book)
  if (!info || chapter < 1 || chapter > info.chapters) return []
  const key = `${info.id}.${chapter}`
  const hit = chapterCache.get(key)
  if (hit) return hit
  const data = await load<RawBook>(`words/${info.id}.json`)
  const verses = data?.c?.[chapter - 1]
  if (!verses) return []
  const words = verses.map((v) => v.map((w, i) => toWord(w, i + 1, info.testament)))
  chapterCache.set(key, words)
  return words
}

/** The words of one verse in original order (verse 0 = Psalm title). */
export async function getVerseWords(book: string, chapter: number, verse: number): Promise<OriginalWord[]> {
  const words = await getChapterWords(book, chapter)
  return words[verse] ?? []
}

// ---------------------------------------------------------------- lexicon

function senseOf(raw: RawLexSense, main: RawLexEntry): LexiconSense {
  const s: LexiconSense = {
    id: raw.id,
    lemma: raw.lemma ?? main.lemma,
    translit: raw.translit ?? main.translit,
    gloss: raw.gloss,
    definition: raw.definition ?? '',
  }
  const pos = raw.pos ?? main.pos
  if (pos) s.pos = pos
  return s
}

/**
 * Lexicon entry for a Strong's number. "H430" gives the main sense; an
 * extended number such as "H430H" gives that sense (falling back to the main
 * one). `senses` always lists every sense under the number.
 */
export async function getLexicon(strong: string): Promise<LexiconEntry | null> {
  const s = parseStrong(strong)
  if (!s) return null
  const bucket = await load<Record<string, RawLexEntry>>(`lexicon/${bucketOf(s)}.json`)
  const raw = bucket?.[s.strong]
  if (!raw) return null
  const main: LexiconSense = { id: raw.id, lemma: raw.lemma, translit: raw.translit, gloss: raw.gloss, definition: raw.definition }
  if (raw.pos) main.pos = raw.pos
  const senses = [main, ...(raw.senses ?? []).map((x) => senseOf(x, raw))]
  // exact sense first ("H5838x" is not "H5838X"); then ignore case, so a typed "h430g" still finds H430G
  const upper = s.ext.toUpperCase()
  const chosen = (s.sense && (senses.find((x) => x.id === s.ext) ?? senses.find((x) => x.id.toUpperCase() === upper))) || main
  return { ...chosen, strong: s.strong, senses }
}

// ---------------------------------------------------------------- occurrences

/** Every verse where a Strong's number occurs (extended letters are ignored: "H430G" counts as H430). */
export async function getOccurrences(strong: string): Promise<Occurrences | null> {
  const s = parseStrong(strong)
  if (!s) return null
  const bucket = await load<Record<string, RawOccurrences>>(`occurrences/${bucketOf(s)}.json`)
  const raw = bucket?.[s.strong]
  if (!raw) return null
  const refs: VerseRef[] = []
  for (const n of raw.refs) {
    const r = decodeRef(n)
    if (r) refs.push(r)
  }
  return { strong: s.strong, count: raw.count, refs, forms: raw.forms ?? {} }
}

// ---------------------------------------------------------------- grammar codes

let morphTable: MorphTable | null = null

/** Load the grammar-code table (about 35 KB gzipped). explainMorph does this for you. */
export async function loadMorphTable(): Promise<boolean> {
  if (!morphTable) morphTable = await load<MorphTable>('morph.json')
  return morphTable !== null
}

const LANGUAGE_NAME: Record<OriginalLanguage, string> = { hebrew: 'Hebrew', aramaic: 'Aramaic', greek: 'Greek' }

function splitMorph(code: string): { language: OriginalLanguage; keys: string[] } {
  const c = code.trim()
  // Greek codes have "-" ("V-AAI-3S"), "+" for merged words, or are words like "CONJ";
  // Hebrew/Aramaic codes start with H/A and use "/" between pieces ("HR/Ncfsa")
  const greek = c.includes('-') || c.includes('+') || /^[A-Z]{3,}$/.test(c) || !/^[HA]/.test(c)
  if (greek) return { language: 'greek', keys: c.split('+').map((p) => p.trim()).filter(Boolean) }
  const lang = c[0]
  const keys = c
    .split('/')
    .map((p, i) => (i === 0 ? p : p && lang + p))
    .filter((p) => p.length > 1)
  return { language: lang === 'A' ? 'aramaic' : 'hebrew', keys }
}

/** Synchronous version of explainMorph; returns null until loadMorphTable() has finished. */
export function explainMorphSync(code: string): MorphExplanation | null {
  const table = morphTable
  if (!table || !code) return null
  const { language, keys } = splitMorph(code)
  const parts: MorphPart[] = []
  for (const key of keys) {
    const row = table[key]
    if (row) parts.push({ code: key, description: row[0], meaning: row[1], example: row[2] })
  }
  if (!parts.length) return null
  const name = LANGUAGE_NAME[language]
  const description = parts
    .map((p, i) => (i > 0 && p.description.startsWith(`${name} `) ? p.description.slice(name.length + 1) : p.description))
    .join(' + ')
  return { code, language, description, parts }
}

/**
 * Explain a grammar code in plain English, e.g.
 * "HVqp3ms"  -> "Hebrew verb, Qal stem, perfect, 3rd person masculine singular"
 * "HR/Ncfsa" -> "Hebrew preposition + common noun, feminine singular, absolute"
 * "V-AAI-3S" -> "Greek verb, aorist active indicative, 3rd person singular"
 */
export async function explainMorph(code: string): Promise<MorphExplanation | null> {
  if (!(await loadMorphTable())) return null
  return explainMorphSync(code)
}
