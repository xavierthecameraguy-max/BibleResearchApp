// Turns a Bible file the user already has into the app's book format.
// Supported: USFM (.usfm/.sfm, or a .zip of them), OSIS XML, Zefania XML,
// several common JSON layouts, and simple text/TSV/CSV lines.
// Everything happens on the device; nothing is uploaded.

import { unzipSync, strFromU8 } from 'fflate'
import { BOOKS, findBook } from './books.ts'
import type { BookText, Verse } from './bibleTypes.ts'
import { parseUsfm } from './usfm.ts'

export type BookMap = Map<string, BookText>

class Collector {
  books: BookMap = new Map()
  add(bookId: string, chapter: number, verse: number, text: string) {
    const t = text.replace(/\s+/g, ' ').trim()
    if (!t || chapter < 1 || verse < 1) return
    let book = this.books.get(bookId)
    if (!book) {
      book = { id: bookId, chapters: [] }
      this.books.set(bookId, book)
    }
    const ch = (book.chapters[chapter - 1] ??= [])
    ch.push({ v: verse, t })
  }
  finish(): BookMap {
    for (const b of this.books.values()) {
      for (let i = 0; i < b.chapters.length; i++) {
        b.chapters[i] = (b.chapters[i] ?? []).sort((a, z) => a.v - z.v)
        if (b.chapters[i][0]) b.chapters[i][0].p = true
      }
    }
    return this.books
  }
}

/** A book from a name, abbreviation, USFM/OSIS code, or number 1–66. */
function resolveBook(key: unknown): string | undefined {
  if (typeof key === 'number' || (typeof key === 'string' && /^\d{1,2}$/.test(key.trim()))) {
    return BOOKS[Number(key) - 1]?.id
  }
  if (typeof key !== 'string') return undefined
  return findBook(key)?.id
}

// ---- USFM ------------------------------------------------------------------

function fromUsfmTexts(texts: string[]): BookMap {
  const out: BookMap = new Map()
  const wanted = new Set(BOOKS.map((b) => b.id))
  for (const t of texts) {
    const book = parseUsfm(t)
    if (book && wanted.has(book.id)) out.set(book.id, book)
  }
  return out
}

// ---- XML (OSIS and Zefania) ------------------------------------------------

function fromXml(text: string): BookMap {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('The XML file could not be read.')
  const c = new Collector()

  // Zefania: <BIBLEBOOK bnumber="1"><CHAPTER cnumber="1"><VERS vnumber="1">
  const zBooks = doc.getElementsByTagName('BIBLEBOOK')
  if (zBooks.length) {
    for (const b of Array.from(zBooks)) {
      const id = resolveBook(b.getAttribute('bnumber') ?? b.getAttribute('bname') ?? '')
      if (!id) continue
      for (const ch of Array.from(b.getElementsByTagName('CHAPTER'))) {
        const cn = Number(ch.getAttribute('cnumber'))
        for (const v of Array.from(ch.getElementsByTagName('VERS'))) {
          c.add(id, cn, Number(v.getAttribute('vnumber')), textWithoutNotes(v))
        }
      }
    }
    return c.finish()
  }

  // OSIS: <verse osisID="Gen.1.1">…</verse>, or milestones <verse sID=…/> … <verse eID=…/>
  let current: { id: string; ch: number; v: number } | null = null
  let buffer = ''
  const flush = () => {
    if (current) c.add(current.id, current.ch, current.v, buffer)
    buffer = ''
  }
  const start = (osisID: string) => {
    flush()
    const [book, ch, v] = osisID.split(/\s+/)[0].split('.')
    const id = resolveBook(book)
    current = id ? { id, ch: Number(ch), v: Number(v) } : null
  }
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (current) buffer += node.nodeValue
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as Element
    const name = el.localName
    if (name === 'note' || name === 'title' && !current) return
    if (name === 'verse') {
      if (el.getAttribute('eID')) {
        flush()
        current = null
        return
      }
      const osisID = el.getAttribute('osisID')
      if (osisID) {
        start(osisID)
        if (!el.getAttribute('sID') && el.childNodes.length) {
          el.childNodes.forEach(walk)
          flush()
          current = null
        }
        return
      }
    }
    el.childNodes.forEach(walk)
  }
  walk(doc.documentElement)
  flush()
  return c.finish()
}

function textWithoutNotes(el: Element): string {
  const clone = el.cloneNode(true) as Element
  clone.querySelectorAll('NOTE, note').forEach((n) => n.remove())
  return clone.textContent ?? ''
}

// ---- JSON ------------------------------------------------------------------

type Json = unknown

function fromJson(data: Json): BookMap {
  const c = new Collector()
  const isObj = (x: Json): x is Record<string, Json> => !!x && typeof x === 'object' && !Array.isArray(x)

  // Our own export format: [{ id, chapters: Verse[][] }] or { books: [...] }
  const own = Array.isArray(data) ? data : isObj(data) && Array.isArray(data.books) ? data.books : null
  if (own && own.every((b) => isObj(b) && Array.isArray(b.chapters) && (Array.isArray(b.chapters[0]) || b.chapters.length === 0))) {
    for (const b of own as Record<string, Json>[]) {
      const id = resolveBook(b.id ?? b.name ?? b.abbrev ?? b.book)
      if (!id) continue
      ;(b.chapters as Json[][]).forEach((ch, ci) =>
        ch.forEach((v, vi) => {
          if (typeof v === 'string') c.add(id, ci + 1, vi + 1, v)
          else if (isObj(v)) c.add(id, ci + 1, Number(v.v ?? v.verse ?? vi + 1), String(v.t ?? v.text ?? ''))
        }),
      )
    }
    return c.finish()
  }

  // Flat rows: [{ book, chapter, verse, text }] (many key spellings), possibly under "verses"
  const rows = Array.isArray(data) ? data : isObj(data) && Array.isArray(data.verses) ? data.verses : null
  if (rows && rows.length && isObj(rows[0])) {
    for (const r of rows as Record<string, Json>[]) {
      const id = resolveBook(r.book ?? r.book_name ?? r.bookName ?? r.b ?? r.book_id ?? r.bookId)
      const ch = Number(r.chapter ?? r.c ?? r.chapterNumber)
      const v = Number(r.verse ?? r.v ?? r.verseNumber)
      const t = r.text ?? r.t ?? r.content
      if (id && typeof t === 'string') c.add(id, ch, v, t)
    }
    return c.finish()
  }

  // Nested: { books: [{ name, chapters: [{ chapter, verses: [{ verse, text }] }] }] }
  if (own) {
    for (const b of own as Record<string, Json>[]) {
      const id = resolveBook(b.name ?? b.book ?? b.id ?? b.abbrev)
      if (!id || !Array.isArray(b.chapters)) continue
      ;(b.chapters as Record<string, Json>[]).forEach((ch, ci) => {
        const cn = Number(ch.chapter ?? ch.number ?? ci + 1)
        const verses = Array.isArray(ch.verses) ? ch.verses : []
        verses.forEach((v, vi) => {
          if (typeof v === 'string') c.add(id, cn, vi + 1, v)
          else if (isObj(v)) c.add(id, cn, Number(v.verse ?? v.number ?? v.v ?? vi + 1), String(v.text ?? v.t ?? ''))
        })
      })
    }
    return c.finish()
  }

  // Map: { "Genesis": { "1": { "1": "text" } } }
  if (isObj(data)) {
    for (const [bk, chapters] of Object.entries(data)) {
      const id = resolveBook(bk)
      if (!id || !isObj(chapters)) continue
      for (const [cn, verses] of Object.entries(chapters)) {
        if (!isObj(verses)) continue
        for (const [vn, t] of Object.entries(verses)) if (typeof t === 'string') c.add(id, Number(cn), Number(vn), t)
      }
    }
  }
  return c.finish()
}

// ---- Plain text lines ------------------------------------------------------

function fromLines(text: string): BookMap {
  const c = new Collector()
  for (const line of text.split(/\r?\n/)) {
    // "Genesis<TAB>1<TAB>1<TAB>In the beginning…" (tab, comma or pipe separated)
    let m = line.match(/^\s*"?([^\t|,"]+?)"?\s*[\t|,]\s*(\d+)\s*[\t|,]\s*(\d+)\s*[\t|,]\s*"?(.*?)"?\s*$/)
    // "Genesis 1:1 In the beginning…"
    if (!m) m = line.match(/^\s*((?:[123]\s?)?[A-Za-z][A-Za-z .]*?)\s+(\d+):(\d+)\s+(.+)$/)
    if (!m) continue
    const id = resolveBook(m[1])
    if (id) c.add(id, Number(m[2]), Number(m[3]), m[4].replace(/""/g, '"'))
  }
  return c.finish()
}

// ---- Entry point -----------------------------------------------------------

export async function parseBibleFiles(files: File[]): Promise<BookMap> {
  const usfm: string[] = []
  const merged: BookMap = new Map()
  const mergeIn = (m: BookMap) => m.forEach((b, id) => merged.set(id, b))

  for (const f of files) {
    const name = f.name.toLowerCase()
    if (name.endsWith('.zip')) {
      const entries = unzipSync(new Uint8Array(await f.arrayBuffer()))
      for (const [n, data] of Object.entries(entries)) {
        const lower = n.toLowerCase()
        const text = strFromU8(data)
        if (/\.(usfm|sfm)$/.test(lower) || text.trimStart().startsWith('\\id')) usfm.push(text)
        else if (lower.endsWith('.xml') || lower.endsWith('.osis')) mergeIn(fromXml(text))
        else if (lower.endsWith('.json')) mergeIn(fromJson(JSON.parse(text)))
      }
      continue
    }
    const text = await f.text()
    const head = text.trimStart()
    if (/\.(usfm|sfm)$/.test(name) || head.startsWith('\\id')) usfm.push(text)
    else if (head.startsWith('<')) mergeIn(fromXml(text))
    else if (head.startsWith('{') || head.startsWith('[')) mergeIn(fromJson(JSON.parse(text)))
    else mergeIn(fromLines(text))
  }
  mergeIn(fromUsfmTexts(usfm))
  // Drop any empty books.
  for (const [id, b] of merged) if (!b.chapters.some((ch) => ch && ch.length)) merged.delete(id)
  return merged
}

export function countVerses(books: BookMap): number {
  let n = 0
  books.forEach((b) => b.chapters.forEach((ch) => (n += ch?.length ?? 0)))
  return n
}

export type { Verse }
