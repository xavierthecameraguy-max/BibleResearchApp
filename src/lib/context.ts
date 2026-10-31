// Literary context for a passage: the section headings just before, around
// and after it, taken from the Berean Standard Bible's headings.

import { loadBook } from './bible.ts'
import type { Passage } from './references.ts'

export interface Section {
  heading: string
  chapter: number
  verse: number
}

export async function sectionsAround(p: Passage): Promise<{ before?: Section; current?: Section; after?: Section }> {
  const book = await loadBook('bsb', p.book)
  if (!book) return {}
  const sections: Section[] = []
  book.chapters.forEach((ch, ci) => ch?.forEach((v) => v.h && sections.push({ heading: v.h, chapter: ci + 1, verse: v.v })))
  const pos = (s: Section) => s.chapter * 1000 + s.verse
  const start = p.startChapter * 1000 + (p.startVerse ?? 1)
  const end = p.endChapter * 1000 + (p.endVerse ?? 999)
  let ci = -1
  sections.forEach((s, i) => {
    if (pos(s) <= start) ci = i
  })
  const current = sections[ci]
  const before = sections[ci - 1]
  const after = sections.slice(ci + 1).find((s) => pos(s) > end)
  return { before, current, after }
}
