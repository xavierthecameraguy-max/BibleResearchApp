// Cross-references from OpenBible.info (https://www.openbible.info/labs/cross-references/),
// licensed CC BY 4.0. Mostly derived from the public-domain Treasury of
// Scripture Knowledge, with community votes for relevance.
//
//   node scripts/data/xrefs.mjs
//
// Output: public/data/xrefs/<BOOK>.json, one per book:
//   { "c": [ chapter1, chapter2, ... ] } where each chapter is an object
//   { "<verse>": [[from, to, votes], ...] } sorted by votes (highest first).
//   `from`/`to` are BBCCCVVV numbers (BB = book 1-66). `to` is 0 for a
//   single verse. Only references with at least 1 vote are kept; ones the
//   community voted irrelevant (0 or below) are dropped.

import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { unzipSync, strFromU8 } from 'fflate'
import { BOOKS, findBook } from '../../src/lib/books.ts'

const URL = 'https://a.openbible.info/data/cross-references.zip'
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const out = join(root, 'public', 'data', 'xrefs')

const idx = new Map(BOOKS.map((b, i) => [b.id, i + 1]))
const osisBook = (osis) => {
  const b = findBook(osis)
  if (!b) throw new Error(`Unknown book ${osis}`)
  return b
}
const toInt = (ref) => {
  const [bk, c, v] = ref.split('.')
  const b = osisBook(bk)
  return idx.get(b.id) * 1_000_000 + Number(c) * 1000 + Number(v)
}

console.log('Downloading OpenBible.info cross-references…')
const res = await fetch(URL)
if (!res.ok) throw new Error(`Download failed: ${res.status}`)
const files = unzipSync(new Uint8Array(await res.arrayBuffer()))
const text = strFromU8(Object.values(files)[0])
const [header, ...lines] = text.split('\n')
console.log('Header:', header)

const byBook = new Map()
let kept = 0
for (const line of lines) {
  if (!line.trim()) continue
  const [from, to, votesRaw] = line.split('\t')
  const votes = Number(votesRaw)
  if (!(votes >= 1)) continue
  const [fb, fc, fv] = from.split('.')
  const book = osisBook(fb).id
  const [a, b] = to.split('-')
  const entry = [toInt(a), b ? toInt(b) : 0, votes]
  if (!byBook.has(book)) byBook.set(book, [])
  const chapters = byBook.get(book)
  const ci = Number(fc) - 1
  chapters[ci] ??= {}
  ;(chapters[ci][fv] ??= []).push(entry)
  kept++
}

mkdirSync(out, { recursive: true })
for (const b of BOOKS) {
  const chapters = byBook.get(b.id) ?? []
  const c = Array.from({ length: b.chapters }, (_, i) => {
    const ch = chapters[i] ?? {}
    for (const v of Object.keys(ch)) ch[v].sort((x, y) => y[2] - x[2])
    return ch
  })
  writeFileSync(join(out, `${b.id}.json`), JSON.stringify({ c }))
}
console.log(`Wrote ${kept.toLocaleString()} cross-references for ${byBook.size} books to public/data/xrefs/`)
