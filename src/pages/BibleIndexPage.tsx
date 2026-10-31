import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { bookIntros } from '../lib/content.ts'
import { BOOKS } from '../lib/books.ts'
import { parseReference, readerPath } from '../lib/references.ts'
import { useAppState } from '../lib/storage.ts'
import { useTitle } from '../lib/hooks.ts'
import { PageTitle, buttonClass } from '../components/ui.tsx'
import { TranslationPicker } from '../components/TranslationPicker.tsx'

export function BibleIndexPage() {
  useTitle('Bible')
  const navigate = useNavigate()
  const lastRead = useAppState((s) => s.lastRead)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')

  const sections: { testament: string; groups: { section: string; books: typeof BOOKS }[] }[] = ['OT', 'NT'].map((t) => {
    const groups: { section: string; books: typeof BOOKS }[] = []
    for (const b of BOOKS.filter((x) => x.testament === t)) {
      const section = bookIntros.find((i) => i.id === b.id)?.section ?? ''
      const last = groups[groups.length - 1]
      if (last && last.section === section) last.books.push(b)
      else groups.push({ section, books: [b] })
    }
    return { testament: t === 'OT' ? 'Old Testament' : 'New Testament', groups }
  })

  return (
    <div>
      <PageTitle sub="66 books. Tap a book for an introduction, then choose a chapter.">Bible</PageTitle>

      <form
        role="search"
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const p = parseReference(query)
          if (p) navigate(readerPath(p))
          else setError('Try something like "John 3" or "Psalm 23".')
        }}
      >
        <label htmlFor="goto" className="sr-only">
          Go to a passage
        </label>
        <input
          id="goto"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setError('')
          }}
          placeholder="Go to, e.g. John 3:16"
          className="min-h-12 flex-1 rounded-xl border border-stone-300 bg-white px-4 text-base dark:border-stone-700 dark:bg-stone-900"
          aria-describedby={error ? 'goto-error' : undefined}
        />
        <button className={buttonClass('primary')}>Go</button>
      </form>
      {error && (
        <p id="goto-error" role="alert" className="-mt-2 mb-4 text-rose-700 dark:text-rose-400">
          {error}
        </p>
      )}

      <div className="mb-4">
        <TranslationPicker />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-2">
        <Link to="/search" className={buttonClass('secondary')}>
          Search
        </Link>
        <Link to="/my-bible" className={buttonClass('secondary')}>
          My Bible
        </Link>
        <Link to="/plans" className={buttonClass('secondary')}>
          Reading plans
        </Link>
        <Link to="/compare" className={buttonClass('secondary')}>
          Compare
        </Link>
      </div>

      {lastRead && (
        <Link to={`/bible/${lastRead.book}/${lastRead.chapter}`} className={buttonClass('secondary', 'mb-6 w-full')}>
          Continue: {BOOKS.find((b) => b.id === lastRead.book)?.name} {lastRead.chapter}
        </Link>
      )}

      {sections.map((s) => (
        <section key={s.testament} className="mb-8" aria-labelledby={`h-${s.testament}`}>
          <h2 id={`h-${s.testament}`} className="mb-3 font-serif text-2xl font-semibold">
            {s.testament}
          </h2>
          {s.groups.map((g) => (
            <div key={g.section + g.books[0].id} className="mb-4">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-600 dark:text-stone-400">{g.section}</h3>
              <ul className="grid grid-cols-2 gap-2">
                {g.books.map((b) => (
                  <li key={b.id}>
                    <Link
                      to={`/bible/${b.id}`}
                      className="flex min-h-12 items-center rounded-xl border border-stone-200 bg-white px-3 py-2 hover:bg-stone-50 dark:border-stone-800 dark:bg-stone-900 dark:hover:bg-stone-800"
                    >
                      {b.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
