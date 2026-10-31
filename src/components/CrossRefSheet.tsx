// The list of cross-references for a verse, with a preview of each passage.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadBook, type Translation } from '../lib/bible.ts'
import { getCrossRefs, type CrossRef } from '../lib/data/xrefs.ts'
import { formatReference, readerPath } from '../lib/references.ts'
import { Sheet } from './ui.tsx'

function previewText(t: Translation, ref: CrossRef): Promise<string> {
  const p = ref.passage
  return loadBook(t.id, p.book).then((b) => {
    if (!b) return ''
    const out: string[] = []
    for (let c = p.startChapter; c <= p.endChapter && out.length < 4; c++) {
      for (const v of b.chapters[c - 1] ?? []) {
        if (c === p.startChapter && p.startVerse && v.v < p.startVerse) continue
        if (c === p.endChapter && p.endVerse && v.v > p.endVerse) break
        out.push(v.t.replace(/\n/g, ' '))
        if (out.length >= 4) break
      }
    }
    return out.join(' ')
  })
}

export function CrossRefSheet(props: {
  open: boolean
  onClose: () => void
  book: string
  chapter: number
  verse: number
  /** An offline translation to preview the references in */
  previewIn: Translation
}) {
  const { open, onClose, book, chapter, verse, previewIn } = props
  const [refs, setRefs] = useState<CrossRef[] | null>(null)
  const [texts, setTexts] = useState<Record<number, string>>({})
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setRefs(null)
    setTexts({})
    setShowAll(false)
    getCrossRefs(book, chapter, verse).then((r) => {
      if (!cancelled) setRefs(r)
    })
    return () => {
      cancelled = true
    }
  }, [open, book, chapter, verse])

  const shown = refs ? (showAll ? refs : refs.slice(0, 12)) : []
  useEffect(() => {
    let cancelled = false
    shown.forEach((r, i) => {
      if (texts[i] !== undefined) return
      previewText(previewIn, r).then((t) => {
        if (!cancelled) setTexts((x) => ({ ...x, [i]: t }))
      })
    })
    return () => {
      cancelled = true
    }
  }, [refs, showAll, previewIn.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const here = formatReference({ book, startChapter: chapter, startVerse: verse, endChapter: chapter, endVerse: verse })
  return (
    <Sheet open={open} onClose={onClose} title={`Cross-references for ${here}`}>
      <div className="max-h-[65vh] overflow-y-auto">
        {!refs ? (
          <p className="text-stone-600 dark:text-stone-400">Loading…</p>
        ) : !refs.length ? (
          <p>No cross-references for this verse.</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-stone-600 dark:text-stone-400">
              {refs.length} related passage{refs.length === 1 ? '' : 's'}, most helpful first. Preview in {previewIn.abbr}.
            </p>
            <ul className="space-y-2">
              {shown.map((r, i) => (
                <li key={i}>
                  <Link
                    to={readerPath(r.passage)}
                    onClick={onClose}
                    className="block rounded-xl border border-stone-200 p-3 hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-800"
                  >
                    <span className="font-semibold text-amber-800 dark:text-amber-300">{formatReference(r.passage)}</span>
                    <span className="mt-1 line-clamp-3 block font-serif leading-relaxed">{texts[i] ?? '…'}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {refs.length > 12 && !showAll && (
              <button type="button" onClick={() => setShowAll(true)} className="mt-3 w-full rounded-xl py-3 font-semibold underline">
                Show all {refs.length}
              </button>
            )}
            <p className="mt-4 text-xs text-stone-600 dark:text-stone-400">
              Cross-references from OpenBible.info (CC BY 4.0), based on the Treasury of Scripture Knowledge.
            </p>
          </>
        )}
      </div>
    </Sheet>
  )
}
