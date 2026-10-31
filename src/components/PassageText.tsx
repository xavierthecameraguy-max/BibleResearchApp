// Shows the verses of a passage in the reader's chosen translation, with
// links to read it in context and to open it in the NKJV online.

import { Link } from 'react-router-dom'
import { fallbackMessage, useChapters, useCurrentTranslation } from '../lib/hooks.ts'
import { formatReference, readerPath, type Passage } from '../lib/references.ts'
import type { Verse } from '../lib/bibleTypes.ts'
import { OpenOnlineLink } from './OpenOnlineLink.tsx'
import { TextCredit } from './TextCredit.tsx'
import { buttonClass } from './ui.tsx'

/** chapters[0] is p.startChapter */
function versesFor(chapters: Verse[][], p: Passage): { chapter: number; verse: Verse }[] {
  const out: { chapter: number; verse: Verse }[] = []
  for (let c = p.startChapter; c <= p.endChapter; c++) {
    for (const v of chapters[c - p.startChapter] ?? []) {
      if (c === p.startChapter && p.startVerse && v.v < p.startVerse) continue
      if (c === p.endChapter && p.endVerse && v.v > p.endVerse) continue
      out.push({ chapter: c, verse: v })
    }
  }
  return out
}

export function PassageText({ passage, maxVerses = 60, label = 'Key passage' }: { passage: Passage; maxVerses?: number; label?: string }) {
  const chosen = useCurrentTranslation()
  const { chapters, loading, used, fellBack, notice } = useChapters(passage.book, passage.startChapter, passage.endChapter)
  const verses = versesFor(chapters, passage)
  const shown = verses.slice(0, maxVerses)
  const ref = formatReference(passage)

  return (
    <section aria-label={`${label}: ${ref}`} className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
      <p className="text-sm font-semibold uppercase tracking-wide text-stone-600 dark:text-stone-400">{label}</p>
      <h2 className="mt-1 font-serif text-2xl font-semibold">{ref}</h2>

      {loading ? (
        <p className="mt-4 text-stone-500">Loading…</p>
      ) : shown.length ? (
        <div className="mt-4 space-y-2 font-serif text-[1.08rem] leading-relaxed">
          {shown.map(({ chapter, verse }, i) => (
            <p key={`${chapter}:${verse.v}`} className={verse.p && i ? 'pt-2' : ''}>
              <sup className="mr-1 font-sans text-xs font-semibold text-stone-600 dark:text-stone-400">
                {passage.startChapter !== passage.endChapter && (verse.v === 1 || i === 0) ? `${chapter}:` : ''}
                {verse.v}
              </sup>
              <span className="whitespace-pre-line">{verse.t}</span>
            </p>
          ))}
          {verses.length > shown.length && <p className="text-stone-500">…continues in the reader.</p>}
        </div>
      ) : (
        <p className="mt-4 text-stone-600 dark:text-stone-400">This passage isn't available in the current translation.</p>
      )}

      <p className="mt-4 text-sm text-stone-600 dark:text-stone-400">
        {used.kind === 'online' ? <TextCredit used={used} notice={notice} /> : used.abbr}
        {fellBack && <span className="block">{fallbackMessage(chosen.abbr, fellBack)}</span>}
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Link to={readerPath(passage)} className={buttonClass('secondary', 'flex-1')}>
          Read in context
        </Link>
        <OpenOnlineLink passage={passage} className={buttonClass('secondary', 'flex-1')} />
      </div>
    </section>
  )
}
