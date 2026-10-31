// Bible dictionaries (Easton's, Smith's, Hitchcock's Bible Names): search and read entries.

import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  DICTIONARY_SOURCES,
  SOURCE_ORDER,
  entryParagraphs,
  getEntry,
  searchDictionary,
  type DictionaryEntry,
  type DictionaryIndexEntry,
  type DictionarySource,
} from '../lib/data/dictionary.ts'
import { formatReference, readerPath } from '../lib/references.ts'
import { useTitle } from '../lib/hooks.ts'
import { Card, PageTitle, buttonClass } from '../components/ui.tsx'

export const entryPath = (id: string) => `/dictionary/${encodeURIComponent(id)}`

export function EntryList({ entries, onPick }: { entries: DictionaryIndexEntry[]; onPick?: () => void }) {
  return (
    <ul className="space-y-2">
      {entries.map((e) => (
        <li key={e.id}>
          <Link
            to={entryPath(e.id)}
            onClick={onPick}
            className="block rounded-2xl border border-stone-200 bg-white p-4 hover:bg-stone-50 dark:border-stone-800 dark:bg-stone-900 dark:hover:bg-stone-800"
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className="font-semibold">{e.term}</span>
              <span className="shrink-0 rounded-full bg-stone-100 px-2 text-xs dark:bg-stone-800">{DICTIONARY_SOURCES[e.source].short}</span>
            </span>
            <span className="mt-1 line-clamp-2 block text-[0.95rem] text-stone-700 dark:text-stone-300">{e.preview}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function DictionaryPage() {
  useTitle('Bible dictionary')
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const src = (params.get('in') as DictionarySource | null) ?? null
  const [input, setInput] = useState(q)
  useEffect(() => setInput(q), [q])
  const [results, setResults] = useState<DictionaryIndexEntry[] | null>(null)

  useEffect(() => {
    if (!q.trim()) {
      setResults(null)
      return
    }
    let cancelled = false
    searchDictionary(q, 40, src ? { sources: [src] } : {}).then((r) => !cancelled && setResults(r))
    return () => {
      cancelled = true
    }
  }, [q, src])

  return (
    <div>
      <PageTitle sub="Classic public-domain Bible dictionaries: people, places, customs, words and names.">Bible dictionary</PageTitle>
      <form
        role="search"
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setParams(src ? { q: input, in: src } : { q: input })
        }}
      >
        <label htmlFor="dq" className="sr-only">
          Look up
        </label>
        <input
          id="dq"
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. Passover, Samaria, ephod"
          className="min-h-12 flex-1 rounded-xl border border-stone-300 bg-white px-4 text-base dark:border-stone-700 dark:bg-stone-900"
        />
        <button className={buttonClass('primary')}>Look up</button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Which dictionary">
        {[null, ...SOURCE_ORDER].map((s) => (
          <button
            key={s ?? 'all'}
            type="button"
            aria-pressed={src === s}
            onClick={() => {
              const next: Record<string, string> = q ? { q } : {}
              if (s) next.in = s
              setParams(next)
            }}
            className={`min-h-10 rounded-full border px-4 text-sm font-semibold ${
              src === s ? 'border-amber-700 bg-amber-50 dark:border-amber-300 dark:bg-amber-950/40' : 'border-stone-300 dark:border-stone-700'
            }`}
          >
            {s ? DICTIONARY_SOURCES[s].short : 'All'}
          </button>
        ))}
      </div>

      <div className="mt-4" aria-live="polite">
        {results && <p className="mb-3 font-semibold">{results.length ? `${results.length} entries` : 'Nothing found.'}</p>}
      </div>
      {results && <EntryList entries={results} />}

      {!q && (
        <div className="mt-2 space-y-3">
          {SOURCE_ORDER.map((s) => (
            <Card key={s}>
              <h2 className="font-semibold">
                {DICTIONARY_SOURCES[s].title} <span className="font-normal text-stone-600 dark:text-stone-400">({DICTIONARY_SOURCES[s].year})</span>
              </h2>
              <p className="mt-1 text-stone-700 dark:text-stone-300">{DICTIONARY_SOURCES[s].description}</p>
            </Card>
          ))}
          <p className="text-sm text-stone-600 dark:text-stone-400">
            These dictionaries are over a century old: wonderful for background, but some details have been updated by later scholarship.
          </p>
        </div>
      )}
    </div>
  )
}

export function DictionaryEntryPage() {
  const { id = '' } = useParams()
  const [entry, setEntry] = useState<DictionaryEntry | null | undefined>(undefined)
  useTitle(entry?.term ?? 'Dictionary')
  useEffect(() => {
    let cancelled = false
    setEntry(undefined)
    getEntry(decodeURIComponent(id)).then((e) => !cancelled && setEntry(e))
    return () => {
      cancelled = true
    }
  }, [id])

  if (entry === undefined) return <p className="text-stone-600 dark:text-stone-400">Loading…</p>
  if (!entry)
    return (
      <div>
        <PageTitle sub="This entry isn't available, or the dictionary isn't saved on this device yet.">Entry not found</PageTitle>
        <Link to="/dictionary" className={buttonClass('secondary')}>
          Search the dictionary
        </Link>
      </div>
    )
  const info = DICTIONARY_SOURCES[entry.source]
  return (
    <article>
      <p className="text-sm font-semibold uppercase tracking-wide text-stone-600 dark:text-stone-400">{info.title}</p>
      <h1 className="mt-1 font-serif text-4xl font-semibold">{entry.term}</h1>
      <div className="mt-5 space-y-4 text-[1.05rem] leading-relaxed">
        {entryParagraphs(entry).map((para, i) => (
          <p key={i}>
            {para.map((seg, j) =>
              seg.kind === 'text' ? (
                <span key={j}>{seg.text}</span>
              ) : seg.kind === 'ref' ? (
                <Link key={j} to={readerPath(seg.ref)} className="text-amber-800 underline underline-offset-2 dark:text-amber-300" title={formatReference(seg.ref)}>
                  {seg.text}
                </Link>
              ) : (
                <Link key={j} to={entryPath(seg.id)} className="font-semibold underline underline-offset-2">
                  {seg.text}
                </Link>
              ),
            )}
          </p>
        ))}
      </div>
      <p className="mt-8 text-xs text-stone-600 dark:text-stone-400">{info.credit}</p>
    </article>
  )
}
