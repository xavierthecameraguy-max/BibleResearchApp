// Search the whole Bible for words or phrases. Works offline using the
// built-in or imported translations.

import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { BUNDLED, loadBook, type Translation } from '../lib/bible.ts'
import { BOOKS } from '../lib/books.ts'
import { useCurrentTranslation, useTitle, useTranslations } from '../lib/hooks.ts'
import { formatReference, parseReference, readerPath } from '../lib/references.ts'
import { PageTitle, buttonClass } from '../components/ui.tsx'
import { EverywhereResults } from '../components/EverywhereResults.tsx'

interface Hit {
  book: string
  chapter: number
  verse: number
  text: string
}

const MAX_HITS = 500

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** A pattern where straight and curly apostrophes match each other (Lord's = Lord’s). */
function flexible(s: string) {
  return escapeRegExp(s).replace(/['‘’]/g, "['‘’]")
}

export function SearchPage() {
  useTitle('Search')
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const q = params.get('q') ?? ''
  const scope = params.get('in') ?? 'all'
  const [input, setInput] = useState(q)
  useEffect(() => setInput(q), [q])
  const [hits, setHits] = useState<Hit[]>([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const all = useTranslations()
  const current = useCurrentTranslation()
  // Online translations can't be searched as a whole (their terms limit how
  // much text the app may fetch), so search an offline one instead.
  const offline = all.filter((t) => t.kind !== 'online')
  const searchIn: Translation = current.kind !== 'online' ? current : (offline.find((t) => t.id === 'bsb') ?? BUNDLED[0])
  const run = useRef(0)

  useEffect(() => {
    const words = q.trim()
    if (words.length < 2) {
      setHits([])
      return
    }
    const id = ++run.current
    setBusy(true)
    setHits([])
    // Match whole words, all words in any order; quotes match an exact phrase.
    const phrase = words.match(/^["“”](.+)["“”]$/)?.[1]
    const tests = phrase
      ? [new RegExp(`\\b${flexible(phrase)}\\b`, 'i')]
      : words.split(/\s+/).map((w) => new RegExp(`\\b${flexible(w.replace(/["“”]/g, ''))}`, 'i'))
    const books = BOOKS.filter((b) => scope === 'all' || b.testament === scope)
    ;(async () => {
      const found: Hit[] = []
      for (let i = 0; i < books.length; i++) {
        if (run.current !== id) return
        const text = await loadBook(searchIn.id, books[i].id)
        text?.chapters.forEach((ch, ci) =>
          ch?.forEach((v) => {
            if (found.length < MAX_HITS && tests.every((t) => t.test(v.t))) {
              found.push({ book: books[i].id, chapter: ci + 1, verse: v.v, text: v.t.replace(/\n/g, ' ') })
            }
          }),
        )
        setProgress(Math.round(((i + 1) / books.length) * 100))
        if (i % 6 === 5) setHits([...found])
      }
      if (run.current === id) {
        setHits(found)
        setBusy(false)
      }
    })()
  }, [q, scope, searchIn.id])

  const words = q.replace(/["“”]/g, '').trim().split(/\s+/).filter(Boolean)
  const mark = (text: string) => {
    if (!words.length) return text
    const re = new RegExp(`(${words.map(flexible).join('|')})`, 'gi')
    return text.split(re).map((part, i) =>
      i % 2 ? (
        <mark key={i} className="rounded bg-amber-200 px-0.5 text-inherit dark:bg-amber-500/40">
          {part}
        </mark>
      ) : (
        part
      ),
    )
  }

  return (
    <div>
      <PageTitle sub="Find any word or phrase. Put a phrase in quotes for an exact match, or type a reference like John 3:16.">
        Search
      </PageTitle>
      <form
        role="search"
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const ref = /\d/.test(input) ? parseReference(input) : null
          if (ref) {
            navigate(readerPath(ref))
            return
          }
          setParams({ q: input, in: scope })
        }}
      >
        <label htmlFor="q" className="sr-only">
          Search
        </label>
        <input
          id="q"
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='e.g. "good shepherd" or mercy'
          className="min-h-12 flex-1 rounded-xl border border-stone-300 bg-white px-4 text-base dark:border-stone-700 dark:bg-stone-900"
        />
        <button className={buttonClass('primary')}>Search</button>
      </form>
      <div className="mt-3 flex gap-2" role="group" aria-label="Where to search">
        {(
          [
            ['all', 'Whole Bible'],
            ['OT', 'Old Testament'],
            ['NT', 'New Testament'],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            aria-pressed={scope === v}
            onClick={() => setParams({ q, in: v })}
            className={`min-h-10 flex-1 rounded-full border px-2 text-sm font-semibold ${
              scope === v ? 'border-amber-700 bg-amber-50 dark:border-amber-300 dark:bg-amber-950/40' : 'border-stone-300 dark:border-stone-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-stone-600 dark:text-stone-400">
        Searching the {searchIn.abbr}
        {current.kind === 'online' && ` (${current.abbr} can't be searched offline)`}.
      </p>

      {q.trim().length >= 2 && <EverywhereResults q={q} />}
      {q.trim().length >= 2 && <h2 className="mt-6 font-serif text-2xl font-semibold">In the Bible text</h2>}

      <div aria-live="polite" className="mt-4">
        {busy && <p className="text-stone-600 dark:text-stone-400">Searching… {progress}%</p>}
        {!busy && q.trim().length >= 2 && (
          <p className="font-semibold">
            {hits.length >= MAX_HITS ? `First ${MAX_HITS} verses` : `${hits.length} verse${hits.length === 1 ? '' : 's'}`} found
          </p>
        )}
      </div>
      <ul className="mt-3 space-y-2">
        {hits.map((h) => {
          const p = { book: h.book, startChapter: h.chapter, endChapter: h.chapter, startVerse: h.verse, endVerse: h.verse }
          return (
            <li key={`${h.book}.${h.chapter}.${h.verse}`}>
              <Link
                to={readerPath(p)}
                className="block rounded-2xl border border-stone-200 bg-white p-4 hover:bg-stone-50 dark:border-stone-800 dark:bg-stone-900 dark:hover:bg-stone-800"
              >
                <span className="block font-semibold">{formatReference(p)}</span>
                <span className="mt-1 block font-serif leading-relaxed">{mark(h.text)}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
