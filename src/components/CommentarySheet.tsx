// Matthew Henry's notes on the selected verse (from the reader).

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getVerseCommentary, sectionLabel, type CommentarySection } from '../lib/data/commentary.ts'
import { formatReference } from '../lib/references.ts'
import { COMMENTARY_NOTE, CommentaryText } from '../pages/CommentaryPage.tsx'
import { Sheet } from './ui.tsx'

export function CommentarySheet(props: { open: boolean; onClose: () => void; book: string; chapter: number; verse: number }) {
  const { open, onClose, book, chapter, verse } = props
  const [sections, setSections] = useState<CommentarySection[] | null>(null)
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setSections(null)
    getVerseCommentary(book, chapter, verse).then((s) => !cancelled && setSections(s))
    return () => {
      cancelled = true
    }
  }, [open, book, chapter, verse])
  const here = formatReference({ book, startChapter: chapter, startVerse: verse, endChapter: chapter, endVerse: verse })
  return (
    <Sheet open={open} onClose={onClose} title={`Commentary: ${here}`}>
      <div className="max-h-[65vh] overflow-y-auto">
        <p className="mb-3 text-xs text-stone-600 dark:text-stone-400">{COMMENTARY_NOTE}</p>
        {!sections ? (
          <p className="text-stone-600 dark:text-stone-400">Loading…</p>
        ) : !sections.length ? (
          <p>No notes on this verse.</p>
        ) : (
          sections.map((s, i) => (
            <section key={i} className="mb-4">
              <h3 className="font-semibold">
                {sectionLabel(s)}
                {s.title && <span className="block font-normal italic text-stone-600 dark:text-stone-400">{s.title}</span>}
              </h3>
              <div className="mt-1 text-[0.98rem]">
                <CommentaryText item={s} onNavigate={onClose} />
              </div>
            </section>
          ))
        )}
        <Link to={`/commentary/${book}/${chapter}`} onClick={onClose} className="mt-2 inline-block font-semibold underline">
          Whole chapter commentary
        </Link>
      </div>
    </Sheet>
  )
}
