// A quick "go to" sheet: pick a book, then a chapter.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BOOKS, getBook } from '../lib/books.ts'
import { Sheet } from './ui.tsx'

export function ChapterJump({ open, onClose, currentBook }: { open: boolean; onClose: () => void; currentBook: string }) {
  const navigate = useNavigate()
  const [book, setBook] = useState<string | null>(null)
  const chosen = book ? getBook(book) : null
  const close = () => {
    setBook(null)
    onClose()
  }
  return (
    <Sheet open={open} onClose={close} title={chosen ? chosen.name : 'Go to'}>
      <div className="max-h-[65vh] overflow-y-auto">
        {!chosen ? (
          ['OT', 'NT'].map((t) => (
            <div key={t} className="mb-4">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-600 dark:text-stone-400">
                {t === 'OT' ? 'Old Testament' : 'New Testament'}
              </h3>
              <ul className="grid grid-cols-3 gap-1.5">
                {BOOKS.filter((b) => b.testament === t).map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => (b.chapters === 1 ? (navigate(`/bible/${b.id}/1`), close()) : setBook(b.id))}
                      className={`min-h-11 w-full rounded-lg border px-1 text-[0.85rem] ${
                        b.id === currentBook ? 'border-amber-700 bg-amber-50 dark:border-amber-300 dark:bg-amber-950/40' : 'border-stone-200 dark:border-stone-700'
                      }`}
                    >
                      {b.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        ) : (
          <>
            <button type="button" onClick={() => setBook(null)} className="mb-3 text-sm underline">
              ← All books
            </button>
            <ul className="grid grid-cols-6 gap-1.5">
              {Array.from({ length: chosen.chapters }, (_, i) => i + 1).map((c) => (
                <li key={c}>
                  <button
                    type="button"
                    onClick={() => {
                      navigate(`/bible/${chosen.id}/${c}`)
                      close()
                    }}
                    aria-label={`${chosen.name} chapter ${c}`}
                    className="aspect-square min-h-11 w-full rounded-lg border border-stone-200 font-medium dark:border-stone-700"
                  >
                    {c}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Sheet>
  )
}
