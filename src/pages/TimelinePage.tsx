import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getLesson, timeline } from '../lib/content.ts'
import { useAppState } from '../lib/storage.ts'
import { useTitle } from '../lib/hooks.ts'
import { PageTitle } from '../components/ui.tsx'
import { CheckIcon } from '../components/Icons.tsx'

type Filter = 'all' | 'biblical' | 'church'

const ERAS: { from: number; title: string }[] = [
  { from: -Infinity, title: 'Patriarchs and Exodus' },
  { from: -1100, title: 'Kings and Prophets' },
  { from: -600, title: 'Exile, Return and Waiting' },
  { from: -10, title: 'Jesus and the Apostles' },
  { from: 100, title: 'The Early Church' },
  { from: 500, title: 'The Middle Ages' },
  { from: 1300, title: 'Reformation Era' },
  { from: 1650, title: 'Revival and Mission' },
  { from: 1900, title: 'The Modern Church' },
]

const eraOf = (year: number) => [...ERAS].reverse().find((e) => year >= e.from)!.title

export function TimelinePage() {
  useTitle('Timeline')
  const [filter, setFilter] = useState<Filter>('all')
  const progress = useAppState((s) => s.progress)
  const events = timeline.filter((e) => filter === 'all' || e.kind === filter)

  let lastEra = ''
  return (
    <div>
      <PageTitle sub="From Abraham to today. Dates before about 1000 BC are approximate, and some are debated. Tap an event to open its lesson.">
        Timeline
      </PageTitle>

      <div role="radiogroup" aria-label="Show events" className="mb-6 flex gap-2">
        {(
          [
            ['all', 'All'],
            ['biblical', 'Bible'],
            ['church', 'Church'],
          ] as [Filter, string][]
        ).map(([f, label]) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={filter === f}
            onClick={() => setFilter(f)}
            className={`min-h-11 flex-1 rounded-full border px-4 font-semibold ${
              filter === f
                ? 'border-amber-700 bg-amber-700 text-white dark:border-amber-300 dark:bg-amber-300 dark:text-stone-950'
                : 'border-stone-300 dark:border-stone-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <ol className="relative ml-3 border-l-2 border-stone-200 dark:border-stone-800">
        {events.map((e) => {
          const era = eraOf(e.year)
          const showEra = era !== lastEra
          lastEra = era
          const lesson = e.lessonId ? getLesson(e.lessonId) : undefined
          const biblical = e.kind === 'biblical'
          const inner = (
            <>
              <span className="text-sm font-semibold text-stone-600 dark:text-stone-400">{e.when}</span>
              <span className="mt-0.5 block text-lg font-semibold leading-snug">{e.title}</span>
              <span className="mt-1 block leading-relaxed text-stone-700 dark:text-stone-300">{e.description}</span>
              {lesson && (
                <span className="mt-2 flex items-center gap-1 text-sm font-semibold text-amber-800 dark:text-amber-300">
                  {progress[lesson.id] && <CheckIcon width="1em" height="1em" />}
                  Lesson: {lesson.title}
                </span>
              )}
            </>
          )
          return (
            <li key={e.id} className="mb-5 ml-6">
              {showEra && (
                <h2 className="-ml-6 mb-3 mt-8 bg-stone-50 py-1 pl-6 font-serif text-xl font-semibold first:mt-0 dark:bg-stone-950">{era}</h2>
              )}
              <span
                aria-hidden="true"
                className={`absolute -left-[9px] mt-5 size-4 rounded-full border-2 border-stone-50 dark:border-stone-950 ${
                  biblical ? 'bg-amber-600 dark:bg-amber-400' : 'bg-emerald-600 dark:bg-emerald-400'
                }`}
              />
              <span className="sr-only">{biblical ? 'Bible history: ' : 'Church history: '}</span>
              {lesson ? (
                <Link
                  to={`/lesson/${lesson.id}`}
                  className="block rounded-2xl border border-stone-200 bg-white p-4 hover:bg-stone-50 dark:border-stone-800 dark:bg-stone-900 dark:hover:bg-stone-800"
                >
                  {inner}
                </Link>
              ) : (
                <div className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">{inner}</div>
              )}
            </li>
          )
        })}
      </ol>
      <p className="mt-4 flex flex-wrap gap-4 text-sm text-stone-600 dark:text-stone-400">
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-full bg-amber-600 dark:bg-amber-400" aria-hidden="true" /> Bible history
        </span>
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-full bg-emerald-600 dark:bg-emerald-400" aria-hidden="true" /> Church history
        </span>
      </p>
    </div>
  )
}
