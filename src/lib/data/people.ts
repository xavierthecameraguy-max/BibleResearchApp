// People, places and events of the Bible, linked to the verses that mention
// them. Built by scripts/data/people.mjs from two openly licensed datasets:
//
//   Theographic Bible Metadata (Robert Rouse and contributors), CC BY-SA 4.0:
//   every named person (3,000+) and place (1,300) with family links, the
//   verses that mention each one, and a timeline of 450 events with dates from
//   Floyd Nolen Jones's chronology. Short descriptions come from Easton's Bible
//   Dictionary (1897, public domain) as included in Theographic.
//
//   OpenBible.info Bible Geocoding, CC BY 4.0: map coordinates of each place's
//   most likely modern site, how confident scholars are in that identification,
//   and a link to the place's page on openbible.info.
//
// The combined data is shared under CC BY-SA 4.0 (see PEOPLE_CREDITS).
//
// Files under /data/people/ (book ids are USFM codes; a verse is a BBCCCVVV
// number, e.g. 43003016 = John 3:16):
//   people.json, places.json, events.json   full lists
//   byBook/<BOOK>.json   {"c": [{"<verse>": {"p": [person ids], "l": [place ids]}}, ...]}
//   refs/person-<x>.json, refs/place-<x>.json   {"<id>": [every verse that mentions it]},
//                        <x> = first letter of the id ("_" otherwise)
// Every function here returns null / [] when a file is missing or offline.

import { BOOKS } from '../books.ts'
import type { Passage } from '../references.ts'

const BASE = '/data/people'

export interface VerseRef {
  book: string // USFM id
  chapter: number
  verse: number
}

export type Gender = 'male' | 'female'

export interface Person {
  /** Stable id, e.g. "abraham_58" */
  id: string
  /** Name as it appears in the KJV, e.g. "Mary" */
  name: string
  /** Name that tells people apart, e.g. "Mary (Mother of Jesus)"; same as `name` when unique */
  title: string
  gender?: Gender
  /** Other names for the same person, e.g. Abram for Abraham */
  alsoCalled?: string[]
  /** One or two sentences from Easton's Bible Dictionary */
  description?: string
  /** Person ids */
  father?: string
  mother?: string
  siblings?: string[]
  halfSiblings?: string[]
  spouses?: string[]
  children?: string[]
  /** Years in astronomical numbering: -1995 = 1996 BC, 30 = AD 30. See formatYear(). */
  born?: number
  died?: number
  /** Place ids */
  birthPlace?: string
  deathPlace?: string
  /** Tribe or group names, e.g. "Tribe of Judah", "Apostles" */
  groups?: string[]
  /** Event ids in timeline order */
  events?: number[]
  /** The first verse that mentions them */
  firstRef: VerseRef | null
  /** Number of verses that mention them by name */
  verseCount: number
}

export interface Place {
  /** Stable id, e.g. "jerusalem_636" */
  id: string
  /** Name as it appears in the KJV */
  name: string
  /** Name that tells places apart, e.g. "Bethlehem (Zebulun)"; same as `name` when unique */
  title: string
  lat?: number
  lon?: number
  /** e.g. "city", "region", "mountain", "river", "gate" */
  type?: string
  /** One or two sentences from Easton's Bible Dictionary */
  description?: string
  /** 0-100: how confident scholars are in the location (OpenBible.info). Missing = not rated. */
  confidence?: number
  /** Modern site name when it differs, e.g. "Tell Hum" for Capernaum */
  modern?: string
  /** This place's page on openbible.info (photos, sources, alternatives) */
  openBibleUrl?: string
  /** Other names for the same spot, e.g. Zion for Jerusalem */
  alsoCalled?: string[]
  /** For another name of a place (Salem): the id of the main record (Jerusalem) */
  sameAs?: string
  /** On a main record: ids of the records for its other names */
  otherNames?: string[]
  /** Ids of the places it lies within (tribal territory, region, kingdom) */
  partOf?: string[]
  /** Event ids in timeline order */
  events?: number[]
  firstRef: VerseRef | null
  verseCount: number
}

export interface BibleEvent {
  id: number
  title: string
  /** Astronomical year (-4003 = 4004 BC); see formatYear() */
  startYear?: number
  /** "YYYY-MM-DD" when the day is known */
  date?: string
  /** e.g. "1D", "7D", "40Y" */
  duration?: string
  /** True when the year is only approximate */
  approx?: boolean
  /** Id of the larger event this is part of */
  partOf?: number
  notes?: string
  /** Person ids */
  people: string[]
  /** Place ids */
  places: string[]
  /** Passages that tell the event */
  refs: Passage[]
}

export interface ChapterEntities {
  /** Everyone named in the chapter, in order of first appearance, with the verses */
  people: { person: Person; verses: number[] }[]
  places: { place: Place; verses: number[] }[]
  /** Timeline events told (at least partly) in this chapter */
  events: BibleEvent[]
  /** verse number → ids of the people and places named in it */
  byVerse: Record<number, { people: string[]; places: string[] }>
}

export type EntityKind = 'person' | 'place' | 'event'

export type EntityHit =
  | { kind: 'person'; id: string; title: string; score: number; person: Person }
  | { kind: 'place'; id: string; title: string; score: number; place: Place }
  | { kind: 'event'; id: number; title: string; score: number; event: BibleEvent }

/** Credit lines for the Copyright / About page. */
export const PEOPLE_CREDITS = [
  {
    title: 'Theographic Bible Metadata',
    text: 'People, places, events and the verses that mention them from Theographic Bible Metadata by Robert Rouse and contributors (viz.bible), licensed CC BY-SA 4.0. Dates follow Floyd Nolen Jones, The Chronology of the Old Testament. Descriptions from Easton\'s Bible Dictionary (1897, public domain). Changes: fields trimmed, descriptions shortened, names given short qualifiers where people or places share a name. The combined people, places and events data in this app is shared under CC BY-SA 4.0.',
    license: 'CC BY-SA 4.0',
    url: 'https://github.com/robertrouse/theographic-bible-metadata',
  },
  {
    title: 'OpenBible.info Bible Geocoding',
    text: 'Map coordinates, identification confidence and modern site names from OpenBible.info Bible Geocoding Data, licensed CC BY 4.0 (OpenBible.info notes that some of its data comes from OpenStreetMap, © OpenStreetMap contributors, ODbL). Changes: matched to Theographic places by name and verses, confidence shown as 0-100, coordinates rounded.',
    license: 'CC BY 4.0',
    url: 'https://www.openbible.info/geo/',
  },
] as const

// ------------------------------------------------------------------ raw files

interface RawPerson extends Omit<Person, 'title' | 'firstRef'> {
  title?: string
  firstRef: number
}
interface RawPlace extends Omit<Place, 'title' | 'firstRef' | 'openBibleUrl'> {
  title?: string
  openBible?: string
  firstRef: number
}
interface RawEvent extends Omit<BibleEvent, 'refs'> {
  refs: [number, number][]
}
type RawChapter = Record<string, { p?: string[]; l?: string[] }>

const cache = new Map<string, Promise<unknown>>()

function load<T>(path: string): Promise<T | null> {
  let p = cache.get(path) as Promise<T | null> | undefined
  if (!p) {
    p = fetch(`${BASE}/${path}`)
      .then((r) => (r.ok ? (r.json() as Promise<T>) : null))
      .catch(() => null)
    cache.set(path, p)
  }
  return p
}

/** Memoise a derived value (lists, lookups) on top of the file cache. */
function derived<T>(key: string, make: () => Promise<T>): Promise<T> {
  let p = cache.get(key) as Promise<T> | undefined
  if (!p) {
    p = make()
    cache.set(key, p)
  }
  return p
}

/** BBCCCVVV → { book, chapter, verse } (null for 0 or out of range) */
export function decodeVerse(n: number): VerseRef | null {
  const book = BOOKS[Math.floor(n / 1_000_000) - 1]
  if (!book || !n) return null
  return { book: book.id, chapter: Math.floor(n / 1000) % 1000, verse: n % 1000 }
}

/** { book, chapter, verse } → BBCCCVVV */
export function encodeVerse(book: string, chapter: number, verse: number): number {
  const b = BOOKS.findIndex((x) => x.id === book) + 1
  return b * 1_000_000 + chapter * 1000 + verse
}

/** A single verse as a Passage (for formatReference / readerPath). */
export function verseToPassage(v: VerseRef): Passage {
  return { book: v.book, startChapter: v.chapter, startVerse: v.verse, endChapter: v.chapter, endVerse: v.verse }
}

function rangeToPassage([from, to]: [number, number]): Passage | null {
  const a = decodeVerse(from)
  if (!a) return null
  const b = to ? decodeVerse(to) : null
  if (!b || b.book !== a.book) return verseToPassage(a)
  return { book: a.book, startChapter: a.chapter, startVerse: a.verse, endChapter: b.chapter, endVerse: b.verse }
}

/** -4003 → "4004 BC", 30 → "AD 30" (the data uses astronomical years, which have a year 0). */
export function formatYear(year: number): string {
  return year <= 0 ? `${1 - year} BC` : `AD ${year}`
}

const byTitle = (a: { title: string }, b: { title: string }) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' })

// ------------------------------------------------------------------ people

/** Every person, A–Z by title. */
export function getPeople(): Promise<Person[]> {
  return derived('people:list', async () => {
    const raw = await load<RawPerson[]>('people.json')
    return (raw ?? []).map((r): Person => ({ ...r, title: r.title ?? r.name, firstRef: decodeVerse(r.firstRef) })).sort(byTitle)
  })
}

function peopleById(): Promise<Map<string, Person>> {
  return derived('people:map', async () => new Map((await getPeople()).map((p) => [p.id, p])))
}

export async function getPerson(id: string): Promise<Person | null> {
  return (await peopleById()).get(id) ?? null
}

export interface Relatives {
  father: Person | null
  mother: Person | null
  siblings: Person[]
  halfSiblings: Person[]
  spouses: Person[]
  children: Person[]
}

/** A person's family, as Person records. */
export async function getRelatives(id: string): Promise<Relatives | null> {
  const map = await peopleById()
  const p = map.get(id)
  if (!p) return null
  const one = (x?: string) => (x ? map.get(x) ?? null : null)
  const many = (xs?: string[]) => (xs ?? []).map((x) => map.get(x)).filter((x): x is Person => !!x)
  return {
    father: one(p.father),
    mother: one(p.mother),
    siblings: many(p.siblings),
    halfSiblings: many(p.halfSiblings),
    spouses: many(p.spouses),
    children: many(p.children),
  }
}

// ------------------------------------------------------------------ places

/** Every place, A–Z by title. */
export function getPlaces(): Promise<Place[]> {
  return derived('places:list', async () => {
    const raw = await load<RawPlace[]>('places.json')
    return (raw ?? [])
      .map(({ openBible, ...r }): Place => ({
        ...r,
        title: r.title ?? r.name,
        openBibleUrl: openBible ? `https://www.openbible.info/geo/ancient/${openBible}` : undefined,
        firstRef: decodeVerse(r.firstRef),
      }))
      .sort(byTitle)
  })
}

function placesById(): Promise<Map<string, Place>> {
  return derived('places:map', async () => new Map((await getPlaces()).map((p) => [p.id, p])))
}

export async function getPlace(id: string): Promise<Place | null> {
  return (await placesById()).get(id) ?? null
}

// ------------------------------------------------------------------ events

/** Every event, in timeline order. */
export function getEvents(): Promise<BibleEvent[]> {
  return derived('events:list', async () => {
    const raw = await load<RawEvent[]>('events.json')
    return (raw ?? []).map((e): BibleEvent => ({ ...e, refs: e.refs.map(rangeToPassage).filter((p): p is Passage => !!p) }))
  })
}

function eventsById(): Promise<Map<number, BibleEvent>> {
  return derived('events:map', async () => new Map((await getEvents()).map((e) => [e.id, e])))
}

export async function getEvent(id: number): Promise<BibleEvent | null> {
  return (await eventsById()).get(id) ?? null
}

/** Events a person took part in, or that happened at a place, in timeline order. */
export async function getEventsFor(kind: 'person' | 'place', id: string): Promise<BibleEvent[]> {
  const [events, entity] = await Promise.all([getEvents(), kind === 'person' ? getPerson(id) : getPlace(id)])
  // Theographic links events both ways (the event's participants / locations and
  // the person's or place's own timeline); use both.
  const own = new Set(entity?.events ?? [])
  return events.filter((e) => own.has(e.id) || (kind === 'person' ? e.people : e.places).includes(id))
}

/** Events whose passages touch this chapter, in timeline order. */
export async function getChapterEvents(book: string, chapter: number): Promise<BibleEvent[]> {
  const events = await getEvents()
  return events.filter((e) =>
    e.refs.some((r) => r.book === book && r.startChapter <= chapter && r.endChapter >= chapter),
  )
}

// ------------------------------------------------------------------ chapters and verses

function loadBook(book: string) {
  return load<{ c: RawChapter[] }>(`byBook/${book.toUpperCase()}.json`)
}

/** People, places and events in one chapter, for "People and places in this chapter". */
export async function getChapterEntities(book: string, chapter: number): Promise<ChapterEntities> {
  const [data, people, places, events] = await Promise.all([
    loadBook(book),
    peopleById(),
    placesById(),
    getChapterEvents(book.toUpperCase(), chapter),
  ])
  const ch = data?.c[chapter - 1] ?? {}
  const pv = new Map<string, number[]>()
  const lv = new Map<string, number[]>()
  const byVerse: ChapterEntities['byVerse'] = {}
  const verses = Object.keys(ch)
    .map(Number)
    .sort((a, b) => a - b)
  for (const v of verses) {
    const { p = [], l = [] } = ch[String(v)]
    byVerse[v] = { people: p, places: l }
    for (const id of p) (pv.get(id) ?? pv.set(id, []).get(id)!).push(v)
    for (const id of l) (lv.get(id) ?? lv.set(id, []).get(id)!).push(v)
  }
  return {
    people: [...pv].flatMap(([id, vs]) => {
      const person = people.get(id)
      return person ? [{ person, verses: vs }] : []
    }),
    places: [...lv].flatMap(([id, vs]) => {
      const place = places.get(id)
      if (!place) return []
      // Another name for a place (Judean → Judea) tagged in the same verses as the
      // main record would only repeat it.
      const main = place.sameAs ? lv.get(place.sameAs) : undefined
      if (main && vs.every((v) => main.includes(v))) return []
      return [{ place, verses: vs }]
    }),
    events,
    byVerse,
  }
}

/** People and places named in one verse. */
export async function getVerseEntities(
  book: string,
  chapter: number,
  verse: number,
): Promise<{ people: Person[]; places: Place[] }> {
  const [data, people, places] = await Promise.all([loadBook(book), peopleById(), placesById()])
  const entry = data?.c[chapter - 1]?.[String(verse)]
  const placeIds = entry?.l ?? []
  return {
    people: (entry?.p ?? []).map((id) => people.get(id)).filter((x): x is Person => !!x),
    // As in getChapterEntities: drop another name's record (Judean) when the main
    // record (Judea) is tagged in the same verse.
    places: placeIds
      .map((id) => places.get(id))
      .filter((x): x is Place => !!x && !(x.sameAs && placeIds.includes(x.sameAs))),
  }
}

/** Every verse that mentions a person or place, in Bible order. */
export async function getMentions(kind: 'person' | 'place', id: string): Promise<VerseRef[]> {
  const bucket = /^[a-z]/.test(id) ? id[0] : '_'
  const data = await load<Record<string, number[]>>(`refs/${kind}-${bucket}.json`)
  return (data?.[id] ?? []).map(decodeVerse).filter((v): v is VerseRef => !!v)
}

// ------------------------------------------------------------------ search

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** How well `q` matches a list of names (the first ones count most). 0 = no match. */
function nameScore(q: string, primary: string[], secondary: string[] = []): number {
  let best = 0
  const test = (name: string, weight: number) => {
    const n = fold(name)
    if (!n) return
    let s = 0
    if (n === q) s = 100
    else if (n.startsWith(q)) s = 70
    else if ((' ' + n).includes(' ' + q)) s = 50
    else if (q.length >= 3 && n.includes(q)) s = 25
    best = Math.max(best, s * weight)
  }
  for (const n of primary) test(n, 1)
  for (const n of secondary) test(n, 0.8)
  return best
}

/**
 * Find people, places and events by name ("mary", "abram", "jerus", "exodus").
 * Best matches first; among equal matches, the most-mentioned first.
 */
export async function searchEntities(
  query: string,
  options: { limit?: number; kinds?: EntityKind[] } = {},
): Promise<EntityHit[]> {
  const q = fold(query)
  if (!q) return []
  const kinds = options.kinds ?? ['person', 'place', 'event']
  const [people, places, events] = await Promise.all([
    kinds.includes('person') ? getPeople() : Promise.resolve([]),
    kinds.includes('place') ? getPlaces() : Promise.resolve([]),
    kinds.includes('event') ? getEvents() : Promise.resolve([]),
  ])
  const popularity = (n: number) => Math.log10(n + 1) * 4
  const hits: EntityHit[] = []
  for (const p of people) {
    const s = nameScore(q, [p.title, p.name], p.alsoCalled)
    if (s) hits.push({ kind: 'person', id: p.id, title: p.title, score: s + popularity(p.verseCount), person: p })
  }
  for (const p of places) {
    // Possessive name records with no verses ("Jerusalem's", "Zion's") only crowd the
    // results; the main record is found by its own name.
    if (p.sameAs && !p.verseCount && /['’]s$/.test(p.name)) continue
    const s = nameScore(q, [p.title, p.name], [...(p.alsoCalled ?? []), ...(p.modern ? [p.modern] : [])])
    if (s) hits.push({ kind: 'place', id: p.id, title: p.title, score: s + popularity(p.verseCount), place: p })
  }
  for (const e of events) {
    const s = nameScore(q, [e.title])
    if (s) hits.push({ kind: 'event', id: e.id, title: e.title, score: s * 0.9, event: e })
  }
  hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
  return hits.slice(0, options.limit ?? 30)
}
