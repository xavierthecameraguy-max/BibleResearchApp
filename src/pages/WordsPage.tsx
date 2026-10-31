// Find Hebrew and Greek words by English meaning, transliteration or Strong's number.

import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { LexiconEntry } from '../lib/data/original.ts'
import { searchLexicon } from '../lib/wordSearch.ts'
import { useTitle } from '../lib/hooks.ts'
import { Card, PageTitle, buttonClass } from '../components/ui.tsx'

const STARTERS = ['love', 'grace', 'faith', 'peace', 'covenant', 'holy', 'word', 'spirit', 'shepherd', 'chesed', 'agape', 'G3056']

export function WordsPage() {
  useTitle('Word study')
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const [input, setInput] = useState(q)
  useEffect(() => setInput(q), [q])
  const [results, setResults] = useState<LexiconEntry[] | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!q.trim()) {
      setResults(null)
      return
    }
    let cancelled = false
    setBusy(true)
    searchLexicon(q).then((r) => {
      if (cancelled) return
      setResults(r)
      setBusy(false)
    })
    return () => {
      cancelled = true
    }
  }, [q])

  return (
    <div>
      <PageTitle sub="Look up the Hebrew and Greek words behind your English Bible. Or tap “Original” on any verse in the reader.">
        Word study
      </PageTitle>
      <form
        role="search"
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setParams({ q: input })
        }}
      >
        <label htmlFor="wq" className="sr-only">
          Word to look up
        </label>
        <input
          id="wq"
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. love, grace, agape, H2617"
          className="min-h-12 flex-1 rounded-xl border border-stone-300 bg-white px-4 text-base dark:border-stone-700 dark:bg-stone-900"
        />
        <button className={buttonClass('primary')}>Find</button>
      </form>

      {!q && (
        <div className="mt-4 flex flex-wrap gap-2">
          {STARTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setInput(s)
                setParams({ q: s })
              }}
              className="min-h-10 rounded-full border border-stone-300 px-4 text-[0.95rem] dark:border-stone-700"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div aria-live="polite" className="mt-4">
        {busy && <p className="text-stone-600 dark:text-stone-400">Searching the lexicons… (the first search takes a moment)</p>}
        {!busy && results && <p className="font-semibold">{results.length ? `${results.length} words found` : 'No words found.'}</p>}
      </div>
      <ul className="mt-3 space-y-2">
        {results?.map((e) => {
          const hebrew = e.strong.startsWith('H')
          return (
            <li key={e.strong}>
              <Link
                to={`/word/${e.strong}`}
                className="flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4 hover:bg-stone-50 dark:border-stone-800 dark:bg-stone-900 dark:hover:bg-stone-800"
              >
                <span lang={hebrew ? 'hbo' : 'grc'} dir={hebrew ? 'rtl' : 'ltr'} className="min-w-20 font-serif text-2xl">
                  {e.lemma}
                </span>
                <span>
                  <span className="block font-semibold">{e.gloss}</span>
                  <span className="block text-sm text-stone-600 dark:text-stone-400">
                    <i>{e.translit}</i> · {hebrew ? 'Hebrew' : 'Greek'} · {e.strong}
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
      {!q && (
        <Card className="mt-6">
          <h2 className="font-semibold">Why study the original words?</h2>
          <p className="mt-1 leading-relaxed text-stone-700 dark:text-stone-300">
            English translations have to choose one word where Hebrew or Greek may carry more. Seeing the original word, and every place
            it appears, helps you understand what the writers meant. Use it humbly, alongside a good translation and the passage's
            context.
          </p>
        </Card>
      )}
    </div>
  )
}
