// Memory verses with spaced repetition: review each verse just before you'd
// forget it. Three ways to practise: recall, first-letter hints, or typing.

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatReference, readerPath } from '../lib/references.ts'
import { removeMemoryCard, reviewMemoryCard, todayStr, useAppState, type MemoryCard, type Recall } from '../lib/storage.ts'
import { useChapters, useTitle } from '../lib/hooks.ts'
import { passageFromKey } from '../components/VerseActions.tsx'
import { Card, PageTitle, buttonClass } from '../components/ui.tsx'
import { TextCredit } from '../components/TextCredit.tsx'

type Mode = 'recall' | 'hints' | 'type'

function useCardText(card: MemoryCard | undefined) {
  const p = card ? passageFromKey(card.key) : null
  const state = useChapters(p?.book, p?.startChapter ?? 1)
  const verses = state.verses.filter((v) => p && v.v >= (p.startVerse ?? 1) && v.v <= (p.endVerse ?? p.startVerse ?? 999))
  return { ...state, text: verses.map((v) => v.t.replace(/\n/g, ' ')).join(' '), passage: p }
}

const words = (s: string) => s.split(/\s+/).filter(Boolean)
const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '')

function firstLetters(text: string) {
  return words(text)
    .map((w) => w.replace(/^([^\p{L}]*)(\p{L})[\p{L}'’-]*/u, '$1$2'))
    .join(' ')
}

function Review({ card, onDone }: { card: MemoryCard; onDone: () => void }) {
  const { text, loading, used, notice, passage } = useCardText(card)
  const [mode, setMode] = useState<Mode>('recall')
  const [revealed, setRevealed] = useState(false)
  const [typed, setTyped] = useState('')
  const ref = passage ? formatReference(passage) : card.key

  const score = useMemo(() => {
    if (mode !== 'type' || !revealed) return null
    const target = words(text).map(norm)
    const got = words(typed).map(norm)
    let right = 0
    target.forEach((w, i) => {
      if (got[i] === w || got.includes(w)) right++
    })
    return Math.round((right / Math.max(target.length, 1)) * 100)
  }, [mode, revealed, text, typed])

  const answer = (r: Recall) => {
    reviewMemoryCard(card.key, r)
    setRevealed(false)
    setTyped('')
    onDone()
  }

  return (
    <Card className="border-2 border-amber-300 dark:border-amber-700">
      <p className="text-sm font-semibold uppercase tracking-wide text-stone-600 dark:text-stone-400">Recite from memory</p>
      <h2 className="mt-1 font-serif text-3xl font-semibold">{ref}</h2>

      <div className="mt-3 flex gap-2" role="group" aria-label="Practice mode">
        {(
          [
            ['recall', 'Recall'],
            ['hints', 'First letters'],
            ['type', 'Type it'],
          ] as [Mode, string][]
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => {
              setMode(m)
              setRevealed(false)
            }}
            className={`min-h-10 flex-1 rounded-full border px-2 text-sm font-semibold ${
              mode === m ? 'border-amber-700 bg-amber-50 dark:border-amber-300 dark:bg-amber-950/40' : 'border-stone-300 dark:border-stone-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 min-h-24 rounded-xl bg-stone-50 p-4 font-serif text-lg leading-relaxed dark:bg-stone-800/50" aria-live="polite">
        {loading ? (
          'Loading…'
        ) : revealed ? (
          text
        ) : mode === 'hints' ? (
          <span className="tracking-wide">{firstLetters(text)}</span>
        ) : mode === 'type' ? (
          <>
            <label htmlFor="typed" className="sr-only">
              Type the verse
            </label>
            <textarea
              id="typed"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              rows={4}
              placeholder="Type the verse from memory…"
              className="w-full rounded-lg border border-stone-300 bg-white p-3 font-sans text-base dark:border-stone-700 dark:bg-stone-900"
            />
          </>
        ) : (
          <span className="font-sans text-base text-stone-600 dark:text-stone-400">Say it out loud or in your head, then check.</span>
        )}
      </div>
      {revealed && score !== null && (
        <p className="mt-2 font-semibold">
          {score}% of the words matched{score >= 90 ? '. Excellent!' : score >= 60 ? '. Nearly there.' : '. Keep practising.'}
        </p>
      )}
      <p className="mt-2 text-xs text-stone-600 dark:text-stone-400">
        <TextCredit used={used} notice={notice} />
      </p>

      {!revealed ? (
        <button type="button" className={buttonClass('primary', 'mt-4 w-full')} onClick={() => setRevealed(true)} disabled={loading}>
          {mode === 'type' ? 'Check' : 'Show the verse'}
        </button>
      ) : (
        <>
          <p className="mt-4 text-center font-semibold">How well did you remember it?</p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {(
              [
                ['again', 'Again', 'today'],
                ['hard', 'Hard', 'soon'],
                ['good', 'Good', 'later'],
                ['easy', 'Easy', 'much later'],
              ] as [Recall, string, string][]
            ).map(([r, label, when]) => (
              <button key={r} type="button" onClick={() => answer(r)} className={buttonClass(r === 'good' ? 'primary' : 'secondary', 'flex-col gap-0 px-1')}>
                {label}
                <span className="text-xs font-normal">{when}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </Card>
  )
}

export function MemoryPage() {
  useTitle('Memory verses')
  const memory = useAppState((s) => s.memory)
  const cards = Object.values(memory).sort((a, b) => a.due.localeCompare(b.due))
  const today = todayStr()
  const due = cards.filter((c) => c.due <= today)
  const [reviewing, setReviewing] = useState(false)
  // Verses already seen this session wait until the others have had a turn.
  const [seen, setSeen] = useState<string[]>([])
  const current = due.find((c) => !seen.includes(c.key)) ?? due[0]

  return (
    <div className="space-y-5">
      <PageTitle sub="Hide God's word in your heart (Psalm 119:11). Tap “Memorize” on any verse in the reader to add it.">
        Memory verses
      </PageTitle>

      {reviewing && current ? (
        <Review
          key={current.key + current.reps + current.lapses}
          card={current}
          onDone={() => setSeen((s) => (due.every((c) => s.includes(c.key) || c.key === current.key) ? [] : [...s, current.key]))}
        />
      ) : (
        <Card>
          <p className="text-lg font-semibold">
            {due.length ? `${due.length} verse${due.length === 1 ? '' : 's'} to review today` : cards.length ? 'All caught up for today!' : 'No memory verses yet'}
          </p>
          {due.length > 0 && (
            <button type="button" className={buttonClass('primary', 'mt-3 w-full')} onClick={() => setReviewing(true)}>
              Start review
            </button>
          )}
          {!cards.length && (
            <p className="mt-2 text-stone-700 dark:text-stone-300">
              Good ones to start with: <Link className="underline" to="/bible/JHN/3?v=16">John 3:16</Link>,{' '}
              <Link className="underline" to="/bible/PSA/23?v=1">Psalm 23:1</Link>,{' '}
              <Link className="underline" to="/bible/PRO/3?v=5-6">Proverbs 3:5–6</Link>,{' '}
              <Link className="underline" to="/bible/ROM/8?v=28">Romans 8:28</Link>.
            </p>
          )}
        </Card>
      )}
      {reviewing && !current && (
        <Card>
          <p className="text-lg font-semibold">Review finished. Well done!</p>
        </Card>
      )}

      {cards.length > 0 && (
        <section aria-labelledby="all-cards">
          <h2 id="all-cards" className="mb-3 font-serif text-2xl font-semibold">
            Your verses
          </h2>
          <ul className="space-y-2">
            {cards.map((c) => {
              const p = passageFromKey(c.key)!
              return (
                <li key={c.key} className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
                  <div className="flex-1">
                    <Link to={readerPath(p)} className="font-semibold text-amber-800 underline underline-offset-2 dark:text-amber-300">
                      {formatReference(p)}
                    </Link>
                    <p className="text-sm text-stone-600 dark:text-stone-400">
                      {c.due <= today ? 'Due today' : `Next review ${new Date(c.due + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}
                      {c.reps > 0 && ` · reviewed ${c.reps}×`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => confirm(`Remove ${formatReference(p)} from memory verses?`) && removeMemoryCard(c.key)}
                    className="text-sm text-stone-600 underline dark:text-stone-400"
                  >
                    Remove
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
