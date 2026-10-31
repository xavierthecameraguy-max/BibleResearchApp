// Cross-references (OpenBible.info, CC BY 4.0). See scripts/data/xrefs.mjs.

import { BOOKS } from '../books.ts'
import type { Passage } from '../references.ts'
import { publicUrl } from '../paths.ts'

export interface CrossRef {
  passage: Passage
  votes: number
}

type Entry = [number, number, number]
const cache = new Map<string, Promise<{ c: Record<string, Entry[]>[] } | null>>()

function loadBookRefs(book: string) {
  let p = cache.get(book)
  if (!p) {
    p = fetch(publicUrl(`data/xrefs/${book}.json`))
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
    cache.set(book, p)
    // Forget failed loads (e.g. offline) so they're retried later.
    p.then((d) => {
      if (!d) cache.delete(book)
    })
  }
  return p
}

/** BBCCCVVV → { book, chapter, verse } */
export function decodeRef(n: number): { book: string; chapter: number; verse: number } {
  return { book: BOOKS[Math.floor(n / 1_000_000) - 1]?.id ?? 'GEN', chapter: Math.floor(n / 1000) % 1000, verse: n % 1000 }
}

function toPassage(from: number, to: number): Passage {
  const a = decodeRef(from)
  if (!to) return { book: a.book, startChapter: a.chapter, startVerse: a.verse, endChapter: a.chapter, endVerse: a.verse }
  const b = decodeRef(to)
  // References that run into another book are shortened to the first book.
  if (b.book !== a.book) return { book: a.book, startChapter: a.chapter, startVerse: a.verse, endChapter: a.chapter, endVerse: a.verse }
  return { book: a.book, startChapter: a.chapter, startVerse: a.verse, endChapter: b.chapter, endVerse: b.verse }
}

/** Cross-references for one verse, most relevant first. */
export async function getCrossRefs(book: string, chapter: number, verse: number): Promise<CrossRef[]> {
  const data = await loadBookRefs(book)
  const list = data?.c[chapter - 1]?.[String(verse)] ?? []
  return list.map(([from, to, votes]) => ({ passage: toPassage(from, to), votes }))
}

/** Number of cross-references for each verse of a chapter (for the reader's markers). */
export async function getChapterRefCounts(book: string, chapter: number): Promise<Record<number, number>> {
  const data = await loadBookRefs(book)
  const ch = data?.c[chapter - 1] ?? {}
  return Object.fromEntries(Object.entries(ch).map(([v, list]) => [Number(v), list.length]))
}
