// A map of the places named in a chapter (or a whole book).
// Map tiles come from OpenStreetMap, so the map needs internet; the list of
// places below it works offline.

import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { getChapterEntities, getPlace, type Place } from '../lib/data/people.ts'
import { getBook } from '../lib/books.ts'
import { formatReference, readerPath } from '../lib/references.ts'
import { useOnline, useTitle } from '../lib/hooks.ts'
import { placePath } from './PeoplePage.tsx'
import { PageTitle } from '../components/ui.tsx'

interface Pin {
  place: Place
  verses: number[]
}

export function MapPage() {
  const [params] = useSearchParams()
  const bookId = params.get('book') ?? 'ACT'
  const chapter = Number(params.get('chapter') ?? '13')
  const book = getBook(bookId)
  const [pins, setPins] = useState<Pin[] | null>(null)
  const mapEl = useRef<HTMLDivElement>(null)
  const online = useOnline()
  const ref = book ? formatReference({ book: book.id, startChapter: chapter, endChapter: chapter }) : ''
  useTitle(`Map of ${ref}`)

  useEffect(() => {
    if (!book) return
    let cancelled = false
    setPins(null)
    getChapterEntities(book.id, chapter).then(async (e) => {
      // Alternate names (Salem) point at the main record (Jerusalem) for coordinates.
      const resolved = await Promise.all(
        e.places.map(async ({ place, verses }) => {
          const main = place.sameAs ? ((await getPlace(place.sameAs)) ?? place) : place
          return { place: { ...main, title: place.title }, verses }
        }),
      )
      if (!cancelled) setPins(resolved)
    })
    return () => {
      cancelled = true
    }
  }, [bookId, chapter]) // eslint-disable-line react-hooks/exhaustive-deps

  const located = (pins ?? []).filter((p) => p.place.lat !== undefined && p.place.lon !== undefined)

  useEffect(() => {
    if (!mapEl.current || !located.length || !online) return
    const map = L.map(mapEl.current, { scrollWheelZoom: false })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 15,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)
    const bounds = L.latLngBounds([])
    for (const { place, verses } of located) {
      const ll = L.latLng(place.lat!, place.lon!)
      bounds.extend(ll)
      L.circleMarker(ll, { radius: 8, color: '#b45309', weight: 2, fillColor: '#f59e0b', fillOpacity: 0.85 })
        .addTo(map)
        .bindPopup(`<strong>${place.title}</strong><br>${book?.name} ${chapter}:${verses.slice(0, 6).join(', ')}`)
    }
    map.fitBounds(bounds.pad(0.3), { maxZoom: 9 })
    return () => {
      map.remove()
    }
  }, [located.length, online]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!book) return <PageTitle>Book not found</PageTitle>
  return (
    <div>
      <PageTitle sub="Places named in this chapter. Tap a pin or a name for details.">Map: {ref}</PageTitle>
      {pins === null ? (
        <p className="text-stone-600 dark:text-stone-400">Loading…</p>
      ) : !located.length ? (
        <p>No mapped places in this chapter.</p>
      ) : online ? (
        <div ref={mapEl} className="relative z-0 isolate h-80 w-full overflow-hidden rounded-2xl border border-stone-200 dark:border-stone-800" role="region" aria-label={`Map of places in ${ref}`} />
      ) : (
        <p className="rounded-xl bg-stone-100 p-4 dark:bg-stone-900">The map needs an internet connection. The places are listed below.</p>
      )}
      {pins && pins.length > 0 && (
        <ul className="mt-4 space-y-2">
          {pins.map(({ place, verses }) => (
            <li key={place.id} className="rounded-xl border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-900">
              <Link to={placePath(place.id)} className="font-semibold text-amber-800 underline underline-offset-2 dark:text-amber-300">
                {place.title}
              </Link>
              <span className="text-sm text-stone-600 dark:text-stone-400">
                {' '}
                · verse{verses.length > 1 ? 's' : ''}{' '}
                {verses.map((v, i) => (
                  <span key={v}>
                    {i > 0 && ', '}
                    <Link to={readerPath({ book: book.id, startChapter: chapter, startVerse: v, endChapter: chapter, endVerse: v })} className="underline">
                      {v}
                    </Link>
                  </span>
                ))}
                {place.lat === undefined && ' · location unknown'}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-stone-600 dark:text-stone-400">
        Locations from OpenBible.info (CC BY 4.0) and Theographic Bible Metadata (CC BY-SA 4.0). Map © OpenStreetMap contributors.
        Some ancient sites are uncertain.
      </p>
    </div>
  )
}
