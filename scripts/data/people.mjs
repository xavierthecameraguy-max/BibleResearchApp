// Builds the offline "people, places and events" data the app reads from
// public/data/people/.
//
//   node scripts/data/people.mjs
//   node scripts/data/people.mjs --cache /some/folder   (keep the downloads there and
//                                                        reuse them on the next run)
//
// SOURCES (both downloaded from GitHub at a pinned commit, so the output only
// changes when the commits below are changed on purpose)
//
//   Theographic Bible Metadata, by Robert Rouse and contributors
//   https://github.com/robertrouse/theographic-bible-metadata
//   Licence: Creative Commons Attribution-ShareAlike 4.0 International
//   (CC BY-SA 4.0), stated in the repository's LICENSE file and readme. The
//   script checks the LICENSE file and stops if it no longer says that.
//   Used for: every person, place and event, the family links between people,
//   which verses mention whom and where, event dates (Floyd Nolen Jones's
//   chronology), and the short descriptions. Theographic takes those
//   descriptions from Easton's Bible Dictionary (1897, public domain).
//
//   OpenBible.info Bible Geocoding Data
//   https://github.com/openbibleinfo/Bible-Geocoding-Data
//   Licence: Creative Commons Attribution 4.0 International (CC BY 4.0), stated
//   in the repository's license.txt and readme and on https://www.openbible.info/geo/.
//   The script checks license.txt too.
//   Used for: map coordinates of each place's most likely modern location, how
//   confident scholars are in that identification, the modern site's name, and a
//   link to the place's page on openbible.info. Places are matched to
//   Theographic's by name and by the verses that mention them. Places with no
//   good match keep Theographic's own coordinates and get no confidence score.
//
// Because Theographic is CC BY-SA 4.0, the generated files are also shared
// under CC BY-SA 4.0. Credit: "Theographic Bible Metadata (theographic.com /
// viz.bible), CC BY-SA 4.0" and "OpenBible.info Bible Geocoding, CC BY 4.0".
// Changes made here: fields renamed and trimmed, descriptions shortened to their
// first sentence or two, people and places that share a name given a short
// qualifier such as "(son of Nathan)", coordinates taken from OpenBible where
// matched.
//
// OUTPUT (compact JSON; book ids are USFM codes like GEN, JHN, 1CO; a verse
// reference is a BBCCCVVV number, BB = book 1-66 in Protestant order, so
// 43003016 is John 3:16; a range is [from, to] with to = 0 for one verse)
//
//   people.json        [{id, name, title?, gender?, alsoCalled?, description?, father?,
//                        mother?, siblings?, halfSiblings?, spouses?, children?, born?,
//                        died?, birthPlace?, deathPlace?, groups?, events?, firstRef,
//                        verseCount}]  ids look like "abraham_58" (Theographic's
//                        personLookup); `title` is only present when it differs
//                        from `name` (e.g. "Mary (Mother of Jesus)"); born/died
//                        are years, negative = BC in astronomical numbering
//                        (-1995 = 1996 BC); events are event ids.
//   places.json        [{id, name, title?, lat?, lon?, type?, description?, confidence?,
//                        modern?, openBible?, alsoCalled?, sameAs?, otherNames?, partOf?,
//                        events?, firstRef, verseCount}]  ids look like
//                        "jerusalem_636"; confidence is 0-100 (OpenBible's score for
//                        the best identification / 10); `modern` is the modern site
//                        when its name differs; `openBible` is "<id>/<slug>" for
//                        https://www.openbible.info/geo/ancient/<id>/<slug>; `sameAs`
//                        points from another name to the main record (Salem →
//                        Jerusalem) and `otherNames` back the other way.
//   events.json        [{id, title, startYear, date?, duration?, approx?, partOf?, notes?,
//                        people, places, refs}]  in timeline order; id is
//                        Theographic's eventID; date is "YYYY-MM-DD" when known to
//                        the day; duration like "7D", "40Y"; refs are ranges.
//   byBook/<BOOK>.json {"c": [chapter1, chapter2, ...]} where each chapter is
//                        {"<verse>": {"p": [person ids], "l": [place ids]}}
//                        (empty lists left out).
//   refs/person-<x>.json, refs/place-<x>.json
//                      {"<id>": [BBCCCVVV, ...]} every verse that mentions each
//                        person / place, in Bible order; <x> is the first character
//                        of the id (a-z, or "_" for anything else).
//   meta.json          sources, commits, licences and counts.

import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BOOKS } from '../../src/lib/books.ts'
import { formatReference } from '../../src/lib/references.ts'

const THEO_COMMIT = '744355c7a5f38efd407bc67a5257c99aca9532bc'
const THEO = `https://raw.githubusercontent.com/robertrouse/theographic-bible-metadata/${THEO_COMMIT}`
const OB_COMMIT = '7eb18a5ee62f27b9b93bd6689ea272d76dd23b8f'
const OB = `https://raw.githubusercontent.com/openbibleinfo/Bible-Geocoding-Data/${OB_COMMIT}`

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const out = join(root, 'public', 'data', 'people')
const cacheArg = process.argv.indexOf('--cache')
const cacheDir = cacheArg > 0 ? process.argv[cacheArg + 1] : null
if (cacheDir) mkdirSync(cacheDir, { recursive: true })

async function download(url, name) {
  const cached = cacheDir && join(cacheDir, name)
  if (cached && existsSync(cached)) return readFileSync(cached, 'utf8')
  console.log(`Downloading ${url.replace(/^https:\/\/raw\.githubusercontent\.com\//, '')}…`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`)
  const text = await res.text()
  if (cached) writeFileSync(cached, text)
  return text
}

// ---------------------------------------------------------------- licences
const theoLicense = await download(`${THEO}/LICENSE`, 'theographic-LICENSE')
if (!theoLicense.includes('Attribution-ShareAlike 4.0 International')) {
  throw new Error('Theographic LICENSE no longer reads "Attribution-ShareAlike 4.0 International" - check it before using the data.')
}
const obLicense = await download(`${OB}/license.txt`, 'openbible-license.txt')
if (!/^\s*Attribution 4\.0 International/.test(obLicense)) {
  throw new Error('OpenBible license.txt no longer reads "Attribution 4.0 International" - check it before using the data.')
}

// ---------------------------------------------------------------- downloads
const tables = {}
for (const t of ['verses', 'people', 'places', 'events', 'peopleGroups']) {
  tables[t] = JSON.parse(await download(`${THEO}/json/${t}.json`, `theographic-${t}.json`))
  if (!Array.isArray(tables[t])) throw new Error(`Unexpected format in ${t}.json`)
}
const obAncient = (await download(`${OB}/data/ancient.jsonl`, 'openbible-ancient.jsonl'))
  .split('\n')
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l))

// ---------------------------------------------------------------- verses
// Theographic record id → BBCCCVVV number, plus each verse's position in the
// Bible (to join neighbouring verses into ranges).
const verseRef = new Map()
const verseIndex = new Map()
{
  const sorted = [...tables.verses].sort((a, b) => a.fields.verseID.localeCompare(b.fields.verseID))
  sorted.forEach((v, i) => {
    const n = Number(v.fields.verseID)
    const b = Math.floor(n / 1_000_000)
    const c = Math.floor(n / 1000) % 1000
    const book = BOOKS[b - 1]
    if (!book || c < 1 || c > book.chapters || n % 1000 < 1) throw new Error(`Bad verse id ${v.fields.verseID} (${v.fields.osisRef})`)
    verseRef.set(v.id, n)
    verseIndex.set(v.id, i)
  })
}
const refBook = (n) => BOOKS[Math.floor(n / 1_000_000) - 1]
const refText = (n) => {
  if (!refBook(n)) return ''
  const book = refBook(n).id
  const c = Math.floor(n / 1000) % 1000
  const v = n % 1000
  return formatReference({ book, startChapter: c, startVerse: v, endChapter: c, endVerse: v })
}

// ---------------------------------------------------------------- helpers
const ABBREV = /(?:^|[\s(])(?:St|Mt|Gr|Heb|Lat|Syr|Arab|Chald|Egypt|Assyr|Sept|Comp|comp|cf|Cf|viz|ver|vers|ch|vol|p|pp|Dr|Mr|No|ie|eg|i\.e|e\.g|A\.V|R\.V|B\.C|A\.D|[A-Z])$/
// "(1 Cor. 16:17), one of the members…" → "One of the members…": Easton's entries
// often open with the verses straight after the headword, which is not shown here.
// (Only a bracket holding nothing but verse references, followed by lower case.)
const VERSE_REF = String.raw`(?:[123]\s)?[A-Z][a-z]+\.?\s\d+(?::\d+)?(?:[-–]\d+(?::\d+)?)?`
const MORE_REFS = String.raw`(?:[;,]\s?(?:(?:[123]\s)?[A-Z][a-z]+\.?\s)?\d+(?::\d+)?(?:[-–]\d+(?::\d+)?)?)*`
const LEADING_REF_BRACKET = new RegExp(String.raw`^\(?${VERSE_REF}${MORE_REFS}\)[,;:]?\s+(?=[a-z“"])`)

/** First sentence or two of an Easton's paragraph, as plain text. */
function shortText(md, max = 300) {
  if (!md) return undefined
  const t = String(md)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // markdown links → their text
    .replace(/[_*]/g, '') // markdown emphasis
    .replace(/\s+/g, ' ')
    .replace(/^['=.\s]+/, '') // stray "'=" left at the start of a few entries
    // "1 Chr. 5:7. A Reubenite chief." → "A Reubenite chief." (the verses are listed anyway)
    .replace(/^(?:(?:[123]\s)?[A-Z][a-z]+\.?\s\d+(?::\d+)?(?:[-–,]\s?\d+(?::\d+)?)*[;,]?\s?)+[.,;]?\s+(?=[a-zA-Z])/, '')
    .replace(LEADING_REF_BRACKET, '')
    .replace(/^[a-z]/, (c) => c.toUpperCase())
    .trim()
  // Nothing but verse references ("1 Chr. 6:11; Ezra 7:3.") says nothing useful.
  const words = t
    .replace(/(?:[123]\s)?[A-Z][a-z]+\.?\s\d+(?::\d+)?(?:[-–,]\s?\d+(?::\d+)?)*/g, ' ')
    .match(/[A-Za-z’']{2,}/g)
  if (!words || words.length < 2) return undefined
  const ends = []
  let depth = 0
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]
    if (ch === '(' || ch === '[') depth++
    else if ((ch === ')' || ch === ']') && depth > 0) depth--
    else if (depth === 0 && (ch === '.' || ch === '!' || ch === '?')) {
      let j = i + 1
      while (j < t.length && /["”’)]/.test(t[j])) j++
      if (j >= t.length) ends.push(j)
      else if (t[j] === ' ' && /[A-Z“"‘(]/.test(t[j + 1] ?? '') && !(ch === '.' && ABBREV.test(t.slice(Math.max(0, i - 6), i)))) ends.push(j)
    }
  }
  // Short enough already: keep it whole unless it runs to several sentences.
  if (t.length <= max && ends.length <= 2) return t
  let end = 0
  for (const e of ends) {
    if (e > max) break
    end = e
    if (end >= 120) break
  }
  if (end) return t.slice(0, end).trim()
  const cut = t.lastIndexOf(' ', max - 1)
  return t.slice(0, cut > 40 ? cut : max - 1).replace(/[\s,;:(]+$/, '') + '…'
}

const ids = (list, map) => [...new Set((list ?? []).map((r) => map.get(r)).filter(Boolean))]
const opt = (list) => (list && list.length ? list : undefined)
const year = (s) => {
  if (s === undefined || s === null || s === '') return undefined
  const m = String(s).match(/^(-?\d+)/)
  return m ? Number(m[1]) : undefined
}
const bucket = (id) => (/^[a-z]/.test(id) ? id[0] : '_')
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z]/g, '')
const round = (x) => Math.round(x * 100000) / 100000

/**
 * People (or places) that share a title get a short qualifier. If one of them
 * is mentioned far more often than the rest (Joshua son of Nun), it keeps the
 * plain title.
 */
function disambiguate(items, qualify) {
  const groups = new Map()
  for (const it of items) {
    if (!groups.has(it.title)) groups.set(it.title, [])
    groups.get(it.title).push(it)
  }
  for (const [title, group] of groups) {
    if (group.length < 2) continue
    group.sort((a, b) => b.verseCount - a.verseCount)
    const keepPlain = group[0].verseCount >= 10 && group[0].verseCount >= 3 * group[1].verseCount
    for (const it of keepPlain ? group.slice(1) : group) {
      const q = qualify(it) ?? refText(it.firstRef)
      if (q) it.title = `${title} (${q})`
    }
    // Still the same? Add the first verse as well.
    const seen = new Map()
    for (const it of group) seen.set(it.title, (seen.get(it.title) ?? 0) + 1)
    for (const it of group) {
      const ref = refText(it.firstRef)
      if (ref && seen.get(it.title) > 1 && !it.title.endsWith(`${ref})`)) {
        it.title = it.title.endsWith(')') ? `${it.title.slice(0, -1)}, ${ref})` : `${it.title} (${ref})`
      }
    }
  }
}

// ---------------------------------------------------------------- mentions
// Built from the verse table (the same links Theographic shows on each verse).
const personRec = new Map(tables.people.map((p) => [p.id, p.fields.personLookup]))
const placeRec = new Map(tables.places.map((p) => [p.id, p.fields.placeLookup]))
const eventRec = new Map(tables.events.map((e) => [e.id, e.fields.eventID]))
const eventOrder = new Map(
  [...tables.events].sort((a, b) => (a.fields.sortKey ?? 0) - (b.fields.sortKey ?? 0)).map((e, i) => [e.fields.eventID, i]),
)
const timeline = (list) => opt(ids(list, eventRec).sort((a, b) => eventOrder.get(a) - eventOrder.get(b)))
const groupRec = new Map(tables.peopleGroups.map((g) => [g.id, g.fields.groupName]))

const mentions = { person: new Map(), place: new Map() }
const byBook = new Map()
for (const v of tables.verses) {
  const n = verseRef.get(v.id)
  const p = ids(v.fields.people, personRec)
  const l = ids(v.fields.places, placeRec)
  if (!p.length && !l.length) continue
  for (const id of p) (mentions.person.get(id) ?? mentions.person.set(id, []).get(id)).push(n)
  for (const id of l) (mentions.place.get(id) ?? mentions.place.set(id, []).get(id)).push(n)
  const book = refBook(n).id
  if (!byBook.has(book)) byBook.set(book, [])
  const chapters = byBook.get(book)
  const ci = (Math.floor(n / 1000) % 1000) - 1
  chapters[ci] ??= {}
  const entry = {}
  if (p.length) entry.p = p
  if (l.length) entry.l = l
  chapters[ci][String(n % 1000)] = entry
}
for (const m of Object.values(mentions)) for (const list of m.values()) list.sort((a, b) => a - b)

// ---------------------------------------------------------------- people
let peopleWithoutVerses = 0
const people = tables.people.map((r) => {
  const f = r.fields
  const refs = mentions.person.get(f.personLookup) ?? []
  if (!refs.length) peopleWithoutVerses++
  const gender = f.gender === 'Male' ? 'male' : f.gender === 'Female' ? 'female' : undefined
  // Other names, without plain nouns ("mother") or SHOUTED repeats ("LORD" when "Lord" is there).
  const seenNames = new Set([norm(f.name)])
  const alsoCalled = (f.alsoCalled ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^[A-Z]/.test(s))
    .sort((a, b) => Number(a === a.toUpperCase() && a.length > 1) - Number(b === b.toUpperCase() && b.length > 1))
    .filter((s) => !seenNames.has(norm(s)) && seenNames.add(norm(s)))
  const half = [...(f.halfSiblingsSameFather ?? []), ...(f.halfSiblingsSameMother ?? [])]
  const dict = Array.isArray(f.dictText) ? f.dictText[0] : f.dictText
  return {
    id: f.personLookup,
    name: f.name,
    title: f.displayTitle || f.name,
    gender,
    alsoCalled: opt(alsoCalled),
    description: shortText(dict ?? f.dictionaryText),
    father: ids(f.father, personRec)[0],
    mother: ids(f.mother, personRec)[0],
    siblings: opt(ids(f.siblings, personRec)),
    halfSiblings: opt(ids(half, personRec)),
    spouses: opt(ids(f.partners, personRec)),
    children: opt(ids(f.children, personRec)),
    born: year(f.birthYear),
    died: year(f.deathYear),
    birthPlace: ids(f.birthPlace, placeRec)[0],
    deathPlace: ids(f.deathPlace, placeRec)[0],
    groups: opt(ids(f.memberOf, groupRec)),
    events: timeline(f.timeline),
    firstRef: refs[0] ?? 0,
    verseCount: refs.length,
  }
})
const personById = new Map(people.map((p) => [p.id, p]))
disambiguate(people, (p) => {
  const kid = p.gender === 'female' ? 'daughter' : p.gender === 'male' ? 'son' : 'child'
  // Skip a relative whose name only repeats this person's own: "Daughter of Pharaoh
  // (daughter of Pharaoh)", "Pharaoh (father of Daughter of Pharaoh)".
  const relative = (id) => {
    const r = personById.get(id ?? '')
    // Whole words only: Joah son of Joahaz keeps his qualifier.
    const a = ` ${r?.name.toLowerCase()} `
    const b = ` ${p.name.toLowerCase()} `
    return r && (a === b || !(a.includes(b) || b.includes(a))) ? r : undefined
  }
  const parent = relative(p.father) ?? relative(p.mother)
  if (parent) return `${kid} of ${parent.name}`
  const child = relative(p.children?.[0])
  if (child) return `${p.gender === 'female' ? 'mother' : 'father'} of ${child.name}`
  const spouse = relative(p.spouses?.[0])
  if (spouse) return `${p.gender === 'female' ? 'wife' : p.gender === 'male' ? 'husband' : 'spouse'} of ${spouse.name}`
  return undefined
})

// ---------------------------------------------------------------- places
// Match each Theographic place to an OpenBible "ancient place": same name (in
// any of the translations OpenBible tracks) and the most verses in common.
const obByName = new Map()
for (const o of obAncient) {
  const names = new Set([norm(o.friendly_id.replace(/\s+\d+$/, ''))])
  for (const n of Object.keys(o.translation_name_counts ?? {})) names.add(norm(n))
  o.verseSet = new Set((o.verses ?? []).map((v) => Number(v.sort)))
  for (const n of names) {
    if (!obByName.has(n)) obByName.set(n, [])
    obByName.get(n).push(o)
  }
}
const pairs = []
for (const r of tables.places) {
  const f = r.fields
  const refs = mentions.place.get(f.placeLookup) ?? []
  const candidates = new Set([...(obByName.get(norm(f.kjvName)) ?? []), ...(obByName.get(norm(f.esvName)) ?? [])])
  for (const o of candidates) {
    let common = 0
    for (const n of refs) if (o.verseSet.has(n)) common++
    const dice = (2 * common) / (refs.length + o.verseSet.size)
    if (dice >= 0.5) pairs.push({ id: f.placeLookup, o, dice })
  }
}
pairs.sort((a, b) => b.dice - a.dice)
const obMatch = new Map()
const obUsed = new Set()
for (const x of pairs) {
  if (obMatch.has(x.id) || obUsed.has(x.o.id)) continue
  obMatch.set(x.id, x.o)
  obUsed.add(x.o.id)
}

function openBibleLocation(o) {
  const best = Object.values(o.modern_associations ?? {}).sort((a, b) => b.score - a.score)[0]
  if (!best) return null
  const [i, r] = best.identification_ids?.[0] ?? []
  const res = o.identifications?.[i]?.resolutions?.[r]
  const [lon, lat] = String(res?.lonlat ?? '').split(',').map(Number)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  // How the place relates to that modern site. For ">" (a region around it, like
  // Judea around Jerusalem) the site is only an anchor for the map pin, so it is
  // not given as the place's modern name.
  const modifier = o.identifications[i].modifier
  const name = best.name
  const lower = /^[a-z]/.test(name)
  const modern =
    modifier === '>' ? undefined
    : modifier === 'near' ? `near ${name}`
    : modifier === '<' ? (lower ? name : `in ${name}`)
    : modifier === 'along' ? `along ${name}`
    : modifier === 'on' ? `on ${name}`
    : name
  return { lat, lon, confidence: Math.round(Math.max(0, Math.min(1000, best.score)) / 10), modern }
}

let fromOpenBible = 0
let fromTheographic = 0
const places = tables.places.map((r) => {
  const f = r.fields
  const refs = mentions.place.get(f.placeLookup) ?? []
  const o = obMatch.get(f.placeLookup)
  const ob = o ? openBibleLocation(o) : null
  let lat, lon
  if (ob) {
    lat = ob.lat
    lon = ob.lon
    fromOpenBible++
  } else if (f.latitude && f.longitude && f.precision !== 'Unlocated') {
    lat = Number(f.latitude)
    lon = Number(f.longitude)
    if (Number.isFinite(lat) && Number.isFinite(lon)) fromTheographic++
  }
  const type = (f.featureSubType ?? f.featureType ?? (o?.types?.[0] === 'settlement' ? 'city' : o?.types?.[0]))?.toLowerCase()
  const dict = Array.isArray(f.dictText) ? f.dictText[0] : f.dictText
  const aliases = (f.aliases ?? '').split(',').map((s) => s.trim()).filter((s) => s && s !== f.kjvName)
  const modern = ob?.modern && norm(ob.modern) !== norm(f.kjvName) && norm(ob.modern) !== norm(f.esvName) ? ob.modern : undefined
  return {
    id: f.placeLookup,
    name: f.kjvName,
    title: f.displayTitle || f.kjvName,
    lat: Number.isFinite(lat) && Number.isFinite(lon) ? round(lat) : undefined,
    lon: Number.isFinite(lat) && Number.isFinite(lon) ? round(lon) : undefined,
    type,
    description: shortText(dict ?? f.dictionaryText),
    confidence: ob?.confidence,
    modern,
    openBible: o ? `${o.id}/${o.url_slug}` : undefined,
    alsoCalled: opt([...new Set(aliases)]),
    sameAs: ids(f.canonicalPlace, placeRec)[0],
    otherNames: opt(ids(f.otherNames, placeRec)),
    partOf: opt(ids(f.partOf, placeRec)),
    events: timeline(f.eventsHere),
    firstRef: refs[0] ?? 0,
    verseCount: refs.length,
  }
})
const placeById = new Map(places.map((p) => [p.id, p]))
// "Bethlehem (Zebulun)": the plain name of the first place it lies within.
const plainName = new Map(places.map((p) => [p.id, p.title.replace(/\s*\(.*\)\s*$/, '')]))
disambiguate(places, (p) => (p.partOf ?? []).map((id) => plainName.get(id)).find((t) => t && t !== p.name))

// ---------------------------------------------------------------- events
const refAt = []
for (const [rec, i] of verseIndex) refAt[i] = verseRef.get(rec)
function ranges(verseRecs) {
  const idx = [...new Set((verseRecs ?? []).map((v) => verseIndex.get(v)).filter((i) => i !== undefined))].sort((a, b) => a - b)
  const byIdx = { get: (i) => refAt[i] }
  const outRanges = []
  let start = null
  let prev = null
  for (const i of idx) {
    if (start !== null && i === prev + 1 && refBook(byIdx.get(i)) === refBook(byIdx.get(start))) {
      prev = i
      continue
    }
    if (start !== null) outRanges.push([byIdx.get(start), prev === start ? 0 : byIdx.get(prev)])
    start = prev = i
  }
  if (start !== null) outRanges.push([byIdx.get(start), prev === start ? 0 : byIdx.get(prev)])
  return outRanges
}
const events = [...tables.events]
  .sort((a, b) => (a.fields.sortKey ?? 0) - (b.fields.sortKey ?? 0))
  .map((r) => {
    const f = r.fields
    const date = /^-?\d{4}-\d{2}-\d{2}$/.test(f.startDate ?? '') ? f.startDate : undefined
    const peopleIds = ids(f.participants?.length ? f.participants : f['people (from verses)'], personRec)
    const placeIds = ids(f.locations?.length ? f.locations : f['places (from verses)'], placeRec)
    const notes = (f.notes ?? '').trim()
    return {
      id: f.eventID,
      title: (f.title ?? '').trim(),
      startYear: year(f.startDate),
      date,
      duration: f.duration || undefined,
      approx: f.rangeFlag ? true : undefined,
      partOf: ids(f.partOf, eventRec)[0],
      notes: notes || undefined,
      people: peopleIds,
      places: placeIds,
      refs: ranges(f.verses),
    }
  })

// ---------------------------------------------------------------- write
rmSync(out, { recursive: true, force: true })
mkdirSync(join(out, 'byBook'), { recursive: true })
mkdirSync(join(out, 'refs'), { recursive: true })
const write = (rel, data) => writeFileSync(join(out, rel), JSON.stringify(data))
const clean = (o) => {
  for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k]
  return o
}

write(
  'people.json',
  people.map((p) => clean({ ...p, title: p.title !== p.name ? p.title : undefined })),
)
write(
  'places.json',
  places.map((p) => clean({ ...p, title: p.title !== p.name ? p.title : undefined })),
)
write('events.json', events.map(clean))
for (const b of BOOKS) {
  const chapters = byBook.get(b.id) ?? []
  write(`byBook/${b.id}.json`, { c: Array.from({ length: b.chapters }, (_, i) => chapters[i] ?? {}) })
}
for (const [kind, map] of Object.entries(mentions)) {
  const buckets = new Map()
  for (const [id, list] of map) {
    const k = bucket(id)
    if (!buckets.has(k)) buckets.set(k, {})
    buckets.get(k)[id] = list
  }
  for (const [k, data] of buckets) write(`refs/${kind}-${k}.json`, data)
}
write('meta.json', {
  sources: [
    {
      name: 'Theographic Bible Metadata',
      url: 'https://github.com/robertrouse/theographic-bible-metadata',
      commit: THEO_COMMIT,
      license: 'CC BY-SA 4.0',
    },
    {
      name: 'OpenBible.info Bible Geocoding Data',
      url: 'https://github.com/openbibleinfo/Bible-Geocoding-Data',
      commit: OB_COMMIT,
      license: 'CC BY 4.0',
    },
  ],
  license: 'CC BY-SA 4.0',
  counts: { people: people.length, places: places.length, events: events.length },
})

// Cross-check our verse counts against Theographic's own.
let countMismatch = 0
for (const r of tables.people) if ((personById.get(r.fields.personLookup)?.verseCount ?? 0) !== (r.fields.verses?.length ?? 0)) countMismatch++
let placeMismatch = 0
for (const r of tables.places) if ((placeById.get(r.fields.placeLookup)?.verseCount ?? 0) !== (r.fields.verses?.length ?? 0)) placeMismatch++

console.log(`People: ${people.length} (${peopleWithoutVerses} with no tagged verse, ${countMismatch} whose verse count differs from Theographic's own list)`)
console.log(`Places: ${places.length} (${obMatch.size} matched to OpenBible; coordinates from OpenBible ${fromOpenBible}, from Theographic ${fromTheographic}; ${placeMismatch} count differences)`)
console.log(`Events: ${events.length}`)
console.log(`Verses with people or places: ${[...byBook.values()].reduce((s, ch) => s + ch.reduce((t, c) => t + Object.keys(c ?? {}).length, 0), 0)}`)
console.log('Wrote public/data/people/')
