// Topical Bible (Nave's Topical Bible, 1896, public domain): verses grouped by subject.

import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getTopic, getTopicSummary, loadTopicIndex, searchTopics, type Topic, type TopicSummary } from '../lib/data/topics.ts'
import { formatReference, readerPath } from '../lib/references.ts'
import { useTitle } from '../lib/hooks.ts'
import { Card, PageTitle, buttonClass } from '../components/ui.tsx'

export const topicPath = (id: string) => `/topics/${encodeURIComponent(id)}`

const POPULAR = ['faith', 'prayer', 'love', 'forgiveness', 'holy-spirit', 'grace-of-god', 'hope', 'peace', 'joy', 'worship', 'repentance', 'humility']

export function TopicList({ topics, onPick }: { topics: TopicSummary[]; onPick?: () => void }) {
  return (
    <ul className="space-y-2">
      {topics.map((t) => (
        <li key={t.id}>
          <Link
            to={topicPath(t.id)}
            onClick={onPick}
            className="flex items-baseline justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4 hover:bg-stone-50 dark:border-stone-800 dark:bg-stone-900 dark:hover:bg-stone-800"
          >
            <span className="font-semibold">{t.name}</span>
            <span className="shrink-0 text-sm text-stone-600 dark:text-stone-400">{t.count ? `${t.count} refs` : 'see also'}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function TopicsPage() {
  useTitle('Topical Bible')
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const [input, setInput] = useState(q)
  useEffect(() => setInput(q), [q])
  const [results, setResults] = useState<TopicSummary[] | null>(null)
  const [popular, setPopular] = useState<TopicSummary[]>([])

  useEffect(() => {
    Promise.all(POPULAR.map((id) => getTopicSummary(id))).then((r) => setPopular(r.filter((x): x is TopicSummary => !!x)))
    loadTopicIndex()
  }, [])
  useEffect(() => {
    if (!q.trim()) {
      setResults(null)
      return
    }
    let cancelled = false
    searchTopics(q, 40).then((r) => !cancelled && setResults(r))
    return () => {
      cancelled = true
    }
  }, [q])

  return (
    <div>
      <PageTitle sub="What does the Bible say about…? Verses grouped by subject, from Nave's Topical Bible.">Topical Bible</PageTitle>
      <form
        role="search"
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setParams({ q: input })
        }}
      >
        <label htmlFor="tq" className="sr-only">
          Topic
        </label>
        <input
          id="tq"
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. patience, fear, money"
          className="min-h-12 flex-1 rounded-xl border border-stone-300 bg-white px-4 text-base dark:border-stone-700 dark:bg-stone-900"
        />
        <button className={buttonClass('primary')}>Find</button>
      </form>
      <div className="mt-4" aria-live="polite">
        {results && <p className="mb-3 font-semibold">{results.length ? `${results.length} topics` : 'No topics found.'}</p>}
      </div>
      {results && <TopicList topics={results} />}
      {!q && popular.length > 0 && (
        <>
          <h2 className="mb-3 mt-2 font-serif text-2xl font-semibold">Popular topics</h2>
          <TopicList topics={popular} />
        </>
      )}
      <p className="mt-6 text-xs text-stone-600 dark:text-stone-400">
        Nave's Topical Bible by Orville J. Nave (1896), public domain. A topical index is a starting point: always read each verse in its
        context.
      </p>
    </div>
  )
}

export function TopicPage() {
  const { id = '' } = useParams()
  const [topic, setTopic] = useState<Topic | null | undefined>(undefined)
  const [names, setNames] = useState<Record<string, string>>({})
  useTitle(topic?.name ?? 'Topic')
  useEffect(() => {
    let cancelled = false
    setTopic(undefined)
    getTopic(decodeURIComponent(id)).then(async (t) => {
      if (cancelled) return
      setTopic(t)
      const see = t?.seeAlso ?? []
      const sums = await Promise.all(see.map((s) => getTopicSummary(s)))
      if (!cancelled) setNames(Object.fromEntries(sums.filter((x): x is TopicSummary => !!x).map((x) => [x.id, x.name])))
    })
    return () => {
      cancelled = true
    }
  }, [id])

  if (topic === undefined) return <p className="text-stone-600 dark:text-stone-400">Loading…</p>
  if (!topic)
    return (
      <div>
        <PageTitle sub="This topic isn't available, or the topical Bible isn't saved on this device yet.">Topic not found</PageTitle>
        <Link to="/topics" className={buttonClass('secondary')}>
          Search topics
        </Link>
      </div>
    )
  return (
    <article>
      <p className="text-sm font-semibold uppercase tracking-wide text-stone-600 dark:text-stone-400">Topical Bible</p>
      <h1 className="mt-1 font-serif text-4xl font-semibold">{topic.name}</h1>
      <div className="mt-5 space-y-3">
        {topic.subtopics.map((s, i) => (
          <div key={i} className={s.level ? 'ml-4 border-l-2 border-stone-200 pl-3 dark:border-stone-700' : ''}>
            <p className={s.refs.length || s.seeAlso?.length ? 'font-semibold' : 'font-semibold text-stone-600 dark:text-stone-400'}>{s.label}</p>
            {s.refs.length > 0 && (
              <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                {s.refs.map((r, j) => (
                  <Link key={j} to={readerPath(r)} className="text-amber-800 underline underline-offset-2 dark:text-amber-300">
                    {formatReference(r)}
                  </Link>
                ))}
              </p>
            )}
            {s.seeAlso && s.seeAlso.length > 0 && (
              <p className="mt-1 text-sm">
                See{' '}
                {s.seeAlso.map((x, j) => (
                  <span key={x}>
                    {j > 0 && ', '}
                    <Link to={topicPath(x)} className="underline">
                      {names[x] ?? x}
                    </Link>
                  </span>
                ))}
              </p>
            )}
          </div>
        ))}
      </div>
      {topic.seeAlso && topic.seeAlso.length > 0 && (
        <Card className="mt-6">
          <h2 className="font-semibold">Related topics</h2>
          <p className="mt-1 flex flex-wrap gap-x-3">
            {topic.seeAlso.map((x) => (
              <Link key={x} to={topicPath(x)} className="underline">
                {names[x] ?? x}
              </Link>
            ))}
          </p>
        </Card>
      )}
      <p className="mt-6 text-xs text-stone-600 dark:text-stone-400">Nave's Topical Bible (1896), public domain, via CrossWire.</p>
    </article>
  )
}
