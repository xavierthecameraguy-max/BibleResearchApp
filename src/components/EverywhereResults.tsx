// "Elsewhere in the app": matching lessons, topics, dictionary articles,
// people, places and Hebrew/Greek words for a search.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getTrack, lessons } from '../lib/content.ts'
import { searchTopics, type TopicSummary } from '../lib/data/topics.ts'
import { searchDictionary, DICTIONARY_SOURCES, type DictionaryIndexEntry } from '../lib/data/dictionary.ts'
import { searchEntities, type EntityHit } from '../lib/data/people.ts'
import { lexiconLoaded, searchLexicon } from '../lib/wordSearch.ts'
import type { LexiconEntry } from '../lib/data/original.ts'
import { topicPath } from '../pages/TopicsPage.tsx'
import { entryPath } from '../pages/DictionaryPage.tsx'
import { personPath, placePath } from '../pages/PeoplePage.tsx'

interface Results {
  lessons: typeof lessons
  topics: TopicSummary[]
  dict: DictionaryIndexEntry[]
  people: EntityHit[]
  words: LexiconEntry[]
}

function Group({ title, more, children }: { title: string; more?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
      <h3 className="flex items-baseline justify-between font-semibold">
        {title}
        {more && (
          <Link to={more} className="inline-flex min-h-11 items-center text-sm font-normal underline">
            See all
          </Link>
        )}
      </h3>
      <ul className="mt-2 space-y-1.5">{children}</ul>
    </section>
  )
}

export function EverywhereResults({ q }: { q: string }) {
  const [r, setR] = useState<Results | null>(null)
  useEffect(() => {
    const query = q.replace(/"/g, '').trim()
    if (query.length < 2) {
      setR(null)
      return
    }
    let cancelled = false
    const lq = query.toLowerCase()
    const lessonHits = lessons.filter((l) => l.title.toLowerCase().includes(lq) || l.summary.toLowerCase().includes(lq)).slice(0, 4)
    Promise.all([
      searchTopics(query, 4).catch(() => []),
      searchDictionary(query, 4).catch(() => []),
      searchEntities(query, { limit: 4, kinds: ['person', 'place'] }).catch(() => []),
      // The Hebrew/Greek lexicon is large, so it's only searched once it's already been loaded.
      lexiconLoaded() ? searchLexicon(query, 4).catch(() => []) : Promise.resolve([] as LexiconEntry[]),
    ]).then(([topics, dict, people, words]) => {
      if (!cancelled) setR({ lessons: lessonHits, topics, dict, people, words })
    })
    return () => {
      cancelled = true
    }
  }, [q])

  if (!r) return null
  const any = r.lessons.length + r.topics.length + r.dict.length + r.people.length + r.words.length
  if (!any) return null
  const enc = encodeURIComponent(q.replace(/"/g, ''))
  const a = 'text-amber-800 underline underline-offset-2 dark:text-amber-300'
  return (
    <div className="mt-6 space-y-3">
      <h2 className="font-serif text-2xl font-semibold">Elsewhere in the app</h2>
      {r.lessons.length > 0 && (
        <Group title="Lessons">
          {r.lessons.map((l) => (
            <li key={l.id}>
              <Link to={`/lesson/${l.id}`} className={a}>
                {l.title}
              </Link>{' '}
              <span className="text-sm text-stone-600 dark:text-stone-400">· {getTrack(l.track)?.title}</span>
            </li>
          ))}
        </Group>
      )}
      {r.topics.length > 0 && (
        <Group title="Topics" more={`/topics?q=${enc}`}>
          {r.topics.map((t) => (
            <li key={t.id}>
              <Link to={topicPath(t.id)} className={a}>
                {t.name}
              </Link>
            </li>
          ))}
        </Group>
      )}
      {r.dict.length > 0 && (
        <Group title="Dictionary" more={`/dictionary?q=${enc}`}>
          {r.dict.map((d) => (
            <li key={d.id}>
              <Link to={entryPath(d.id)} className={a}>
                {d.term}
              </Link>{' '}
              <span className="text-sm text-stone-600 dark:text-stone-400">· {DICTIONARY_SOURCES[d.source].short}</span>
            </li>
          ))}
        </Group>
      )}
      {r.people.length > 0 && (
        <Group title="People and places" more={`/people?q=${enc}`}>
          {r.people.map((h) => (
            <li key={`${h.kind}:${h.id}`}>
              <Link to={h.kind === 'person' ? personPath(h.id) : placePath(String(h.id))} className={a}>
                {h.title}
              </Link>{' '}
              <span className="text-sm text-stone-600 dark:text-stone-400">· {h.kind === 'person' ? 'person' : 'place'}</span>
            </li>
          ))}
        </Group>
      )}
      {r.words.length === 0 && (
        <p className="text-sm">
          <Link to={`/words?q=${enc}`} className="underline">
            Look up “{q.replace(/"/g, '')}” in the Hebrew and Greek words
          </Link>
        </p>
      )}
      {r.words.length > 0 && (
        <Group title="Hebrew and Greek words" more={`/words?q=${enc}`}>
          {r.words.map((w) => (
            <li key={w.strong}>
              <Link to={`/word/${w.strong}`} className={a}>
                {w.translit}
              </Link>{' '}
              <span className="text-sm text-stone-600 dark:text-stone-400">
                · “{w.gloss}” · {w.strong}
              </span>
            </li>
          ))}
        </Group>
      )}
    </div>
  )
}
