import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { glossary } from '../lib/content.ts'
import { useTitle } from '../lib/hooks.ts'
import { PageTitle } from '../components/ui.tsx'

export function GlossaryPage() {
  useTitle('Glossary')
  const { hash } = useLocation()
  const [q, setQ] = useState('')
  const target = hash.slice(1)

  useEffect(() => {
    if (target) document.getElementById(target)?.scrollIntoView({ block: 'start' })
  }, [target])

  const shown = glossary.filter(
    (g) => !q || g.term.toLowerCase().includes(q.toLowerCase()) || g.definition.toLowerCase().includes(q.toLowerCase()),
  )

  return (
    <div>
      <PageTitle sub="Words you'll meet in the lessons, explained simply.">Glossary</PageTitle>
      <label htmlFor="gsearch" className="sr-only">
        Search the glossary
      </label>
      <input
        id="gsearch"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search terms"
        className="mb-6 min-h-12 w-full rounded-xl border border-stone-300 bg-white px-4 text-base dark:border-stone-700 dark:bg-stone-900"
      />
      <p className="sr-only" aria-live="polite">
        {shown.length} terms
      </p>
      <dl className="space-y-3">
        {shown.map((g) => (
          <div
            key={g.id}
            id={g.id}
            className={`scroll-mt-20 rounded-2xl border bg-white p-4 dark:bg-stone-900 ${
              g.id === target ? 'border-amber-500 ring-2 ring-amber-500/40' : 'border-stone-200 dark:border-stone-800'
            }`}
          >
            <dt className="font-serif text-xl font-semibold">{g.term}</dt>
            <dd className="mt-1 leading-relaxed">{g.definition}</dd>
          </div>
        ))}
      </dl>
      {!shown.length && <p>No terms match "{q}".</p>}
    </div>
  )
}
