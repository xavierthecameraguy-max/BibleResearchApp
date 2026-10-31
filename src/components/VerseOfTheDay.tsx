import { Link } from 'react-router-dom'
import { versesOfTheDay } from '../lib/content.ts'
import { useChapters } from '../lib/hooks.ts'
import { formatReference, parseReference, readerPath } from '../lib/references.ts'
import { addMemoryCard, useAppState } from '../lib/storage.ts'
import { rangeKey } from './VerseActions.tsx'
import { Card } from './ui.tsx'
import { TextCredit } from './TextCredit.tsx'

function dayOfYear(d = new Date()) {
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 86_400_000)
}

export function VerseOfTheDay() {
  const ref = versesOfTheDay[dayOfYear() % versesOfTheDay.length]
  const p = parseReference(ref)!
  const { verses, loading, used, notice } = useChapters(p.book, p.startChapter)
  const from = p.startVerse ?? 1
  const to = p.endVerse ?? from
  const text = verses
    .filter((v) => v.v >= from && v.v <= to)
    .map((v) => {
      // Some translations put a psalm's title ("A Psalm of David.") in verse 1; leave it out here.
      const lines = v.t.split('\n')
      if (p.book === 'PSA' && v.v === 1 && lines.length > 1 && /psalm|song|maskil|miktam|prayer|choirmaster|director/i.test(lines[0])) lines.shift()
      return lines.join(' ')
    })
    .join(' ')
  const key = rangeKey(p.book, p.startChapter, Array.from({ length: to - from + 1 }, (_, i) => from + i))
  const memorizing = useAppState((s) => !!s.memory[key])
  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-wide text-stone-600 dark:text-stone-400">Verse of the day</p>
      <blockquote className="mt-2 font-serif text-xl leading-relaxed">{loading ? '…' : `“${text}”`}</blockquote>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link to={readerPath(p)} className="inline-flex min-h-11 items-center font-semibold text-amber-800 underline underline-offset-2 dark:text-amber-300">
          {formatReference(p)}
        </Link>
        <button
          type="button"
          onClick={() => addMemoryCard(key)}
          disabled={memorizing}
          className="inline-flex min-h-11 items-center text-sm text-stone-700 underline underline-offset-2 disabled:no-underline disabled:opacity-70 dark:text-stone-300"
        >
          {memorizing ? 'In your memory verses' : 'Memorize'}
        </button>
      </p>
      <p className="mt-2 text-xs text-stone-600 dark:text-stone-400">
        <TextCredit used={used} notice={notice} />
      </p>
    </Card>
  )
}
