// Converts public-domain Bible translations from eBible.org (USFM format)
// into the small JSON files the app reads, one file per book.
//
// You only need this if you want to re-generate the bundled Bibles. The
// generated files are already in public/bible/.
//
//   npm run build-bible
//
// Sources (both marked "Public Domain" by eBible.org):
//   KJV  https://ebible.org/Scriptures/eng-kjv_usfm.zip  (1769 standard text)
//   WEB  https://ebible.org/Scriptures/eng-web_usfm.zip  (World English Bible)

import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { unzipSync, strFromU8 } from 'fflate'
import { parseUsfm } from '../src/lib/usfm.ts'
import { BOOKS } from '../src/lib/books.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const SOURCES = [
  { id: 'kjv', url: 'https://ebible.org/Scriptures/eng-kjv_usfm.zip' },
  { id: 'web', url: 'https://ebible.org/Scriptures/eng-web_usfm.zip' },
]

const wanted = new Set(BOOKS.map((b) => b.id))

for (const src of SOURCES) {
  console.log(`Downloading ${src.id.toUpperCase()}…`)
  const res = await fetch(src.url)
  if (!res.ok) throw new Error(`Could not download ${src.url}: ${res.status}`)
  const files = unzipSync(new Uint8Array(await res.arrayBuffer()))
  const outDir = join(root, 'public', 'bible', src.id)
  mkdirSync(outDir, { recursive: true })
  let count = 0
  for (const [name, data] of Object.entries(files)) {
    if (!name.endsWith('.usfm')) continue
    const book = parseUsfm(strFromU8(data))
    if (!book || !wanted.has(book.id)) continue
    const info = BOOKS.find((b) => b.id === book.id)
    if (book.chapters.length !== info.chapters) {
      console.warn(`  ${book.id}: expected ${info.chapters} chapters, found ${book.chapters.length}`)
    }
    writeFileSync(join(outDir, `${book.id}.json`), JSON.stringify(book))
    count++
  }
  if (count !== 66) throw new Error(`${src.id}: expected 66 books, wrote ${count}`)
  console.log(`  wrote ${count} books to public/bible/${src.id}/`)
}
