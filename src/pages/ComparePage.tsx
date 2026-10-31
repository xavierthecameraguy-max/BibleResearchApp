// Compare a passage across several translations, one under another.

import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { loadChapter, type Translation } from '../lib/bible.ts'
import { useCurrentTranslation, useTitle, useTranslations } from '../lib/hooks.ts'
import { formatReference, parseReference, readerPath, type Passage } from '../lib/references.ts'
import { updateSettings, useAppState } from '../lib/storage.ts'
import type { Verse } from '../lib/bibleTypes.ts'
import { passageFromKey } from '../components/VerseActions.tsx'
import { Card, PageTitle, buttonClass } from '../components/ui.tsx'
import { Link } from 'react-router-dom'

function TranslationColumn({ t, passage }: { t: Translation; passage: Passage }) {
  const [state, setState] = useState<{ verses: Verse[]; notice?: string; error?: string } | null>(null)
  useEffect(() => {
    let cancelled = false
    setState(null)
    loadChapter(t, passage.book, passage.startChapter).then((r) => {
      if (cancelled) return
      if (typeof r === 'string') {
        setState({
          verses: [],
          error: r === 'offline' ? 'Needs an internet connection.' : r === 'missing' ? 'Not available for this passage.' : "Couldn't load right now.",
        })
        return
      }
      const from = passage.startVerse ?? 1
      const to = passage.endVerse ?? 999
      setState({ verses: r.verses.filter((v) => v.v >= from && v.v <= to), notice: r.notice })
    })
    return () => {
      cancelled = true
    }
  }, [t, passage.book, passage.startChapter, passage.startVerse, passage.endVerse])

  return (
    <Card>
      <h2 className="font-semibold">
        {t.abbr} <span className="font-normal text-stone-600 dark:text-stone-400">· {t.name}</span>
      </h2>
      {!state ? (
        <p className="mt-2 text-stone-600 dark:text-stone-400">Loading…</p>
      ) : state.error ? (
        <p className="mt-2 text-stone-600 dark:text-stone-400">{state.error}</p>
      ) : (
        <p className="mt-2 font-serif text-[1.1rem] leading-relaxed">
          {state.verses.map((v) => (
            <span key={v.v}>
              <sup className="mr-1 font-sans text-xs font-semibold text-stone-600 dark:text-stone-400">{v.v}</sup>
              {v.t.replace(/\n/g, ' ')}{' '}
            </span>
          ))}
        </p>
      )}
      {state?.notice && t.kind === 'online' && <p className="mt-2 text-xs text-stone-600 dark:text-stone-400">{state.notice}</p>}
    </Card>
  )
}

export function ComparePage() {
  const [search, setSearch] = useSearchParams()
  const raw = search.get('ref') ?? 'JHN.3.16-17'
  const passage = passageFromKey(raw) ?? parseReference(raw)
  const all = useTranslations()
  const current = useCurrentTranslation()
  const chosen = useAppState((s) => s.settings.compare)
  const [input, setInput] = useState('')
  useTitle('Compare translations')

  const ids = [current.id, ...chosen.filter((id) => id !== current.id)]
  const shown = ids.map((id) => all.find((t) => t.id === id)).filter((t): t is Translation => !!t)

  if (!passage) return <PageTitle>Passage not found</PageTitle>
  // Compare works one chapter at a time.
  const single: Passage = { ...passage, endChapter: passage.startChapter, endVerse: passage.endChapter === passage.startChapter ? passage.endVerse : undefined }

  return (
    <div>
      <PageTitle sub="See how different translations put the same words into English.">Compare</PageTitle>
      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const p = parseReference(input)
          if (p) setSearch({ ref: formatReference(p) })
        }}
      >
        <label htmlFor="cmp-ref" className="sr-only">
          Passage
        </label>
        <input
          id="cmp-ref"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={formatReference(single)}
          className="min-h-12 flex-1 rounded-xl border border-stone-300 bg-white px-4 text-base dark:border-stone-700 dark:bg-stone-900"
        />
        <button className={buttonClass('primary')}>Go</button>
      </form>

      <h2 className="mb-3 font-serif text-2xl font-semibold">{formatReference(single)}</h2>
      <div className="space-y-3">
        {shown.map((t) => (
          <TranslationColumn key={t.id} t={t} passage={single} />
        ))}
      </div>

      <fieldset className="mt-6">
        <legend className="mb-2 font-semibold">Translations to compare</legend>
        <div className="flex flex-wrap gap-2">
          {all.map((t) => {
            const on = chosen.includes(t.id) || t.id === current.id
            return (
              <label
                key={t.id}
                className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 ${
                  on ? 'border-amber-700 bg-amber-50 dark:border-amber-300 dark:bg-amber-950/40' : 'border-stone-300 dark:border-stone-700'
                }`}
              >
                <input
                  type="checkbox"
                  className="size-4 accent-amber-700"
                  checked={on}
                  disabled={t.id === current.id}
                  onChange={() =>
                    updateSettings({ compare: chosen.includes(t.id) ? chosen.filter((x) => x !== t.id) : [...chosen, t.id] })
                  }
                />
                {t.abbr}
              </label>
            )
          })}
        </div>
      </fieldset>

      <Link to={readerPath(single)} className={buttonClass('secondary', 'mt-6 w-full')}>
        Read in context
      </Link>
    </div>
  )
}
