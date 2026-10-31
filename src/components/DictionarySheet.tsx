// Dictionary articles that discuss a verse (from the reader).

import { useEffect, useState } from 'react'
import { getEntriesForVerse, type DictionaryIndexEntry } from '../lib/data/dictionary.ts'
import { formatReference } from '../lib/references.ts'
import { EntryList } from '../pages/DictionaryPage.tsx'
import { Sheet } from './ui.tsx'

export function DictionarySheet(props: { open: boolean; onClose: () => void; book: string; chapter: number; verse: number }) {
  const { open, onClose, book, chapter, verse } = props
  const [entries, setEntries] = useState<DictionaryIndexEntry[] | null>(null)
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setEntries(null)
    getEntriesForVerse(book, chapter, verse).then((e) => !cancelled && setEntries(e))
    return () => {
      cancelled = true
    }
  }, [open, book, chapter, verse])
  const here = formatReference({ book, startChapter: chapter, startVerse: verse, endChapter: chapter, endVerse: verse })
  return (
    <Sheet open={open} onClose={onClose} title={`Dictionary: ${here}`}>
      <div className="max-h-[65vh] overflow-y-auto">
        {!entries ? (
          <p className="text-stone-600 dark:text-stone-400">Loading…</p>
        ) : !entries.length ? (
          <p>No dictionary articles mention this verse.</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-stone-600 dark:text-stone-400">Articles that mention this verse (or its chapter).</p>
            <EntryList entries={entries.slice(0, 40)} onPick={onClose} />
          </>
        )}
      </div>
    </Sheet>
  )
}
