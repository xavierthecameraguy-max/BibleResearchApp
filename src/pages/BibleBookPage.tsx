import { Link, useParams } from 'react-router-dom'
import { getBook } from '../lib/books.ts'
import { useTitle } from '../lib/hooks.ts'
import { PageTitle } from '../components/ui.tsx'
import { BookIntroCard } from '../components/BookIntroCard.tsx'
import { NotFoundPage } from './NotFoundPage.tsx'

export function BibleBookPage() {
  const { bookId = '' } = useParams()
  const book = getBook(bookId)
  useTitle(book?.name ?? 'Not found')
  if (!book) return <NotFoundPage />
  return (
    <div>
      <PageTitle>{book.name}</PageTitle>
      <BookIntroCard bookId={book.id} />
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
