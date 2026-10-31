// Study one Hebrew or Greek word: meaning, definition and every verse it's in.

import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getLexicon, getOccurrences, type LexiconEntry, type Occurrences } from '../lib/data/original.ts'
import { BUNDLED, loadBook } from '../lib/bible.ts'
import { useCurrentTranslation, useTitle } from '../lib/hooks.ts'
import { formatReference, readerPath } from '../lib/references.ts'
import { Card, PageTitle, buttonClass } from '../components/ui.tsx'

const PAGE = 25

function OccurrenceList({ occ }: { occ: Occurrences }) {
  const current = useCurrentTranslation()
  const preview = current.kind === 'online' ? (BUNDLED.find((t) => t.id === 'bsb') ?? BUNDLED[0]) : current
  const [shown, setShown] = useState(PAGE)
  const [texts, setTexts] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    occ.refs.slice(0, shown).forEach((r) => {
      const k = `${r.book}.${r.chapter}.${r.verse}`
      if (texts[k] !== undefined) return
      loadBook(preview.id, r.book).then((b) => {
        const v = b?.chapters[r.chapter - 1]?.find((x) => x.v === r.verse)
        if (!cancelled) setTexts((t) => ({ ...t, [k]: v?.t.replace(/\n/g, ' ') ?? '' }))
      })
    })
    return () => {
      cancelled = true
    }
  }, [occ, shown, preview.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section aria-labelledby="occ" className="mt-6">
      <h2 id="occ" className="font-serif text-2xl font-semibold">
        Where it appears
      </h2>
      <p className="mt-1 text-stone-600 dark:text-stone-400">
        {occ.count.toLocaleString()} time{occ.count === 1 ? '' : 's'} in {occ.refs.length.toLocaleString()} verse
        {occ.refs.length === 1 ? '' : 's'}. Verses shown in the {preview.abbr}.
      </p>
      <ul className="mt-3 space-y-2">
        {occ.refs.slice(0, shown).map((r) => {
          const k = `${r.book}.${r.chapter}.${r.verse}`
          const p = { book: r.book, startChapter: r.chapter, startVerse: r.verse, endChapter: r.chapter, endVerse: r.verse }
          return (
            <li key={k}>
              <Link
                to={readerPath(p)}
                className="block rounded-xl border border-stone-200 bg-white p-3 hover:bg-stone-50 dark:border-stone-800 dark:bg-stone-900 dark:hover:bg-stone-800"
              >
                <span className="font-semibold text-amber-800 dark:text-amber-300">{formatReference(p)}</span>
                <span className="mt-0.5 line-clamp-2 block font-serif leading-relaxed">{texts[k] ?? '…'}</span>
              </Link>
            </li>
          )
        })}
      </ul>
      {shown < occ.refs.length && (
        <button type="button" className={buttonClass('secondary', 'mt-3 w-full')} onClick={() => setShown((n) => n + PAGE * 2)}>
          Show more ({occ.refs.length - shown} left)
        </button>
      )}
    </section>
  )
}

export function WordPage() {
  const { strong = '' } = useParams()
  const [entry, setEntry] = useState<LexiconEntry | null | undefined>(undefined)
  const [occ, setOcc] = useState<Occurrences | null>(null)
  const [showFull, setShowFull] = useState(false)
  useTitle(entry ? `${entry.translit} (${entry.strong})` : 'Word study')

  useEffect(() => {
    let cancelled = false
    setEntry(undefined)
    setOcc(null)
    setShowFull(false)
    getLexicon(strong).then((e) => !cancelled && setEntry(e))
    getOccurrences(strong).then((o) => !cancelled && setOcc(o))
    return () => {
      cancelled = true
    }
  }, [strong])

  if (entry === undefined) return <p className="text-stone-600 dark:text-stone-400">Loading…</p>
  if (!entry)
    return (
      <div>
        <PageTitle sub="This word isn't in the lexicon, or the word-study data isn't saved on this device yet.">Word not found</PageTitle>
        <Link to="/words" className={buttonClass('secondary')}>
          Search words
        </Link>
      </div>
    )

  const hebrew = entry.strong.startsWith('H')
  const def = entry.definition
  const long = def.length > 700
  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-wide text-stone-600 dark:text-stone-400">
        {hebrew ? 'Hebrew / Aramaic' : 'Greek'} · {entry.strong}
      </p>
      <h1 className="mt-1 flex flex-wrap items-baseline gap-x-4">
        <span lang={hebrew ? 'hbo' : 'grc'} dir={hebrew ? 'rtl' : 'ltr'} className="font-serif text-5xl">
          {entry.lemma}
        </span>
        <span className="font-serif text-2xl italic">{entry.translit}</span>
      </h1>
      <p className="mt-3 text-2xl font-semibold">“{entry.gloss}”</p>
      {entry.pos && <p className="mt-1 text-stone-600 dark:text-stone-400">{entry.pos}</p>}

      <Card className="mt-5">
        <h2 className="font-semibold">Definition</h2>
        <p className="mt-2 whitespace-pre-line leading-relaxed">{long && !showFull ? def.slice(0, 700) + '…' : def}</p>
        {long && (
          <button type="button" className="mt-2 text-sm font-semibold underline" onClick={() => setShowFull((s) => !s)}>
            {showFull ? 'Show less' : 'Show the full definition'}
          </button>
        )}
      </Card>

      {entry.senses.length > 1 && (
        <Card className="mt-3">
          <h2 className="font-semibold">Different uses of this number</h2>
          <ul className="mt-2 space-y-1">
            {entry.senses.map((s) => (
              <li key={s.id}>
                <span className="font-semibold">{s.gloss}</span>{' '}
                <span className="text-sm text-stone-600 dark:text-stone-400">
                  ({s.id}
                  {occ?.forms[s.id] ? `, ${occ.forms[s.id]}×` : ''})
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {occ ? <OccurrenceList occ={occ} /> : <p className="mt-6 text-stone-600 dark:text-stone-400">Finding every occurrence…</p>}

      <p className="mt-6 text-xs text-stone-600 dark:text-stone-400">
        From STEP Bible data (Tyndale House Cambridge, CC BY 4.0). {hebrew ? 'Hebrew definitions based on the Abridged BDB (Online Bible).' : 'Greek definitions from Abbott-Smith’s Manual Greek Lexicon.'}
      </p>
    </div>
  )
}
