// Converts public-domain Bible translations from eBible.org (USFM format)
// into the small JSON files the app reads, one file per book.
//
// You only need this if you want to re-generate the bundled Bibles. The
// generated files are already in public/bible/.
//
//   npm run build-bible
//
// Sources (all public domain):
//   KJV  https://ebible.org/Scriptures/eng-kjv_usfm.zip  (1769 standard text)
//   WEB  https://ebible.org/Scriptures/eng-web_usfm.zip  (World English Bible)
//   BSB  Berean Standard Bible, official USFM from BSB Publishing (public domain
//        since April 30, 2023: https://berean.bible/terms.htm), pinned release.

import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { unzipSync, strFromU8 } from 'fflate'
import { parseUsfm } from '../src/lib/usfm.ts'
import { BOOKS } from '../src/lib/books.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const only = process.argv[2] // optional: build just one, e.g. "bsb"
const SOURCES = [
  { id: 'kjv', url: 'https://ebible.org/Scriptures/eng-kjv_usfm.zip' },
  { id: 'web', url: 'https://ebible.org/Scriptures/eng-web_usfm.zip' },
  {
    id: 'bsb',
    url: 'https://github.com/BSB-publishing/bsb2usfm/releases/download/v5.19/BSB_usfm.zip',
    // The official files have a few stray spaces before punctuation ("Nevertheless ,").
    // Removing them changes no words, so the text stays verbatim.
    tidy: true,
  },
]

function tidy(text) {
  return text
    .split('\n')
    .map((l) => l.replace(/\s+([,.;:!?’”)\]])/g, '$1').replace(/([‘“(\[])\s+/g, '$1').replace(/\s{2,}/g, ' ').trim())
    .join('\n')
}

const wanted = new Set(BOOKS.map((b) => b.id))

for (const src of SOURCES.filter((s) => !only || s.id === only)) {
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
    if (src.tidy) for (const ch of book.chapters) for (const v of ch) v.t = tidy(v.t)
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
