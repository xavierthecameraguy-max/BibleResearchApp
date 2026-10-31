// Everything you've marked in the Bible: bookmarks, highlights and verse notes.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatReference, readerPath } from '../lib/references.ts'
import { BOOK_IDS } from '../lib/books.ts'
import { toggleBookmark, useAppState, type HighlightColor } from '../lib/storage.ts'
import { useTitle } from '../lib/hooks.ts'
import { HIGHLIGHT_STYLES, passageFromKey } from '../components/VerseActions.tsx'
import { Card, PageTitle } from '../components/ui.tsx'

type Tab = 'bookmarks' | 'highlights' | 'notes'

/** Sort verse keys in Bible order */
function bibleOrder(a: string, b: string): number {
  const pa = passageFromKey(a)!
  const pb = passageFromKey(b)!
  return (
    BOOK_IDS.indexOf(pa.book) - BOOK_IDS.indexOf(pb.book) ||
    pa.startChapter - pb.startChapter ||
    (pa.startVerse ?? 0) - (pb.startVerse ?? 0)
  )
}

function RefLink({ k }: { k: string }) {
  const p = passageFromKey(k)
  if (!p) return null
  return (
    <Link to={readerPath(p)} className="font-semibold text-amber-800 underline underline-offset-2 dark:text-amber-300">
      {formatReference(p)}
    </Link>
  )
}

export function MyBiblePage() {
  useTitle('My Bible')
  const [tab, setTab] = useState<Tab>('bookmarks')
  const bookmarks = useAppState((s) => s.bookmarks)
  const highlights = useAppState((s) => s.highlights)
  const notes = useAppState((s) => s.verseNotes)
  const [color, setColor] = useState<HighlightColor | 'all'>('all')

  const hlKeys = Object.keys(highlights)
    .filter((k) => color === 'all' || highlights[k] === color)
    .sort(bibleOrder)
  const noteKeys = Object.keys(notes).sort(bibleOrder)

  const tabs: [Tab, string, number][] = [
    ['bookmarks', 'Bookmarks', bookmarks.length],
    ['highlights', 'Highlights', Object.keys(highlights).length],
    ['notes', 'Verse notes', noteKeys.length],
  ]

  return (
    <div>
      <PageTitle sub="Everything you've marked while reading. Tap a verse in the Bible reader to add more.">My Bible</PageTitle>
      <div role="tablist" aria-label="My Bible" className="mb-5 flex gap-2">
        {tabs.map(([id, label, n]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`min-h-11 flex-1 rounded-full border px-3 text-[0.95rem] font-semibold ${
              tab === id
                ? 'border-amber-700 bg-amber-700 text-white dark:border-amber-300 dark:bg-amber-300 dark:text-stone-950'
                : 'border-stone-300 dark:border-stone-700'
            }`}
          >
            {label} <span className="font-normal">({n})</span>
          </button>
        ))}
      </div>

      {tab === 'bookmarks' && (
        <div role="tabpanel">
        <ul className="space-y-2">
          {!bookmarks.length && <li><Card>No bookmarks yet.</Card></li>}
          {bookmarks.map((b) => (
            <li key={b.key} className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
              <RefLink k={b.key} />
              <button type="button" onClick={() => toggleBookmark(b.key)} className="text-sm text-stone-600 underline dark:text-stone-400">
                Remove
              </button>
            </li>
          ))}
        </ul>
        </div>
      )}

      {tab === 'highlights' && (
        <div role="tabpanel">
          <div className="mb-3 flex items-center gap-2" role="group" aria-label="Filter by colour">
            <button
              type="button"
              aria-pressed={color === 'all'}
              onClick={() => setColor('all')}
              className={`min-h-9 rounded-full border px-3 text-sm ${color === 'all' ? 'border-stone-900 dark:border-white' : 'border-stone-300 dark:border-stone-700'}`}
            >
              All
            </button>
            {(Object.keys(HIGHLIGHT_STYLES) as HighlightColor[]).map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Show ${HIGHLIGHT_STYLES[c].label} highlights`}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className={`size-9 rounded-full border-2 ${HIGHLIGHT_STYLES[c].swatch} ${color === c ? 'border-stone-900 dark:border-white' : 'border-transparent'}`}
              />
            ))}
          </div>
          <ul className="space-y-2">
            {!hlKeys.length && <li><Card>No highlights yet.</Card></li>}
            {hlKeys.map((k) => (
              <li key={k} className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
                <span className={`size-4 shrink-0 rounded-full ${HIGHLIGHT_STYLES[highlights[k]].swatch}`} aria-hidden="true" />
                <RefLink k={k} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'notes' && (
        <div role="tabpanel">
        <ul className="space-y-3">
          {!noteKeys.length && <li><Card>No verse notes yet.</Card></li>}
          {noteKeys.map((k) => (
            <li key={k}>
              <Card>
                <RefLink k={k} />
                <p className="mt-2 whitespace-pre-line leading-relaxed">{notes[k].text}</p>
                <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
                  {new Date(notes[k].updatedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                </p>
              </Card>
            </li>
          ))}
        </ul>
        </div>
      )}
      <p className="mt-6 text-sm text-stone-600 dark:text-stone-400">
        Your marks are saved on this device. <Link to="/notes" className="underline">Notes → Save backup</Link> keeps a copy.
      </p>
    </div>
  )
}
