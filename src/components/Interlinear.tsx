// Interlinear line: the Hebrew or Greek words of a verse with English glosses.

import { Link } from 'react-router-dom'
import type { OriginalWord } from '../lib/data/original.ts'

export function InterlinearRow({ words }: { words: OriginalWord[] | undefined }) {
  if (!words?.length) return null
  const hebrew = words[0].language !== 'greek'
  return (
    <span
      dir={hebrew ? 'rtl' : 'ltr'}
      className="mb-3 mt-1 flex flex-wrap gap-1.5 rounded-xl bg-stone-100/70 p-2 dark:bg-stone-900/70"
    >
      {words.map((w) => (
        <Link
          key={w.position}
          to={`/word/${w.strong}`}
          className="flex min-w-12 flex-col items-center rounded-lg px-1.5 py-1 text-center hover:bg-white dark:hover:bg-stone-800"
        >
          <span lang={hebrew ? 'hbo' : 'grc'} className="font-serif text-xl leading-tight">
            {w.text}
          </span>
          <span dir="ltr" className="font-sans text-[0.7rem] leading-tight text-stone-600 dark:text-stone-400">
            {w.gloss || '—'}
          </span>
        </Link>
      ))}
    </span>
  )
}
