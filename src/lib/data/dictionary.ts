// Bible dictionaries, offline: Easton's Bible Dictionary (1897), Smith's Bible
// Dictionary (1884) and Hitchcock's Dictionary of Bible Names (1869, the
// meanings of names). All three are in the public domain; the text comes from the
// CrossWire Bible Society's SWORD modules, whose licence line reads "Public
// Domain". Built by scripts/data/dictionary.mjs.
//
// Files under /data/dictionary/:
//   index.json              every entry: {id, term, source, preview}, A–Z
//   <source>/<letter>.json  full entries {id, term, text, refs, see?}; `text` is
//                           plain text with "\n\n" between paragraphs, and each
//                           ref / see-link may carry `at`/`len`: the characters
//                           of `text` it covers, so they can be made tappable
//   verses/<BOOK>.json      {"<chapter>": {"<verse>": [entry ids]}}, "0" meaning
//                           the whole chapter is cited
// Ids look like "easton:abraham"; the letter file is the first character of the
// part after the colon.

import { BOOK_IDS } from '../books.ts'
import type { Passage } from '../references.ts'
import { publicUrl } from '../paths.ts'

export type DictionarySource = 'easton' | 'smith' | 'hitchcock'

export interface DictionarySourceInfo {
  id: DictionarySource
  /** Full title, e.g. "Easton's Bible Dictionary" */
  title: string
  /** Short label for tabs and badges */
  short: string
  year: number
  /** One line on what it is good for */
  description: string
  /** Credit line for the Copyright page */
  credit: string
  url: string
}

export const DICTIONARY_SOURCES: Record<DictionarySource, DictionarySourceInfo> = {
  easton: {
    id: 'easton',
    title: "Easton's Bible Dictionary",
    short: 'Easton',
    year: 1897,
    description: 'Clear, evangelical articles on people, places, words and teachings, with many verse references.',
    credit:
      "Easton's Illustrated Bible Dictionary, 3rd edition, by M. G. Easton (Thomas Nelson, 1897). Public domain. Text from the CrossWire Bible Society SWORD module \"Easton\" (from CCEL). Changes: markup removed, scripture references linked.",
    url: 'https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=Easton',
  },
  smith: {
    id: 'smith',
    title: "Smith's Bible Dictionary",
    short: 'Smith',
    year: 1884,
    description: 'Longer, more historical and geographical articles from the classic 19th-century dictionary.',
    credit:
      "Smith's Bible Dictionary by William Smith (revised edition, 1884). Public domain. Text from the CrossWire Bible Society SWORD module \"Smith\". Changes: markup removed, scripture references linked.",
    url: 'https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=Smith',
  },
  hitchcock: {
    id: 'hitchcock',
    title: "Hitchcock's Dictionary of Bible Names",
    short: 'Hitchcock',
    year: 1869,
    description: 'What Bible names mean, in a few words: "Bethlehem — house of bread".',
    credit:
      "Hitchcock's Dictionary of Bible Names, from Hitchcock's New and Complete Analysis of the Holy Bible (1869). Public domain. Text from the CrossWire Bible Society SWORD module \"Hitchcock\" (from CCEL). Changes: markup removed, combined entries split.",
    url: 'https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=Hitchcock',
  },
}

/** Display / ranking order: the main dictionary first. */
export const SOURCE_ORDER: DictionarySource[] = ['easton', 'smith', 'hitchcock']

export interface DictionaryIndexEntry {
  id: string
  term: string
  source: DictionarySource
  /** The first ~100 characters of the entry */
  preview: string
}

/** A scripture reference inside an entry. */
export interface DictionaryRef extends Passage {
  /** Character offset in the entry's `text` where the reference is written, when known */
  at?: number
  /** Number of characters it covers */
  len?: number
}

/** A "see also" link to another entry, written at text[at, at + len). */
export interface DictionaryLink {
  id: string
  at: number
  len: number
}

export interface DictionaryEntry {
  id: string
  term: string
  source: DictionarySource
  /** Plain text; paragraphs are separated by "\n\n" */
  text: string
  /** Every scripture reference, in the order written */
  refs: DictionaryRef[]
  /** Links to other entries of the same dictionary */
  see: DictionaryLink[]
}

/** How a dictionary entry matched a tapped word. */
export interface TermMatch extends DictionaryIndexEntry {
  /**
   * exact: the headword is the word ("Pharisees");
   * partial: one part of a compound headword ("Atonement" → "Atonement, Day of",
   *   "Abijah" → "Abia, Abiah, or Abijah");
   * variant: another form of the word ("Pharisee" → "Pharisees", "anointed" → "Anoint")
   */
  match: 'exact' | 'partial' | 'variant'
}

/** A piece of an entry's text, for rendering links inline. */
export type DictionarySegment =
  | { kind: 'text'; text: string }
  | { kind: 'ref'; text: string; ref: Passage }
  | { kind: 'link'; text: string; id: string }

const BASE = publicUrl('data/dictionary')
const SOURCES = new Set<string>(SOURCE_ORDER)
const RANK: Record<DictionarySource, number> = { easton: 0, smith: 1, hitchcock: 2 }

// ---- Fetching -------------------------------------------------------------------

const files = new Map<string, Promise<unknown>>()

/** Fetches a JSON file once. Missing files give null; network failures may be retried later. */
function fetchJson<T>(path: string): Promise<T | null> {
  let p = files.get(path) as Promise<T | null> | undefined
  if (!p) {
    p = fetch(path)
      .then((r) => {
        if (r.ok) return r.json() as Promise<T>
        if (r.status !== 404) files.delete(path)
        return null
      })
      .catch(() => {
        files.delete(path)
        return null
      })
    files.set(path, p)
  }
  return p
}

interface RawEntry {
  id: string
  term: string
  text: string
  refs?: DictionaryRef[]
  see?: DictionaryLink[]
}

/** The source and letter file for an id like "easton:abraham". */
function locate(id: string): { source: DictionarySource; letter: string } | null {
  const i = id.indexOf(':')
  const source = id.slice(0, i)
  const slug = id.slice(i + 1)
  if (i < 1 || !slug || !SOURCES.has(source)) return null
  return { source: source as DictionarySource, letter: /^[a-z]/.test(slug) ? slug[0] : '0' }
}

/** The dictionary an entry id belongs to, or null if the id isn't a dictionary id. */
export function sourceOf(id: string): DictionarySource | null {
  return locate(id)?.source ?? null
}

/** Every entry of one dictionary under one letter (for A–Z browsing). */
export async function loadLetter(source: DictionarySource, letter: string): Promise<DictionaryEntry[]> {
  const list = await fetchJson<RawEntry[]>(`${BASE}/${source}/${letter.toLowerCase()}.json`)
  if (!Array.isArray(list)) return []
  return list.map((e) => ({ id: e.id, term: e.term, source, text: e.text, refs: e.refs ?? [], see: e.see ?? [] }))
}

/** One full entry by id, or null when it can't be found. */
export async function getEntry(id: string): Promise<DictionaryEntry | null> {
  const loc = locate(id)
  if (!loc) return null
  const list = await loadLetter(loc.source, loc.letter)
  return list.find((e) => e.id === id) ?? null
}

/** Several entries by id, in the order given (missing ones are left out). */
export async function getEntries(ids: string[]): Promise<DictionaryEntry[]> {
  const found = await Promise.all(ids.map(getEntry))
  return found.filter((e): e is DictionaryEntry => e !== null)
}

/** All entries of all three dictionaries, A–Z (about 11,000; ~1.6 MB, loaded once). */
export async function loadIndex(): Promise<DictionaryIndexEntry[]> {
  const list = await fetchJson<DictionaryIndexEntry[]>(`${BASE}/index.json`)
  return Array.isArray(list) ? list : []
}

// ---- Matching words ---------------------------------------------------------------

/** Lower case, accents and apostrophes removed, other punctuation → spaces. */
function fold(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’‘`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** "Beth-lehem", "BETHLEHEM" and "Bethlehem" all → "bethlehem". */
export function normalizeTerm(s: string): string {
  return fold(s).replace(/ /g, '')
}

interface Prepared {
  entry: DictionaryIndexEntry
  key: string
  words: string[]
  parts: string[]
  rank: number
}

interface Lookup {
  all: Prepared[]
  byId: Map<string, DictionaryIndexEntry>
  byKey: Map<string, Prepared[]>
  byPart: Map<string, Prepared[]>
}

let lookup: Promise<Lookup> | null = null

/** Index entries with their match keys, built once. */
function getLookup(): Promise<Lookup> {
  if (!lookup) {
    const p = loadIndex().then((index) => {
      const all: Prepared[] = []
      const byId = new Map<string, DictionaryIndexEntry>()
      const byKey = new Map<string, Prepared[]>()
      const byPart = new Map<string, Prepared[]>()
      const push = (map: Map<string, Prepared[]>, k: string, v: Prepared) => {
        const list = map.get(k)
        if (list) list.push(v)
        else map.set(k, [v])
      }
      for (const entry of index) {
        const key = normalizeTerm(entry.term)
        // "Abia, Abiah, or Abijah", "Achar = Achan", "Shiloh (name of a city)", "Zuph, Land of"
        const parts = entry.term
          .replace(/\s*\([^)]*\)/g, '')
          .split(/\s*(?:,|;|=|\bor\b)\s*/i)
          .map(normalizeTerm)
          .filter((x) => x && x !== key && x !== 'the')
        const prepared: Prepared = { entry, key, words: fold(entry.term).split(' '), parts, rank: RANK[entry.source] ?? 3 }
        all.push(prepared)
        byId.set(entry.id, entry)
        push(byKey, key, prepared)
        for (const part of new Set(parts)) push(byPart, part, prepared)
      }
      return { all, byId, byKey, byPart }
    })
    // An empty index (offline before first use) is not kept, so a later call can retry.
    void p.then((l) => {
      if (!l.all.length && lookup === p) lookup = null
    })
    lookup = p
  }
  return lookup
}

function byRank(a: Prepared, b: Prepared): number {
  return a.rank - b.rank || a.key.length - b.key.length || a.entry.term.localeCompare(b.entry.term)
}

export interface DictionarySearchOptions {
  /** Only these dictionaries (default: all) */
  sources?: DictionarySource[]
}

/**
 * Search headwords. Ranked: exact headword, then an alternative name in the
 * headword, then headwords starting with the query, then any word starting with
 * it, then all query words present, then headwords containing it.
 */
export async function searchDictionary(query: string, limit = 20, options: DictionarySearchOptions = {}): Promise<DictionaryIndexEntry[]> {
  const q = fold(query)
  if (!q) return []
  const qc = q.replace(/ /g, '')
  const qWords = q.split(' ')
  const only = options.sources ? new Set(options.sources) : null
  const { all } = await getLookup()
  const scored: [number, Prepared][] = []
  for (const p of all) {
    if (only && !only.has(p.entry.source)) continue
    let score: number
    if (p.key === qc) score = 0
    else if (p.parts.includes(qc)) score = 1
    else if (p.key.startsWith(qc)) score = 2
    else if (p.parts.some((x) => x.startsWith(qc)) || p.words.some((w) => w.startsWith(qc))) score = 3
    else if (qWords.length > 1 && qWords.every((qw) => p.words.some((w) => w.startsWith(qw)))) score = 4
    else if (qc.length >= 3 && p.key.includes(qc)) score = 5
    else continue
    scored.push([score, p])
  }
  scored.sort((a, b) => a[0] - b[0] || byRank(a[1], b[1]))
  return scored.slice(0, Math.max(0, limit)).map(([, p]) => p.entry)
}

/** Other forms a tapped word may take in a headword: plurals, -eth/-ed verbs, Hebrew -im. */
function wordForms(w: string): string[] {
  const out = new Set<string>()
  const add = (s: string) => {
    if (s.length >= 3 && s !== w) out.add(s)
  }
  if (w.endsWith('ies')) add(w.slice(0, -3) + 'y')
  if (w.endsWith('es')) add(w.slice(0, -2))
  if (w.endsWith('s') && !w.endsWith('ss')) add(w.slice(0, -1))
  if (!w.endsWith('s')) {
    add(w + 's')
    add(w + 'es')
    if (w.endsWith('y')) add(w.slice(0, -1) + 'ies')
  }
  for (const end of ['eth', 'est', 'ed', 'ing']) {
    if (w.endsWith(end) && w.length > end.length + 2) {
      const base = w.slice(0, -end.length)
      add(base)
      add(base + 'e')
      if (/(.)\1$/.test(base)) add(base.slice(0, -1)) // "sinned" → "sin"
    }
  }
  if (w.endsWith('im')) add(w.slice(0, -2)) // "cherubim" → "cherub"
  if (w.endsWith('ims')) add(w.slice(0, -3)) // KJV "cherubims"
  return [...out]
}

/**
 * Dictionary entries for a word tapped in the Bible text ("Bethlehem",
 * "Pharisee", "Abram's"), across all three dictionaries: exact headwords
 * first, then partial and variant matches. Within each group Easton comes first.
 */
export async function findEntriesForTerm(term: string, options: DictionarySearchOptions & { limit?: number } = {}): Promise<TermMatch[]> {
  const w = normalizeTerm(term.trim().replace(/['’]s$/i, '').replace(/s['’]$/i, 's'))
  if (!w) return []
  const only = options.sources ? new Set(options.sources) : null
  const { byKey, byPart } = await getLookup()
  const seen = new Set<string>()
  const groups: Record<TermMatch['match'], Prepared[]> = { exact: [], partial: [], variant: [] }
  const take = (list: Prepared[] | undefined, match: TermMatch['match']) => {
    for (const p of list ?? []) {
      if (seen.has(p.entry.id) || (only && !only.has(p.entry.source))) continue
      seen.add(p.entry.id)
      groups[match].push(p)
    }
  }
  take(byKey.get(w), 'exact')
  take(byPart.get(w), 'partial')
  for (const f of wordForms(w)) {
    take(byKey.get(f), 'variant')
    take(byPart.get(f), 'variant')
  }
  const out: TermMatch[] = []
  for (const match of ['exact', 'partial', 'variant'] as const) {
    for (const p of groups[match].sort(byRank)) out.push({ ...p.entry, match })
  }
  return options.limit !== undefined ? out.slice(0, options.limit) : out
}

// ---- Verses → entries -----------------------------------------------------------------

type VerseFile = Record<string, Record<string, string[]>>

function loadVerseFile(book: string): Promise<VerseFile | null> {
  return fetchJson<VerseFile>(`${BASE}/verses/${book.toUpperCase()}.json`)
}

/**
 * Dictionary entries that cite a verse (or a short range including it), Easton
 * first; then, unless `includeChapter` is false, entries citing the whole chapter.
 */
export async function getEntriesForVerse(
  book: string,
  chapter: number,
  verse: number,
  options: { includeChapter?: boolean } = {},
): Promise<DictionaryIndexEntry[]> {
  const [file, { byId }] = await Promise.all([loadVerseFile(book), getLookup()])
  const ch = file?.[String(chapter)]
  const ids = [...(ch?.[String(verse)] ?? []), ...(options.includeChapter === false ? [] : (ch?.['0'] ?? []))]
  return [...new Set(ids)].map((id) => byId.get(id)).filter((e): e is DictionaryIndexEntry => e !== undefined)
}

export interface ChapterEntry {
  entry: DictionaryIndexEntry
  /** Verses of the chapter it cites; 0 means it cites the chapter as a whole */
  verses: number[]
}

/** Every dictionary entry citing anything in a chapter, those citing it most first. */
export async function getEntriesForChapter(book: string, chapter: number): Promise<ChapterEntry[]> {
  const [file, { byId }] = await Promise.all([loadVerseFile(book), getLookup()])
  const verses = file?.[String(chapter)] ?? {}
  const found = new Map<string, number[]>()
  for (const [v, ids] of Object.entries(verses)) {
    for (const id of ids) {
      const list = found.get(id)
      if (list) list.push(Number(v))
      else found.set(id, [Number(v)])
    }
  }
  const out: ChapterEntry[] = []
  for (const [id, vs] of found) {
    const entry = byId.get(id)
    if (entry) out.push({ entry, verses: vs.sort((a, b) => a - b) })
  }
  return out.sort((a, b) => b.verses.length - a.verses.length || RANK[a.entry.source] - RANK[b.entry.source] || a.entry.term.localeCompare(b.entry.term))
}

// ---- Rendering helpers ----------------------------------------------------------------

/** The entry's text cut into plain, reference and link pieces, in order. */
export function entrySegments(entry: Pick<DictionaryEntry, 'text' | 'refs' | 'see'>): DictionarySegment[] {
  type Mark = { at: number; len: number; seg: DictionarySegment }
  const marks: Mark[] = []
  const text = entry.text
  for (const r of entry.refs) {
    if (r.at === undefined || !r.len) continue
    const ref: Passage = { book: r.book, startChapter: r.startChapter, startVerse: r.startVerse, endChapter: r.endChapter, endVerse: r.endVerse }
    marks.push({ at: r.at, len: r.len, seg: { kind: 'ref', text: text.slice(r.at, r.at + r.len), ref } })
  }
  for (const l of entry.see ?? []) {
    if (l.len) marks.push({ at: l.at, len: l.len, seg: { kind: 'link', text: text.slice(l.at, l.at + l.len), id: l.id } })
  }
  marks.sort((a, b) => a.at - b.at)
  const out: DictionarySegment[] = []
  let pos = 0
  for (const m of marks) {
    if (m.at < pos || m.at + m.len > text.length) continue // overlapping or out of range
    if (m.at > pos) out.push({ kind: 'text', text: text.slice(pos, m.at) })
    out.push(m.seg)
    pos = m.at + m.len
  }
  if (pos < text.length) out.push({ kind: 'text', text: text.slice(pos) })
  return out
}

/** Like entrySegments, grouped into paragraphs. */
export function entryParagraphs(entry: Pick<DictionaryEntry, 'text' | 'refs' | 'see'>): DictionarySegment[][] {
  const paras: DictionarySegment[][] = [[]]
  for (const seg of entrySegments(entry)) {
    if (seg.kind !== 'text' || !seg.text.includes('\n\n')) {
      paras[paras.length - 1].push(seg)
      continue
    }
    seg.text.split(/\n\n+/).forEach((piece, i) => {
      if (i > 0) paras.push([])
      if (piece) paras[paras.length - 1].push({ kind: 'text', text: piece })
    })
  }
  return paras.filter((p) => p.length)
}

/** The entry's references without repeats, in Bible order (for a "verses mentioned" list). */
export function uniqueRefs(entry: Pick<DictionaryEntry, 'refs'>): Passage[] {
  const seen = new Map<string, Passage>()
  for (const r of entry.refs) {
    const key = `${r.book} ${r.startChapter}:${r.startVerse ?? 0}-${r.endChapter}:${r.endVerse ?? 0}`
    if (!seen.has(key)) {
      seen.set(key, { book: r.book, startChapter: r.startChapter, startVerse: r.startVerse, endChapter: r.endChapter, endVerse: r.endVerse })
    }
  }
  const order = new Map(BOOK_IDS.map((b, i) => [b, i]))
  return [...seen.values()].sort(
    (a, b) =>
      (order.get(a.book) ?? 99) - (order.get(b.book) ?? 99) ||
      a.startChapter - b.startChapter ||
      (a.startVerse ?? 0) - (b.startVerse ?? 0),
  )
}
