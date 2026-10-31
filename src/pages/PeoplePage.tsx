// People, places and events in the Bible (Theographic Bible Metadata, CC BY-SA 4.0;
// coordinates from OpenBible.info, CC BY 4.0).

import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  formatYear,
  getEventsFor,
  getMentions,
  getPeople,
  getPerson,
  getPlace,
  getPlaces,
  getRelatives,
  searchEntities,
  verseToPassage,
  type BibleEvent,
  type EntityHit,
  type Person,
  type Place,
  type Relatives,
  type VerseRef,
} from '../lib/data/people.ts'
import { BUNDLED, loadBook } from '../lib/bible.ts'
import { formatReference, readerPath } from '../lib/references.ts'
import { useTitle } from '../lib/hooks.ts'
import { Card, ExternalA, PageTitle, buttonClass } from '../components/ui.tsx'

export const personPath = (id: string) => `/people/${encodeURIComponent(id)}`
export const placePath = (id: string) => `/places/${encodeURIComponent(id)}`

/**
 * Dates come from one traditional chronology (Floyd Nolen Jones). Before
 * Abraham, events can't be dated in any way scholars agree on, so we don't
 * show a year at all.
 */
export function safeYear(y?: number): string | null {
  if (y === undefined || y < -2100) return null
  return formatYear(y)
}

const DATE_NOTE =
  'Dates follow one traditional chronology and are approximate; many scholars date early events differently or think they can’t be dated.'

function Mentions({ kind, id }: { kind: 'person' | 'place'; id: string }) {
  const [refs, setRefs] = useState<VerseRef[] | null>(null)
  const [shown, setShown] = useState(20)
  const [texts, setTexts] = useState<Record<string, string>>({})
  useEffect(() => {
    let cancelled = false
    setRefs(null)
    setShown(20)
    getMentions(kind, id).then((r) => !cancelled && setRefs(r))
    return () => {
      cancelled = true
    }
  }, [kind, id])
  useEffect(() => {
    let cancelled = false
    refs?.slice(0, shown).forEach((r) => {
      const k = `${r.book}.${r.chapter}.${r.verse}`
      if (texts[k] !== undefined) return
      loadBook('bsb', r.book).then((b) => {
        const v = b?.chapters[r.chapter - 1]?.find((x) => x.v === r.verse)
        if (!cancelled) setTexts((t) => ({ ...t, [k]: v?.t.replace(/\n/g, ' ') ?? '' }))
      })
    })
    return () => {
      cancelled = true
    }
  }, [refs, shown]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!refs) return <p className="mt-4 text-stone-600 dark:text-stone-400">Finding every mention…</p>
  return (
    <section className="mt-6" aria-labelledby="mentions">
      <h2 id="mentions" className="font-serif text-2xl font-semibold">
        Mentioned in {refs.length} verse{refs.length === 1 ? '' : 's'}
      </h2>
      <ul className="mt-3 space-y-2">
        {refs.slice(0, shown).map((r) => {
          const p = verseToPassage(r)
          const k = `${r.book}.${r.chapter}.${r.verse}`
          return (
            <li key={k}>
              <Link
                to={readerPath(p)}
                className="block rounded-xl border border-stone-200 bg-white p-3 hover:bg-stone-50 dark:border-stone-800 dark:bg-stone-900 dark:hover:bg-stone-800"
              >
                <span className="font-semibold text-amber-800 dark:text-amber-300">{formatReference(p)}</span>
                <span className="mt-0.5 line-clamp-2 block font-serif leading-relaxed">{texts[k] ?? '…'}</span>
              </Link>
            </li>
          )
        })}
      </ul>
      {shown < refs.length && (
        <button type="button" className={buttonClass('secondary', 'mt-3 w-full')} onClick={() => setShown((n) => n + 40)}>
          Show more ({refs.length - shown} left)
        </button>
      )}
      <p className="mt-2 text-xs text-stone-600 dark:text-stone-400">Verses shown in the {BUNDLED.find((t) => t.id === 'bsb')?.abbr}.</p>
    </section>
  )
}

function Events({ events }: { events: BibleEvent[] }) {
  if (!events.length) return null
  return (
    <Card className="mt-4">
      <h2 className="font-semibold">Events</h2>
      <ol className="mt-2 space-y-2">
        {events.slice(0, 30).map((e) => (
          <li key={e.id}>
            <span className="font-semibold">{e.title}</span>
            {safeYear(e.startYear) && <span className="text-sm text-stone-600 dark:text-stone-400"> · {safeYear(e.startYear)}</span>}
            <span className="block text-sm">
              {e.refs.slice(0, 3).map((r, i) => (
                <span key={i}>
                  {i > 0 && ', '}
                  <Link to={readerPath(r)} className="underline underline-offset-2">
                    {formatReference(r)}
                  </Link>
                </span>
              ))}
            </span>
          </li>
        ))}
      </ol>
    </Card>
  )
}

function PersonLinks({ label, people }: { label: string; people: (Person | null)[] }) {
  const list = people.filter((p): p is Person => !!p)
  if (!list.length) return null
  return (
    <div>
      <dt className="text-sm font-semibold text-stone-600 dark:text-stone-400">{label}</dt>
      <dd className="mt-0.5 flex flex-wrap gap-x-3">
        {list.map((p) => (
          <Link key={p.id} to={personPath(p.id)} className="text-amber-800 underline underline-offset-2 dark:text-amber-300">
            {p.title}
          </Link>
        ))}
      </dd>
    </div>
  )
}

export function PersonPage() {
  const { id = '' } = useParams()
  const pid = decodeURIComponent(id)
  const [person, setPerson] = useState<Person | null | undefined>(undefined)
  const [rel, setRel] = useState<Relatives | null>(null)
  const [events, setEvents] = useState<BibleEvent[]>([])
  const [places, setPlaces] = useState<{ birth?: Place | null; death?: Place | null }>({})
  useTitle(person?.title ?? 'Person')
  useEffect(() => {
    let cancelled = false
    setPerson(undefined)
    getPerson(pid).then(async (p) => {
      if (cancelled) return
      setPerson(p)
      if (!p) return
      const [r, ev, birth, death] = await Promise.all([
        getRelatives(pid),
        getEventsFor('person', pid),
        p.birthPlace ? getPlace(p.birthPlace) : null,
        p.deathPlace ? getPlace(p.deathPlace) : null,
      ])
      if (!cancelled) {
        setRel(r)
        setEvents(ev)
        setPlaces({ birth, death })
      }
    })
    return () => {
      cancelled = true
    }
  }, [pid])

  if (person === undefined) return <p className="text-stone-600 dark:text-stone-400">Loading…</p>
  if (!person) return <PageTitle sub="This person isn't in the data, or it isn't saved on this device yet.">Not found</PageTitle>
  const born = safeYear(person.born)
  const died = safeYear(person.died)
  return (
    <article>
      <p className="text-sm font-semibold uppercase tracking-wide text-stone-600 dark:text-stone-400">Person</p>
      <h1 className="mt-1 font-serif text-4xl font-semibold">{person.title}</h1>
      {person.alsoCalled?.length ? <p className="mt-1 text-stone-600 dark:text-stone-400">Also called {person.alsoCalled.join(', ')}</p> : null}
      {person.description && <p className="mt-4 text-lg leading-relaxed">{person.description}</p>}

      <Card className="mt-5">
        <dl className="space-y-3">
          <PersonLinks label="Father" people={[rel?.father ?? null]} />
          <PersonLinks label="Mother" people={[rel?.mother ?? null]} />
          <PersonLinks label={rel?.spouses.length === 1 ? 'Spouse' : 'Spouses'} people={rel?.spouses ?? []} />
          <PersonLinks label="Children" people={rel?.children ?? []} />
          <PersonLinks label="Brothers and sisters" people={rel?.siblings ?? []} />
          <PersonLinks label="Half-brothers and sisters" people={rel?.halfSiblings ?? []} />
          {person.groups?.length ? (
            <div>
              <dt className="text-sm font-semibold text-stone-600 dark:text-stone-400">Group</dt>
              <dd>{person.groups.join(', ')}</dd>
            </div>
          ) : null}
          {(born || died || places.birth || places.death) && (
            <div>
              <dt className="text-sm font-semibold text-stone-600 dark:text-stone-400">Life</dt>
              <dd>
                {born && <>Born about {born}</>}
                {places.birth && (
                  <>
                    {born ? ' in ' : 'Born in '}
                    <Link to={placePath(places.birth.id)} className="underline">
                      {places.birth.title}
                    </Link>
                  </>
                )}
                {(born || places.birth) && (died || places.death) && '. '}
                {died && <>Died about {died}</>}
                {places.death && (
                  <>
                    {died ? ' in ' : 'Died in '}
                    <Link to={placePath(places.death.id)} className="underline">
                      {places.death.title}
                    </Link>
                  </>
                )}
                {(born || died) && <span className="mt-1 block text-xs text-stone-600 dark:text-stone-400">{DATE_NOTE}</span>}
              </dd>
            </div>
          )}
        </dl>
        {!rel?.father && !rel?.mother && !rel?.spouses.length && !rel?.children.length && !born && !person.groups?.length && (
          <p className="text-stone-600 dark:text-stone-400">No family details recorded.</p>
        )}
      </Card>
      <Events events={events} />
      <Mentions kind="person" id={pid} />
    </article>
  )
}

export function PlacePage() {
  const { id = '' } = useParams()
  const pid = decodeURIComponent(id)
  const [place, setPlace] = useState<Place | null | undefined>(undefined)
  const [events, setEvents] = useState<BibleEvent[]>([])
  const [parents, setParents] = useState<Place[]>([])
  useTitle(place?.title ?? 'Place')
  useEffect(() => {
    let cancelled = false
    setPlace(undefined)
    getPlace(pid).then(async (p) => {
      if (cancelled) return
      setPlace(p)
      if (!p) return
      const [ev, par] = await Promise.all([getEventsFor('place', pid), Promise.all((p.partOf ?? []).map((x) => getPlace(x)))])
      if (!cancelled) {
        setEvents(ev)
        setParents(par.filter((x): x is Place => !!x))
      }
    })
    return () => {
      cancelled = true
    }
  }, [pid])

  if (place === undefined) return <p className="text-stone-600 dark:text-stone-400">Loading…</p>
  if (!place) return <PageTitle sub="This place isn't in the data, or it isn't saved on this device yet.">Not found</PageTitle>
  const has = place.lat !== undefined && place.lon !== undefined
  const d = 0.35
  return (
    <article>
      <p className="text-sm font-semibold uppercase tracking-wide text-stone-600 dark:text-stone-400">Place{place.type ? ` · ${place.type}` : ''}</p>
      <h1 className="mt-1 font-serif text-4xl font-semibold">{place.title}</h1>
      {place.alsoCalled?.length ? <p className="mt-1 text-stone-600 dark:text-stone-400">Also called {place.alsoCalled.join(', ')}</p> : null}
      {place.description && <p className="mt-4 text-lg leading-relaxed">{place.description}</p>}

      {has && (
        <Card className="mt-5 p-0">
          <iframe
            title={`Map of ${place.title}`}
            className="h-64 w-full rounded-t-2xl border-0"
            loading="lazy"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${place.lon! - d}%2C${place.lat! - d}%2C${place.lon! + d}%2C${place.lat! + d}&layer=mapnik&marker=${place.lat}%2C${place.lon}`}
          />
          <div className="p-4 text-sm">
            <p>
              {place.modern && <>Modern site: {place.modern}. </>}
              {place.confidence !== undefined && (
                <>
                  Location confidence: {place.confidence >= 80 ? 'high' : place.confidence >= 40 ? 'medium' : 'low'} ({place.confidence}/100).
                </>
              )}
            </p>
            <p className="mt-2 flex flex-wrap gap-x-4">
              <ExternalA href={`https://maps.apple.com/?ll=${place.lat},${place.lon}&q=${encodeURIComponent(place.name)}`} className="underline">
                Open in Maps
              </ExternalA>
              {place.openBibleUrl && (
                <ExternalA href={place.openBibleUrl} className="underline">
                  OpenBible.info
                </ExternalA>
              )}
            </p>
            <p className="mt-2 text-xs text-stone-600 dark:text-stone-400">Map © OpenStreetMap contributors. Needs internet.</p>
          </div>
        </Card>
      )}
      {parents.length > 0 && (
        <p className="mt-4">
          Part of:{' '}
          {parents.map((p, i) => (
            <span key={p.id}>
              {i > 0 && ', '}
              <Link to={placePath(p.id)} className="underline">
                {p.title}
              </Link>
            </span>
          ))}
        </p>
      )}
      <Events events={events} />
      <Mentions kind="place" id={pid} />
    </article>
  )
}

export function PeoplePage() {
  useTitle('People and places')
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const [input, setInput] = useState(q)
  const [hits, setHits] = useState<EntityHit[] | null>(null)
  const [top, setTop] = useState<{ people: Person[]; places: Place[] } | null>(null)

  useEffect(() => {
    Promise.all([getPeople(), getPlaces()]).then(([pe, pl]) =>
      setTop({
        people: [...pe].sort((a, b) => b.verseCount - a.verseCount).slice(0, 24),
        places: [...pl].filter((p) => !p.sameAs).sort((a, b) => b.verseCount - a.verseCount).slice(0, 24),
      }),
    )
  }, [])
  useEffect(() => {
    if (!q.trim()) {
      setHits(null)
      return
    }
    let cancelled = false
    searchEntities(q, { limit: 40, kinds: ['person', 'place'] }).then((h) => !cancelled && setHits(h))
    return () => {
      cancelled = true
    }
  }, [q])

  return (
    <div>
      <PageTitle sub="Everyone and everywhere the Bible names, with family trees, maps and every mention.">People and places</PageTitle>
      <form
        role="search"
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setParams({ q: input })
        }}
      >
        <label htmlFor="pq" className="sr-only">
          Find a person or place
        </label>
        <input
          id="pq"
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. Ruth, Paul, Capernaum"
          className="min-h-12 flex-1 rounded-xl border border-stone-300 bg-white px-4 text-base dark:border-stone-700 dark:bg-stone-900"
        />
        <button className={buttonClass('primary')}>Find</button>
      </form>

      {hits && (
        <ul className="mt-4 space-y-2" aria-live="polite">
          {!hits.length && <li>Nothing found.</li>}
          {hits.map((h) => (
            <li key={`${h.kind}:${h.id}`}>
              <Link
                to={h.kind === 'person' ? personPath(h.id) : placePath(String(h.id))}
                className="block rounded-2xl border border-stone-200 bg-white p-4 hover:bg-stone-50 dark:border-stone-800 dark:bg-stone-900 dark:hover:bg-stone-800"
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{h.title}</span>
                  <span className="text-xs text-stone-600 dark:text-stone-400">{h.kind === 'person' ? 'Person' : 'Place'}</span>
                </span>
                {h.kind === 'person' && h.person.description && (
                  <span className="mt-1 line-clamp-2 block text-[0.95rem] text-stone-700 dark:text-stone-300">{h.person.description}</span>
                )}
                {h.kind === 'place' && h.place.description && (
                  <span className="mt-1 line-clamp-2 block text-[0.95rem] text-stone-700 dark:text-stone-300">{h.place.description}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!q && top && (
        <>
          <h2 className="mb-2 mt-6 font-serif text-2xl font-semibold">Most mentioned people</h2>
          <ul className="flex flex-wrap gap-2">
            {top.people.map((p) => (
              <li key={p.id}>
                <Link to={personPath(p.id)} className="inline-flex min-h-10 items-center rounded-full border border-stone-300 px-4 dark:border-stone-700">
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
          <h2 className="mb-2 mt-6 font-serif text-2xl font-semibold">Most mentioned places</h2>
          <ul className="flex flex-wrap gap-2">
            {top.places.map((p) => (
              <li key={p.id}>
                <Link to={placePath(p.id)} className="inline-flex min-h-10 items-center rounded-full border border-stone-300 px-4 dark:border-stone-700">
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-6 text-xs text-stone-600 dark:text-stone-400">
        Data from Theographic Bible Metadata (CC BY-SA 4.0) and OpenBible.info (CC BY 4.0). {DATE_NOTE}
      </p>
    </div>
  )
}
