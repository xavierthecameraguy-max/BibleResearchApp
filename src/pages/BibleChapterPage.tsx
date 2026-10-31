import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getBook } from '../lib/books.ts'
import { useBookText, useTitle } from '../lib/hooks.ts'
import { setLastRead } from '../lib/storage.ts'
import { formatReference } from '../lib/references.ts'
import { TranslationPicker } from '../components/TranslationPicker.tsx'
import { OpenOnlineLink } from '../components/OpenOnlineLink.tsx'
import { BookIntroCard } from '../components/BookIntroCard.tsx'
import { buttonClass } from '../components/ui.tsx'
import { BackIcon, ChevronIcon } from '../components/Icons.tsx'
import { NotFoundPage } from './NotFoundPage.tsx'
import { BOOKS } from '../lib/books.ts'

export function BibleChapterPage() {
  const { bookId = '', chapter: chapterParam = '1' } = useParams()
  const [search] = useSearchParams()
  const book = getBook(bookId)
  const chapter = parseInt(chapterParam, 10)
  const { book: text, loading, used, fellBack } = useBookText(book?.id)
  const [showIntro, setShowIntro] = useState(false)
  useTitle(book ? formatReference({ book: book.id, startChapter: chapter, endChapter: chapter }) : 'Not found')

  const [hlStart, hlEnd] = (search.get('v') ?? '').split('-').map((n) => parseInt(n, 10))
  const highlight = (v: number) => !!hlStart && v >= hlStart && v <= (hlEnd || hlStart)

  useEffect(() => {
    if (book && chapter >= 1 && chapter <= book.chapters) setLastRead(book.id, chapter)
  }, [book, chapter])

  // Scroll to the highlighted verse once the text has loaded.
  useEffect(() => {
    if (!loading && hlStart) document.getElementById(`v${hlStart}`)?.scrollIntoView({ block: 'center' })
  }, [loading, hlStart])

  if (!book || !(chapter >= 1 && chapter <= book.chapters)) return <NotFoundPage />
  const verses = text?.chapters[chapter - 1] ?? []
  const idx = BOOKS.indexOf(book)
  const prev = chapter > 1 ? `/bible/${book.id}/${chapter - 1}` : idx > 0 ? `/bible/${BOOKS[idx - 1].id}/${BOOKS[idx - 1].chapters}` : null
  const next = chapter < book.chapters ? `/bible/${book.id}/${chapter + 1}` : idx < 65 ? `/bible/${BOOKS[idx + 1].id}/1` : null
  const passage = { book: book.id, startChapter: chapter, endChapter: chapter }

  return (
    <article aria-labelledby="chapter-title">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h1 id="chapter-title" className="font-serif text-3xl font-semibold">
          <Link to={`/bible/${book.id}`} className="hover:underline">
            {book.id === 'PSA' ? 'Psalm' : book.name}
          </Link>{' '}
          {chapter}
        </h1>
        <button
          type="button"
          onClick={() => setShowIntro((s) => !s)}
          aria-expanded={showIntro}
          className="shrink-0 rounded-lg px-2 py-1 text-amber-800 underline underline-offset-2 dark:text-amber-300"
        >
          {showIntro ? 'Hide intro' : 'Book intro'}
        </button>
      </div>
      {showIntro && (
        <div className="mb-6">
          <BookIntroCard bookId={book.id} />
        </div>
      )}

      <div className="mb-4">
        <TranslationPicker />
      </div>

      {loading ? (
        <p className="text-stone-500">Loading…</p>
      ) : verses.length ? (
        <div className="font-serif text-[1.15rem] leading-[1.85]">
          {verses.map((v, i) => (
            <span key={v.v}>
              {v.h && (
                <span className="mb-2 mt-4 block font-sans text-base italic text-stone-600 dark:text-stone-400">{v.h}</span>
              )}
              {v.p && i > 0 && !v.h && <span className="block h-3" aria-hidden="true" />}
              <span
                id={`v${v.v}`}
                className={highlight(v.v) ? 'rounded bg-amber-100 box-decoration-clone px-0.5 dark:bg-amber-900/50' : ''}
              >
                <sup className="mr-1 font-sans text-xs font-semibold text-stone-600 dark:text-stone-400">{v.v}</sup>
                <span className={v.t.includes('\n') ? 'whitespace-pre-line' : ''}>{v.t}</span>{' '}
              </span>
              {v.t.includes('\n') && <span className="block" />}
            </span>
          ))}
        </div>
      ) : (
        <p>This chapter isn't available in {used.abbr}.</p>
      )}

      <p className="mt-6 text-sm text-stone-600 dark:text-stone-400">
        {used.notice}
        {fellBack && ' Your chosen translation does not include this book, so the KJV is shown.'}
      </p>

      <div className="mt-6 grid gap-2">
        <OpenOnlineLink passage={passage} className={buttonClass('secondary', 'w-full')} />
        <Link to={`/study?ref=${encodeURIComponent(formatReference(passage))}`} className={buttonClass('secondary', 'w-full')}>
          Study this chapter
        </Link>
      </div>

      <nav aria-label="Chapters" className="mt-6 grid grid-cols-2 gap-2">
        {prev ? (
          <Link to={prev} className={buttonClass('ghost')}>
            <BackIcon /> Previous
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link to={next} className={buttonClass('ghost')}>
            Next <ChevronIcon />
          </Link>
        )}
      </nav>
    </article>
  )
}
