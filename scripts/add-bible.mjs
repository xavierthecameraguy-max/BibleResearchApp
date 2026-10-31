// Builds a Bible translation from YOUR OWN file into this copy of the app,
// so it works offline on every device with no importing. For personal use
// with a translation you own (or have permission to use).
//
//   npm run add-bible -- NKJV "New King James Version" private/nkjv.zip
//
// The arguments are: short name, full name, then one or more files.
// Accepts USFM (.usfm/.sfm or a .zip of them), JSON, or text lines. For
// OSIS/Zefania XML, use Settings → "Add a translation" inside the app.
//
// The result goes in public/bible/private/, which Git ignores, so the text
// is never committed or pushed to GitHub. To remove it:
//   npm run add-bible -- --remove NKJV

import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join, dirname, basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseBibleFiles, countVerses } from '../src/lib/bibleImport.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outRoot = join(root, 'public', 'bible', 'private')
const manifestPath = join(outRoot, 'translations.json')
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : []

const args = process.argv.slice(2)

if (args[0] === '--remove') {
  const id = (args[1] ?? '').toLowerCase()
  rmSync(join(outRoot, id), { recursive: true, force: true })
  const left = manifest.filter((t) => t.id !== id)
  mkdirSync(outRoot, { recursive: true })
  writeFileSync(manifestPath, JSON.stringify(left, null, 2))
  console.log(`Removed ${id.toUpperCase()}. Run npm run build to update the app.`)
  process.exit(0)
}

const [abbr, name, ...paths] = args
if (!abbr || !name || !paths.length) {
  console.error('Usage: npm run add-bible -- NKJV "New King James Version" path/to/your-file.zip')
  process.exit(1)
}

const files = paths.map((p) => {
  const full = resolve(p)
  if (!existsSync(full)) {
    console.error(`Can't find the file: ${p}`)
    process.exit(1)
  }
  return new File([readFileSync(full)], basename(full))
})

let books
try {
  books = await parseBibleFiles(files)
} catch (e) {
  console.error(`Couldn't read that file: ${e.message}`)
  console.error('If it is XML, import it from inside the app instead (Settings → Add a translation).')
  process.exit(1)
}
if (!books.size) {
  console.error('No Bible books were found in that file. See the README for the formats that work.')
  process.exit(1)
}

const id = abbr.toLowerCase().replace(/[^a-z0-9]+/g, '-')
const dir = join(outRoot, id)
rmSync(dir, { recursive: true, force: true })
mkdirSync(dir, { recursive: true })
for (const book of books.values()) writeFileSync(join(dir, `${book.id}.json`), JSON.stringify(book))

const entry = {
  id,
  dir: `private/${id}`,
  abbr: abbr.toUpperCase(),
  name,
  notice: `${name} (${abbr.toUpperCase()}). Built from your own copy for personal study.`,
  books: [...books.keys()],
}
writeFileSync(manifestPath, JSON.stringify([entry, ...manifest.filter((t) => t.id !== id)], null, 2))

console.log(`Added ${entry.abbr}: ${books.size} books, ${countVerses(books).toLocaleString()} verses.`)
console.log('It is now the default translation. Run "npm run dev" to see it, or "npm run build" to rebuild the app.')
if (books.size < 66) console.log(`(Only ${books.size} of 66 books were found; the others will show in KJV.)`)
