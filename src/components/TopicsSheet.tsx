import { useEffect, useState } from 'react'
import { getTopicsForVerse, type TopicSummary } from '../lib/data/topics.ts'
import { formatReference } from '../lib/references.ts'
import { TopicList } from '../pages/TopicsPage.tsx'
import { OFFLINE_DATA_MESSAGE, Sheet } from './ui.tsx'

export function TopicsSheet(props: { open: boolean; onClose: () => void; book: string; chapter: number; verse: number }) {
  const { open, onClose, book, chapter, verse } = props
  const [topics, setTopics] = useState<TopicSummary[] | null>(null)
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setTopics(null)
    getTopicsForVerse(book, chapter, verse).then((t) => !cancelled && setTopics(t))
    return () => {
      cancelled = true
    }
  }, [open, book, chapter, verse])
  const here = formatReference({ book, startChapter: chapter, startVerse: verse, endChapter: chapter, endVerse: verse })
  return (
    <Sheet open={open} onClose={onClose} title={`Topics: ${here}`}>
      <div className="max-h-[65vh] overflow-y-auto">
        {!topics ? (
          <p className="text-stone-600 dark:text-stone-400">Loading…</p>
        ) : !topics.length ? (
          <p>{navigator.onLine ? 'No topics list this verse.' : OFFLINE_DATA_MESSAGE}</p>
        ) : (
          <TopicList topics={topics.slice(0, 50)} onPick={onClose} />
        )}
      </div>
    </Sheet>
  )
}
