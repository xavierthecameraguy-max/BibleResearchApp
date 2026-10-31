// Matthew Henry's Concise Commentary on the Whole Bible, offline: the classic
// one-volume abridgment of Matthew Henry's Exposition of the Old and New
// Testaments (1706). Public domain. The text comes from the
// CrossWire Bible Society's SWORD module "MHCC" (licence line "Public Domain"),
// with two passages the module lost restored from CCEL's edition. Built by
// scripts/data/commentary.mjs.
//
// Files under /data/commentary/:
//   <BOOK>.json  {b, intro?, introRefs?, c: [chapter, ...]}, one per book (USFM id)
//     chapter = {intro?, introRefs?, outline?: [{t, r: [[from, to]]}],
//                sections: [{from, to, also?, title?, text, refs, src?}]}
//   meta.json    title, licence, credit, module version, counts
// Henry comments on passages, not single verses: each section covers a run of
// verses ("Verses 1-8"), occasionally two runs (Matthew 13:24-30 and 36-43), and
// some chapters are treated as a whole (Psalm 23 is one section, 1-6). A few
// verses have no note at all (Proverbs 14:13, 16:10, 16:20, 22:29).
// Texts are plain, with "\n\n" between paragraphs; each ref's `at`/`len` give the
// characters of the text where it is written, so it can be made tappable.

import { findBook } from '../books.ts'
import type { Passage } from '../references.ts'
import { publicUrl } from '../paths.ts'

export const COMMENTARY_TITLE = "Matthew Henry's Concise Commentary"

/** Credit line for the Copyright / About page. */
export const COMMENTARY_CREDIT =
  "Matthew Henry's Concise Commentary on the Whole Bible, the one-volume abridgment of Matthew Henry's Exposition of the Old and New Testaments (1706). Public domain. " +
  'Text from the CrossWire Bible Society SWORD module "MHCC" (from CCEL), with a few passages the module lost restored from ' +
  "CCEL's edition. Changes: markup removed, scripture references linked."

export const COMMENTARY_INFO = {
  id: 'mhcc',
  title: "Matthew Henry's Concise Commentary on the Whole Bible",
  short: 'Matthew Henry',
  author: 'Matthew Henry',
  year: 1706,
  license: 'Public Domain',
  description: 'Warm, devotional notes on every chapter of the Bible, passage by passage, from the classic Puritan commentator.',
  credit: COMMENTARY_CREDIT,
  url: 'https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=MHCC',
} as const

/** A scripture reference written in a commentary text. */
export interface CommentaryRef extends Passage {
  /** Character offset in the text where the reference is written */
  at: number
  /** Number of characters it covers */
  len: number
}

/** One of Henry's notes, covering a run of verses of one chapter. */
export interface CommentarySection {
  /** First verse covered */
  from: number
  /** Last verse covered */
  to: number
  /** Further runs of verses covered, e.g. [[36, 43]] for Matthew 13:24-30 */
  also?: [number, number][]
  /** Heading from the chapter outline ("The parable of the sower") or the chapter summary */
  title?: string
  /** Plain text; paragraphs are separated by "\n\n" */
  text: string
  /** Scripture references in the text, in the order written */
  refs: CommentaryRef[]
  /** "ccel" when the text was restored from CCEL's edition (the SWORD module lost it) */
  src?: 'ccel'
}

/** An item of Henry's "Chapter Outline": a title and the verses it covers. */
export interface CommentaryOutlineItem {
  title: string
  /** Runs of verses, e.g. [[24, 30], [36, 43]] */
  ranges: [number, number][]
}

export interface ChapterCommentary {
  book: string
  chapter: number
  /** Introductory prose for the chapter, when there is some (rare) */
  intro?: string
  introRefs?: CommentaryRef[]
  /** Henry's outline of the chapter (empty for chapters treated as a whole) */
  outline: CommentaryOutlineItem[]
  /** The notes, in verse order */
  sections: CommentarySection[]
}

export interface BookIntroduction {
  book: string
  /** Henry's introduction to the book (plain text, "\n\n" between paragraphs) */
  text: string
  refs: CommentaryRef[]
}

export interface CommentaryMeta {
  title: string
  short: string
  author: string
  year: number
  license: string
  credit: string
  source: {
    module: string
    moduleVersion: string
    moduleDate?: string
    distributionLicense: string
    url: string
    textSource?: string
    repairsFrom?: string | null
  }
  built: string
  sections: number
  references: number
  books: Record<string, { chapters: number; sections: number; refs: number; intro: boolean }>
  /** What was restored from CCEL */
  repairs: string[]
  /** Verses with no note, e.g. "PRO 14:13" */
  uncovered: string[]
}

/** A piece of a commentary text, for rendering references inline. */
export type CommentarySegment = { kind: 'text'; text: string } | { kind: 'ref'; text: string; ref: Passage }

// ---- Raw file shapes ---------------------------------------------------------------

interface RawSection {
  from: number
  to: number
  also?: [number, number][]
  title?: string
  text: string
  refs?: CommentaryRef[]
  src?: 'ccel'
}

interface RawChapter {
  intro?: string
  introRefs?: CommentaryRef[]
  outline?: { t: string; r: [number, number][] }[]
  sections?: RawSection[]
}

interface RawBook {
  b: string
  intro?: string
  introRefs?: CommentaryRef[]
  c: RawChapter[]
}

const BASE = publicUrl('data/commentary')

// ---- Fetching ------------------------------------------------------------------------

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

/** USFM id for "GEN", "gen", "Genesis", "1 Cor"…; null if it isn't a book. */
function bookId(book: string): string | null {
  return findBook(book)?.id ?? null
}

function loadBook(book: string): Promise<RawBook | null> {
  const id = bookId(book)
  if (!id) return Promise.resolve(null)
  return fetchJson<RawBook>(`${BASE}/${id}.json`).then((d) => (d && Array.isArray(d.c) ? d : null))
}

function toSection(s: RawSection): CommentarySection {
  const out: CommentarySection = { from: s.from, to: s.to, text: s.text, refs: s.refs ?? [] }
  if (s.also?.length) out.also = s.also
  if (s.title) out.title = s.title
  if (s.src) out.src = s.src
  return out
}

// ---- Public API --------------------------------------------------------------------------

/** Henry's commentary on a whole chapter, or null when there is none (or it can't be loaded). */
export async function getChapterCommentary(book: string, chapter: number): Promise<ChapterCommentary | null> {
  const data = await loadBook(book)
  const raw = data?.c[chapter - 1]
  if (!data || !raw || !Number.isInteger(chapter)) return null
  const out: ChapterCommentary = {
    book: data.b,
    chapter,
    outline: (raw.outline ?? []).map((o) => ({ title: o.t, ranges: o.r })),
    sections: (raw.sections ?? []).map(toSection),
  }
  if (raw.intro) {
    out.intro = raw.intro
    out.introRefs = raw.introRefs ?? []
  }
  return out
}

/** The note(s) covering one verse, in verse order; [] when Henry has none for it. */
export async function getVerseCommentary(book: string, chapter: number, verse: number): Promise<CommentarySection[]> {
  const ch = await getChapterCommentary(book, chapter)
  return ch ? ch.sections.filter((s) => sectionCovers(s, verse)) : []
}

/** Henry's introduction to a book (not every book has one: 2 Kings and 2 Chronicles don't). */
export async function getBookIntroduction(book: string): Promise<BookIntroduction | null> {
  const data = await loadBook(book)
  if (!data?.intro) return null
  return { book: data.b, text: data.intro, refs: data.introRefs ?? [] }
}

/** Titles, licence, counts and repairs (for the credits page). */
export function getCommentaryMeta(): Promise<CommentaryMeta | null> {
  return fetchJson<CommentaryMeta>(`${BASE}/meta.json`)
}

// ---- Helpers ---------------------------------------------------------------------------------

/** Whether a section covers a verse. */
export function sectionCovers(section: Pick<CommentarySection, 'from' | 'to' | 'also'>, verse: number): boolean {
  if (verse >= section.from && verse <= section.to) return true
  return (section.also ?? []).some(([a, b]) => verse >= a && verse <= b)
}

/** Every verse a section covers, as runs: [[24, 30], [36, 43]]. */
export function sectionRanges(section: Pick<CommentarySection, 'from' | 'to' | 'also'>): [number, number][] {
  return [[section.from, section.to], ...(section.also ?? [])]
}

/** "Verse 31", "Verses 1–8", "Verses 24–30, 36–43" */
export function sectionLabel(section: Pick<CommentarySection, 'from' | 'to' | 'also'>): string {
  const runs = sectionRanges(section)
  const single = runs.length === 1 && runs[0][0] === runs[0][1]
  return `${single ? 'Verse' : 'Verses'} ${runs.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join(', ')}`
}

/** The passage a section comments on (its first run of verses). */
export function sectionPassage(book: string, chapter: number, section: Pick<CommentarySection, 'from' | 'to'>): Passage {
  return { book, startChapter: chapter, startVerse: section.from, endChapter: chapter, endVerse: section.to }
}

/** A text cut into plain and reference pieces, in order. */
export function commentarySegments(item: { text: string; refs?: CommentaryRef[] }): CommentarySegment[] {
  const text = item.text
  const refs = [...(item.refs ?? [])].filter((r) => r.len > 0).sort((a, b) => a.at - b.at)
  const out: CommentarySegment[] = []
  let pos = 0
  for (const r of refs) {
    if (r.at < pos || r.at + r.len > text.length) continue // overlapping or out of range
    if (r.at > pos) out.push({ kind: 'text', text: text.slice(pos, r.at) })
    const ref: Passage = { book: r.book, startChapter: r.startChapter, startVerse: r.startVerse, endChapter: r.endChapter, endVerse: r.endVerse }
    out.push({ kind: 'ref', text: text.slice(r.at, r.at + r.len), ref })
    pos = r.at + r.len
  }
  if (pos < text.length) out.push({ kind: 'text', text: text.slice(pos) })
  return out
}

/** Like commentarySegments, grouped into paragraphs. */
export function commentaryParagraphs(item: { text: string; refs?: CommentaryRef[] }): CommentarySegment[][] {
  const paras: CommentarySegment[][] = [[]]
  for (const seg of commentarySegments(item)) {
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
