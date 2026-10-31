import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { loadBook } from '../lib/bible.ts'
import { getBook } from '../lib/books.ts'
import { useTitle } from '../lib/hooks.ts'
import { PageTitle } from '../components/ui.tsx'
import { BookIntroCard } from '../components/BookIntroCard.tsx'
import { NotFoundPage } from './NotFoundPage.tsx'

export function BibleBookPage() {
  const { bookId = '' } = useParams()
  const book = getBook(bookId)
  useTitle(book?.name ?? 'Not found')
  const [sections, setSections] = useState<{ heading: string; chapter: number; verse: number }[] | null>(null)
  useEffect(() => {
    if (!book) return
    let cancelled = false
    setSections(null)
    loadBook('bsb', book.id).then((b) => {
      if (cancelled || !b) return
      const out: { heading: string; chapter: number; verse: number }[] = []
      b.chapters.forEach((ch, ci) => ch?.forEach((v) => v.h && out.push({ heading: v.h, chapter: ci + 1, verse: v.v })))
      setSections(out)
    })
    return () => {
      cancelled = true
    }
  }, [book])
  if (!book) return <NotFoundPage />
  return (
    <div>
      <PageTitle>{book.name}</PageTitle>
      <BookIntroCard bookId={book.id} />
      {sections && sections.length > 0 && (
        <details className="mt-6 rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
          <summary className="cursor-pointer font-semibold">Outline: {sections.length} sections</summary>
          <ol className="mt-3 space-y-1.5">
            {sections.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-14 shrink-0 text-right text-sm tabular-nums text-stone-600 dark:text-stone-400">
                  {s.chapter}:{s.verse}
                </span>
                <Link to={`/bible/${book.id}/${s.chapter}?v=${s.verse}`} className="underline-offset-2 hover:underline">
                  {s.heading}
                </Link>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-stone-600 dark:text-stone-400">Section headings from the Berean Standard Bible.</p>
        </details>
      )}

      <section aria-labelledby="chapters" className="mt-6">
        <h2 id="chapters" className="mb-3 font-serif text-2xl font-semibold">
          Chapters
        </h2>
        <ul className="grid grid-cols-5 gap-2 sm:grid-cols-8">
          {Array.from({ length: book.chapters }, (_, i) => i + 1).map((c) => (
            <li key={c}>
              <Link
                to={`/bible/${book.id}/${c}`}
                aria-label={`${book.name} chapter ${c}`}
                className="flex aspect-square min-h-12 items-center justify-center rounded-xl border border-stone-200 bg-white text-lg font-medium hover:bg-stone-50 dark:border-stone-800 dark:bg-stone-900 dark:hover:bg-stone-800"
              >
                {c}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
