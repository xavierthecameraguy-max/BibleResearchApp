// Understanding and formatting Bible references like "Genesis 1:1-2:3".

import { BOOKS, findBook, getBook } from './books.ts'

export interface Passage {
  book: string // USFM id
  startChapter: number
  startVerse?: number
  endChapter: number
  endVerse?: number
}

/**
 * Parse a reference. Accepts forms like:
 *   "John 3:16", "John 3:16-21", "Genesis 1:1-2:3", "Psalm 23", "Ruth 1-4",
 *   "1 Cor 13", "Hebrews 11:32–12:2"
 */
export function parseReference(input: string): Passage | null {
  const s = input.trim().replace(/[–—]/g, '-').replace(/\s+/g, ' ')
  const m = s.match(/^((?:[123]|i{1,3})?\s?[a-z][a-z .]*?)\s*(\d+)(?::(\d+))?(?:\s?-\s?(\d+)(?::(\d+))?)?$/i)
  if (!m) {
    const bookOnly = findBook(s)
    return bookOnly ? { book: bookOnly.id, startChapter: 1, endChapter: 1 } : null
  }
  const [, bookName, c1, v1, x, y] = m
  const book = findBook(bookName)
  if (!book) return null
  // One-chapter books (Obadiah, Philemon, 2–3 John, Jude): "Jude 3" means verse 3.
  if (book.chapters === 1 && !v1) {
    const sv = parseInt(c1, 10)
    const ev = x ? parseInt(x, 10) : sv
    return { book: book.id, startChapter: 1, startVerse: sv, endChapter: 1, endVerse: Math.max(sv, ev) }
  }
  const startChapter = parseInt(c1, 10)
  if (startChapter < 1 || startChapter > book.chapters) return null
  const startVerse = v1 ? parseInt(v1, 10) : undefined
  let endChapter = startChapter
  let endVerse = startVerse
  if (x && y) {
    endChapter = parseInt(x, 10)
    endVerse = parseInt(y, 10)
  } else if (x) {
    if (startVerse !== undefined) endVerse = parseInt(x, 10)
    else endChapter = parseInt(x, 10)
  }
  if (endChapter < startChapter || endChapter > book.chapters) endChapter = startChapter
  if (endChapter === startChapter && startVerse && endVerse && endVerse < startVerse) endVerse = startVerse
  return { book: book.id, startChapter, startVerse, endChapter, endVerse }
}

export function formatReference(p: Passage): string {
  const name = getBook(p.book)?.name ?? p.book
  const display = name === 'Psalms' && p.startChapter === p.endChapter ? 'Psalm' : name
  let out = `${display} ${p.startChapter}`
  if (p.startVerse) out += `:${p.startVerse}`
  if (p.endChapter !== p.startChapter) {
    out += `–${p.endChapter}`
    if (p.endVerse) out += `:${p.endVerse}`
  } else if (p.endVerse && p.endVerse !== p.startVerse) {
    out += `–${p.endVerse}`
  }
  return out
}

/** In-app link to the reader, highlighting the verses of the passage. */
export function readerPath(p: Passage): string {
  const base = `/bible/${p.book}/${p.startChapter}`
  if (!p.startVerse) return base
  // A passage that runs into the next chapter is highlighted to the end of this one.
  const end = p.endChapter !== p.startChapter ? 999 : p.endVerse
  return `${base}?v=${p.startVerse}${end && end !== p.startVerse ? '-' + end : ''}`
}

/** Plain-ASCII form that other Bible websites understand: "John 3:16-21". */
function searchable(p: Passage): string {
  return formatReference(p).replace(/–/g, '-')
}

/** Blue Letter Bible's book codes */
const BLB: Record<string, string> = {
  GEN: 'gen', EXO: 'exo', LEV: 'lev', NUM: 'num', DEU: 'deu', JOS: 'jos', JDG: 'jdg', RUT: 'rth', '1SA': '1sa', '2SA': '2sa',
  '1KI': '1ki', '2KI': '2ki', '1CH': '1ch', '2CH': '2ch', EZR: 'ezr', NEH: 'neh', EST: 'est', JOB: 'job', PSA: 'psa', PRO: 'pro',
  ECC: 'ecc', SNG: 'sng', ISA: 'isa', JER: 'jer', LAM: 'lam', EZK: 'eze', DAN: 'dan', HOS: 'hos', JOL: 'joe', AMO: 'amo',
  OBA: 'oba', JON: 'jon', MIC: 'mic', NAM: 'nah', HAB: 'hab', ZEP: 'zep', HAG: 'hag', ZEC: 'zec', MAL: 'mal', MAT: 'mat',
  MRK: 'mar', LUK: 'luk', JHN: 'jhn', ACT: 'act', ROM: 'rom', '1CO': '1co', '2CO': '2co', GAL: 'gal', EPH: 'eph', PHP: 'phl',
  COL: 'col', '1TH': '1th', '2TH': '2th', '1TI': '1ti', '2TI': '2ti', TIT: 'tit', PHM: 'phm', HEB: 'heb', JAS: 'jas',
  '1PE': '1pe', '2PE': '2pe', '1JN': '1jo', '2JN': '2jo', '3JN': '3jo', JUD: 'jde', REV: 'rev',
}

export function externalPassageUrl(p: Passage, version: string, site: 'biblegateway' | 'youversion' | 'blueletterbible'): string {
  if (site === 'blueletterbible') {
    return `https://www.blueletterbible.org/${version.toLowerCase()}/${BLB[p.book] ?? 'gen'}/${p.startChapter}/${p.startVerse ?? 1}/`
  }
  if (site === 'youversion') {
    // YouVersion uses numeric version ids; 114 is the NKJV.
    const ids: Record<string, number> = { NKJV: 114, KJV: 1, ESV: 59, NLT: 116, CSB: 1713, NIV: 111, WEB: 206, NASB: 2692, NASB1995: 100 }
    const id = ids[version.toUpperCase()]
    if (!id) return externalPassageUrl(p, version, 'biblegateway')
    let ref = `${p.book}.${p.startChapter}`
    if (p.startVerse) ref += `.${p.startVerse}`
    if (p.startVerse && p.endVerse && p.endChapter === p.startChapter && p.endVerse !== p.startVerse) ref += `-${p.endVerse}`
    return `https://www.bible.com/bible/${id}/${ref}.${version.toUpperCase()}`
  }
  return `https://www.biblegateway.com/passage/?search=${encodeURIComponent(searchable(p))}&version=${encodeURIComponent(version.toUpperCase())}`
}

// ---- Finding references inside lesson text ----------------------------------

const NAMES = [
  ...BOOKS.map((b) => b.name),
  'Psalm',
  'Song of Solomon',
]
  .sort((a, b) => b.length - a.length)
  .map((n) => n.replace(/ /g, '\\s'))

/** Matches "Genesis 12:1-3", "Romans 5:8", "Psalm 23", "Hebrews 11:32–12:2" in running text. */
export const REFERENCE_IN_TEXT = new RegExp(
  `\\b(${NAMES.join('|')})\\s(\\d{1,3})(?::(\\d{1,3})(?:\\s?[-–]\\s?\\d{1,3}(?::\\d{1,3})?)?|\\s?[-–]\\s?\\d{1,3}(?!:))?\\b`,
  'g',
)
