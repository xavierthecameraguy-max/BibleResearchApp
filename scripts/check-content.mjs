// Checks everything in content/ before the app is built, and explains any
// problem in plain English. Run it yourself with:  npm run check-content

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseLesson, TRACK_IDS } from '../src/lib/lessonFormat.ts'
import { BOOK_IDS } from '../src/lib/books.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'content')
const problems = []

function readJson(name) {
  const path = join(root, name)
  if (!existsSync(path)) {
    problems.push(`${name} is missing`)
    return []
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    problems.push(`${name} is not valid JSON: ${e.message}`)
    return []
  }
}

const tracks = readJson('tracks.json')
const glossary = readJson('glossary.json')
const timeline = readJson('timeline.json')
const intros = readJson('book-intros.json')
const resources = readJson('resources.json')

const glossaryIds = new Set()
for (const g of glossary) {
  if (!g.id || !g.term || !g.definition) problems.push(`glossary.json: every entry needs id, term and definition (${JSON.stringify(g).slice(0, 60)}…)`)
  if (glossaryIds.has(g.id)) problems.push(`glossary.json: "${g.id}" appears twice`)
  glossaryIds.add(g.id)
}

const lessonIds = new Set()
let lessonCount = 0
for (const track of TRACK_IDS) {
  if (!tracks.some((t) => t.id === track)) problems.push(`tracks.json: track "${track}" is missing`)
  const dir = join(root, 'lessons', track)
  if (!existsSync(dir)) continue
  const orders = new Set()
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.md')).sort()) {
    const name = `lessons/${track}/${file}`
    const { lesson, problems: p } = parseLesson(readFileSync(join(dir, file), 'utf8'), name, glossaryIds)
    problems.push(...p)
    if (!lesson) continue
    lessonCount++
    if (lesson.track !== track) problems.push(`${name}: track is "${lesson.track}" but the file is in the ${track} folder`)
    if (lessonIds.has(lesson.id)) problems.push(`${name}: id "${lesson.id}" is used by another lesson`)
    if (orders.has(lesson.order)) problems.push(`${name}: another lesson in ${track} already has order ${lesson.order}`)
    lessonIds.add(lesson.id)
    orders.add(lesson.order)
  }
}

const eventIds = new Set()
for (const e of timeline) {
  if (!e.id || typeof e.year !== 'number' || !e.title || !e.when) problems.push(`timeline.json: event needs id, year (a number), when and title (${e.id ?? e.title})`)
  if (eventIds.has(e.id)) problems.push(`timeline.json: id "${e.id}" appears twice`)
  eventIds.add(e.id)
  if (e.lessonId && !lessonIds.has(e.lessonId)) problems.push(`timeline.json: "${e.id}" links to lesson "${e.lessonId}", which does not exist`)
}

const introIds = intros.map((b) => b.id)
for (const id of BOOK_IDS) if (!introIds.includes(id)) problems.push(`book-intros.json: no intro for ${id}`)
for (const b of intros) {
  if (b.lessonId && !lessonIds.has(b.lessonId)) problems.push(`book-intros.json: ${b.id} links to lesson "${b.lessonId}", which does not exist`)
}

if (!Array.isArray(resources.sections)) problems.push('resources.json: needs a "sections" list')

if (problems.length) {
  console.error(`\nFound ${problems.length} problem(s) in the content folder:\n`)
  for (const p of problems) console.error('  • ' + p)
  console.error('\nFix these and run the command again.\n')
  process.exit(1)
}
console.log(`Content OK: ${lessonCount} lessons, ${glossary.length} glossary terms, ${timeline.length} timeline events, ${intros.length} book intros.`)
