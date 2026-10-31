// Topical Bible, offline: Nave's Topical Bible by Orville J. Nave (1896) — about 5,300
// topics, 29,000 subtopics and 78,000 scripture references, from "Aaron" to "Zuzims".
// The book is in the public domain; the text comes from the CrossWire Bible Society's
// SWORD module "Nave" v3.0 (from CCEL), whose licence line reads "Public Domain".
// Built by scripts/data/topics.mjs, which re-reads every reference from the text and
// checks it against the KJV's chapter and verse counts.
//
// Files under /data/topics/:
//   index.json           every topic: [{id, name, count}], A–Z (count = references)
//   <letter>.json        full topics whose id starts with that letter:
//                        [{id, name, subtopics: [{label, refs, level?, seeAlso?}], seeAlso?}]
//   byVerse/<BOOK>.json  {"<chapter>": {"<verse>": [topic ids]}}, most specific first;
//                        verse "0" = topics citing the whole chapter or a long passage in it
//   meta.json            title, credit and counts
// Ids are slugs of Nave's headwords: "faith", "grace-of-god", "jesus-the-christ".
// Book ids are USFM codes (GEN, JHN, 1CO). Missing or unreachable files give null / [].

import { BOOK_IDS } from '../books.ts'
import type { Passage } from '../references.ts'
import { publicUrl } from '../paths.ts'

export interface TopicSummary {
  id: string
  /** Display name, e.g. "Grace of God", "Jesus, the Christ" */
  name: string
  /** Number of scripture references in the topic */
  count: number
}

export interface Subtopic {
  /** e.g. "General scriptures concerning", "Instances of", "Abraham, in forsaking …" */
  label: string
  /** Passages without verses are whole chapters. Empty for headings and "See …" lines. */
  refs: Passage[]
  /** 1 = indented under the line before it; absent = a main line */
  level?: number
  /** Topics this line points to ("See God, Grace of" → ["god"]) */
  seeAlso?: string[]
}

export interface Topic {
  id: string
  name: string
  subtopics: Subtopic[]
  /** Every topic linked from this one, in order of first mention */
  seeAlso?: string[]
}

export interface TopicsMeta {
  title: string
  author: string
  year: number
  license: string
  credit: string
  source: { module: string; version: string; url: string; sha256: string; textSource?: string }
  topics: number
  subtopics: number
  references: number
  letters: string[]
  /** Passages longer than this many verses are listed under verse "0" of each chapter */
  maxExpand: number
}

type ByVerse = Record<string, Record<string, string[]>>

const BASE = publicUrl('data/topics')

/** Fetches JSON; a failed request is not cached, so it can be retried later (e.g. back online). */
function cached<T>(cache: Map<string, Promise<T | null>>, key: string, path: string): Promise<T | null> {
  let p = cache.get(key)
  if (!p) {
    p = fetch(`${BASE}/${path}`)
      .then((r) => (r.ok ? (r.json() as Promise<T>) : null))
      .catch(() => null)
      .then((data) => {
        if (data === null) cache.delete(key)
        return data
      })
    cache.set(key, p)
  }
  return p
}

const indexCache = new Map<string, Promise<TopicSummary[] | null>>()
const metaCache = new Map<string, Promise<TopicsMeta | null>>()
const letterCache = new Map<string, Promise<Topic[] | null>>()
const verseCache = new Map<string, Promise<ByVerse | null>>()
let indexById: Map<string, TopicSummary> | null = null
const lettersById = new Map<string, Map<string, Topic>>()

/** Every topic, sorted by name. */
export async function loadTopicIndex(): Promise<TopicSummary[]> {
  return (await cached(indexCache, 'index', 'index.json')) ?? []
}

/** Title, licence and counts (for the credits page). */
export function loadTopicsMeta(): Promise<TopicsMeta | null> {
  return cached(metaCache, 'meta', 'meta.json')
}

async function summaryMap(): Promise<Map<string, TopicSummary>> {
  if (indexById) return indexById
  const list = await loadTopicIndex()
  const map = new Map(list.map((t) => [t.id, t]))
  if (list.length) indexById = map
  return map
}

/** Name and size of one topic without loading the full entry. */
export async function getTopicSummary(id: string): Promise<TopicSummary | null> {
  return (await summaryMap()).get(id) ?? null
}

/** The file a topic lives in: its id's first character. */
export function topicLetter(id: string): string {
  return id.charAt(0).toLowerCase()
}

/** A full topic with all its subtopics and references, or null if there is none. */
export async function getTopic(id: string): Promise<Topic | null> {
  const letter = topicLetter(id)
  if (!/^[a-z0-9]$/.test(letter)) return null
  let byId = lettersById.get(letter)
  if (!byId) {
    const list = await cached(letterCache, letter, `${letter}.json`)
    if (!list) return null
    byId = new Map(list.map((t) => [t.id, t]))
    lettersById.set(letter, byId)
  }
  return byId.get(id) ?? null
}

const normalize = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’‘`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/**
 * Topics whose name matches the query, best first: exact name, then names starting with
 * the query, then names whose words start with every query word ("spirit holy" finds
 * "Holy Spirit"), then any name containing it. Larger topics win ties.
 */
export async function searchTopics(query: string, limit = 20): Promise<TopicSummary[]> {
  const q = normalize(query)
  if (!q) return []
  const words = q.split(' ')
  const scored: { t: TopicSummary; score: number }[] = []
  for (const t of await loadTopicIndex()) {
    const name = normalize(t.name)
    let score: number
    if (name === q) score = 0
    else if (name.startsWith(q)) score = name.startsWith(q + ' ') ? 1 : 2
    else {
      const nameWords = name.split(' ')
      if (words.every((w) => nameWords.some((nw) => nw.startsWith(w)))) score = 3
      else if (name.includes(q)) score = 4
      else continue
    }
    scored.push({ t, score })
  }
  scored.sort((a, b) => a.score - b.score || b.t.count - a.t.count || a.t.name.localeCompare(b.t.name))
  return scored.slice(0, Math.max(0, limit)).map((s) => s.t)
}

function loadByVerse(book: string): Promise<ByVerse | null> {
  const id = book.toUpperCase()
  if (!BOOK_IDS.includes(id)) return Promise.resolve(null)
  return cached(verseCache, id, `byVerse/${id}.json`)
}

async function summaries(ids: string[]): Promise<TopicSummary[]> {
  const map = await summaryMap()
  return ids.map((id) => map.get(id)).filter((t): t is TopicSummary => !!t)
}

/**
 * Topics that cite this verse, most specific first (a topic citing just this verse comes
 * before one citing a whole passage). With includeWholeChapter, topics that cite the whole
 * chapter (or a passage of more than ~40 verses) are added after them.
 */
export async function getTopicsForVerse(
  book: string,
  chapter: number,
  verse: number,
  options: { includeWholeChapter?: boolean } = {},
): Promise<TopicSummary[]> {
  const ch = (await loadByVerse(book))?.[String(chapter)]
  if (!ch) return []
  const ids = [...(ch[String(verse)] ?? [])]
  if (options.includeWholeChapter) for (const id of ch['0'] ?? []) if (!ids.includes(id)) ids.push(id)
  return summaries(ids)
}

/** Topics that cite a whole chapter (or a long passage in it). */
export async function getTopicsForChapter(book: string, chapter: number): Promise<TopicSummary[]> {
  const ch = (await loadByVerse(book))?.[String(chapter)]
  return ch ? summaries(ch['0'] ?? []) : []
}

/** Number of topics citing each verse of a chapter (for markers in the reader). */
export async function getChapterTopicCounts(book: string, chapter: number): Promise<Record<number, number>> {
  const ch = (await loadByVerse(book))?.[String(chapter)] ?? {}
  const out: Record<number, number> = {}
  for (const [v, ids] of Object.entries(ch)) if (v !== '0') out[Number(v)] = ids.length
  return out
}

/** True when the passage includes the verse (a passage without verses covers whole chapters). */
export function passageIncludes(p: Passage, book: string, chapter: number, verse: number): boolean {
  if (p.book !== book.toUpperCase() || chapter < p.startChapter || chapter > p.endChapter) return false
  if (p.startVerse === undefined) return true
  if (chapter === p.startChapter && verse < p.startVerse) return false
  if (chapter === p.endChapter && p.endVerse !== undefined && verse > p.endVerse) return false
  return true
}

/** The subtopics of a topic that cite this verse ("Faith → Exemplified", …). */
export function subtopicsForVerse(topic: Topic, book: string, chapter: number, verse: number): Subtopic[] {
  return topic.subtopics.filter((s) => s.refs.some((r) => passageIncludes(r, book, chapter, verse)))
}
