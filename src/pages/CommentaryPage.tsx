// Matthew Henry's Concise Commentary (1706, public domain), chapter by chapter.

import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  COMMENTARY_TITLE,
  commentaryParagraphs,
  getBookIntroduction,
  getChapterCommentary,
  sectionLabel,
  sectionPassage,
  type BookIntroduction,
  type ChapterCommentary,
  type CommentarySection,
} from '../lib/data/commentary.ts'
import { BOOKS, getBook } from '../lib/books.ts'
import { formatReference, readerPath } from '../lib/references.ts'
import { useTitle } from '../lib/hooks.ts'
import { PageTitle, buttonClass } from '../components/ui.tsx'
import { BackIcon, ChevronIcon } from '../components/Icons.tsx'

export const COMMENTARY_NOTE =
  'A classic devotional commentary by the Puritan pastor Matthew Henry (1706). Warm and practical, but over 300 years old and written from one Protestant tradition, so some views are dated. Read it alongside a modern study Bible and your church’s teaching.'

/** Commentary text with Bible references linked. */
export function CommentaryText({ item, onNavigate }: { item: { text: string; refs?: CommentarySection['refs'] }; onNavigate?: () => void }) {
  return (
    <div className="space-y-3 leading-relaxed">
      {commentaryParagraphs(item).map((para, i) => (
        <p key={i}>
          {para.map((seg, j) =>
            seg.kind === 'text' ? (
              <span key={j}>{seg.text}</span>
            ) : (
              <Link key={j} to={readerPath(seg.ref)} onClick={onNavigate} className="text-amber-800 underline underline-offset-2 dark:text-amber-300">
                {seg.text}
              </Link>
            ),
          )}
        </p>
      ))}
    </div>
  )
}

export function CommentaryPage() {
  const { book: bookParam = 'JHN', chapter: chParam = '1' } = useParams()
  const book = getBook(bookParam)
  const chapter = Number(chParam)
  const [data, setData] = useState<ChapterCommentary | null | undefined>(undefined)
  const [intro, setIntro] = useState<BookIntroduction | null>(null)
  useTitle(book ? `Commentary: ${formatReference({ book: book.id, startChapter: chapter, endChapter: chapter })}` : 'Commentary')

  useEffect(() => {
    if (!book) return
    let cancelled = false
    setData(undefined)
    getChapterCommentary(book.id, chapter).then((d) => !cancelled && setData(d))
    if (chapter === 1) getBookIntroduction(book.id).then((i) => !cancelled && setIntro(i))
    else setIntro(null)
    return () => {
      cancelled = true
    }
  }, [bookParam, chapter]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!book || !(chapter >= 1 && chapter <= book.chapters)) return <PageTitle>Chapter not found</PageTitle>
  const idx = BOOKS.indexOf(book)
  const prev = chapter > 1 ? `/commentary/${book.id}/${chapter - 1}` : idx > 0 ? `/commentary/${BOOKS[idx - 1].id}/${BOOKS[idx - 1].chapters}` : null
  const next = chapter < book.chapters ? `/commentary/${book.id}/${chapter + 1}` : idx < 65 ? `/commentary/${BOOKS[idx + 1].id}/1` : null
  const ref = formatReference({ book: book.id, startChapter: chapter, endChapter: chapter })

  return (
    <article>
      <p className="text-sm font-semibold uppercase tracking-wide text-stone-600 dark:text-stone-400">{COMMENTARY_TITLE}</p>
      <h1 className="mt-1 font-serif text-3xl font-semibold">{ref}</h1>
      <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">{COMMENTARY_NOTE}</p>
      <Link to={readerPath({ book: book.id, startChapter: chapter, endChapter: chapter })} className={buttonClass('secondary', 'mt-4 w-full')}>
        Read {ref}
      </Link>

      {intro && (
        <section className="mt-6">
          <h2 className="font-serif text-2xl font-semibold">Introduction to {book.name}</h2>
          <div className="mt-2">
            <CommentaryText item={intro} />
          </div>
        </section>
      )}

      {data === undefined ? (
        <p className="mt-6 text-stone-600 dark:text-stone-400">Loading…</p>
      ) : !data ? (
        <p className="mt-6">No commentary for this chapter, or it isn't saved on this device yet.</p>
      ) : (
        <>
          {data.outline.length > 0 && (
            <nav aria-label="Outline" className="mt-6 rounded-2xl bg-stone-100 p-4 dark:bg-stone-900">
              <h2 className="font-semibold">Outline</h2>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                {data.outline.map((o, i) => (
                  <li key={i}>
                    {o.title} <span className="text-sm text-stone-600 dark:text-stone-400">({o.ranges.map(([a, b]) => (a === b ? a : `${a}–${b}`)).join(', ')})</span>
                  </li>
                ))}
              </ol>
            </nav>
          )}
          {data.intro && (
            <div className="mt-6">
              <CommentaryText item={{ text: data.intro, refs: data.introRefs }} />
            </div>
          )}
          {data.sections.map((s, i) => (
            <section key={i} className="mt-6">
              <h2 className="font-serif text-xl font-semibold">
                <Link to={readerPath(sectionPassage(book.id, chapter, s))} className="hover:underline">
                  {sectionLabel(s)}
                </Link>
                {s.title && <span className="block text-base font-normal italic text-stone-600 dark:text-stone-400">{s.title}</span>}
              </h2>
              <div className="mt-2">
                <CommentaryText item={s} />
              </div>
            </section>
          ))}
        </>
      )}

      <nav aria-label="Chapters" className="mt-8 grid grid-cols-2 gap-2">
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
      <p className="mt-6 text-xs text-stone-600 dark:text-stone-400">Matthew Henry’s Concise Commentary (1706), public domain, via CrossWire.</p>
    </article>
  )
}

export function CommentaryIndexPage() {
  useTitle('Commentary')
  return (
    <div>
      <PageTitle sub={COMMENTARY_NOTE}>Commentary</PageTitle>
      {(['OT', 'NT'] as const).map((t) => (
        <section key={t} className="mb-6">
          <h2 className="mb-2 font-serif text-2xl font-semibold">{t === 'OT' ? 'Old Testament' : 'New Testament'}</h2>
          <ul className="grid grid-cols-2 gap-2">
            {BOOKS.filter((b) => b.testament === t).map((b) => (
              <li key={b.id}>
                <Link
                  to={`/commentary/${b.id}/1`}
                  className="flex min-h-12 items-center rounded-xl border border-stone-200 bg-white px-3 hover:bg-stone-50 dark:border-stone-800 dark:bg-stone-900 dark:hover:bg-stone-800"
                >
                  {b.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
