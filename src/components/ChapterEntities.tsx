// "People and places in this chapter", shown under the Bible text.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getChapterEntities, type ChapterEntities as Entities } from '../lib/data/people.ts'
import { personPath, placePath } from '../pages/PeoplePage.tsx'

export function ChapterEntities({ book, chapter }: { book: string; chapter: number }) {
  const [data, setData] = useState<Entities | null>(null)
  useEffect(() => {
    let cancelled = false
    setData(null)
    getChapterEntities(book, chapter).then((d) => !cancelled && setData(d))
    return () => {
      cancelled = true
    }
  }, [book, chapter])
  if (!data || (!data.people.length && !data.places.length)) return null
  const chip = 'inline-flex min-h-10 items-center rounded-full border border-stone-300 px-3 text-[0.95rem] dark:border-stone-700'
  return (
    <details className="mt-6 rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
      <summary className="cursor-pointer font-semibold">
        People and places in this chapter ({data.people.length + data.places.length})
      </summary>
      {data.people.length > 0 && (
        <>
          <h3 className="mb-2 mt-3 text-sm font-semibold uppercase tracking-wide text-stone-600 dark:text-stone-400">People</h3>
          <ul className="flex flex-wrap gap-2">
            {data.people.map(({ person, verses }) => (
              <li key={person.id}>
                <Link to={personPath(person.id)} className={chip}>
                  {person.title} <span className="ml-1 text-xs text-stone-600 dark:text-stone-400">v{verses.slice(0, 3).join(',')}{verses.length > 3 ? '…' : ''}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      {data.places.length > 0 && (
        <>
          <h3 className="mb-2 mt-3 text-sm font-semibold uppercase tracking-wide text-stone-600 dark:text-stone-400">Places</h3>
          <ul className="flex flex-wrap gap-2">
            {data.places.map(({ place, verses }) => (
              <li key={place.id}>
                <Link to={placePath(place.id)} className={chip}>
                  {place.title} <span className="ml-1 text-xs text-stone-600 dark:text-stone-400">v{verses.slice(0, 3).join(',')}{verses.length > 3 ? '…' : ''}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </details>
  )
}
