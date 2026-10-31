import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getBook } from '../lib/books.ts'
import { fallbackMessage, useChapters, useCurrentTranslation, useTitle } from '../lib/hooks.ts'
import { setLastRead, useAppState, verseKey } from '../lib/storage.ts'
import { speak, speechSupported, stopSpeaking, useSpeaking } from '../lib/speech.ts'
import { HIGHLIGHT_STYLES, VerseActions } from '../components/VerseActions.tsx'
import { NotesIcon } from '../components/Icons.tsx'
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
  const chosen = useCurrentTranslation()
  const { verses, loading, used, fellBack, notice } = useChapters(book?.id, chapter)
  const [showIntro, setShowIntro] = useState(false)
  const [selected, setSelected] = useState<number[]>([])
  const highlights = useAppState((s) => s.highlights)
  const verseNotes = useAppState((s) => s.verseNotes)
  const speaking = useSpeaking()
  useTitle(book ? formatReference({ book: book.id, startChapter: chapter, endChapter: chapter }) : 'Not found')

  const [hlStart, hlEnd] = (search.get('v') ?? '').split('-').map((n) => parseInt(n, 10))
  const highlight = (v: number) => !!hlStart && v >= hlStart && v <= (hlEnd || hlStart)

  useEffect(() => {
    if (book && chapter >= 1 && chapter <= book.chapters) setLastRead(book.id, chapter)
    setSelected([])
    stopSpeaking()
  }, [book, chapter])

  // Scroll to the highlighted verse once the text has loaded.
  useEffect(() => {
    if (!loading && hlStart) document.getElementById(`v${hlStart}`)?.scrollIntoView({ block: 'center' })
  }, [loading, hlStart])

  if (!book || !(chapter >= 1 && chapter <= book.chapters)) return <NotFoundPage />
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

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <TranslationPicker />
        {speechSupported && !loading && verses.length > 0 && (
          <button
            type="button"
            className={buttonClass('secondary', 'min-h-11 px-4 py-2 text-[0.95rem]')}
            onClick={() => (speaking ? stopSpeaking() : speak(verses.map((v) => v.t)))}
            aria-pressed={speaking}
          >
            {speaking ? 'Stop' : 'Listen'}
          </button>
        )}
      </div>
      <p className="mb-3 text-sm text-stone-600 dark:text-stone-400">Tap a verse to highlight, bookmark, add a note or compare.</p>

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
              <VerseButton
                id={`v${v.v}`}
                num={v.v}
                text={v.t}
                selected={selected.includes(v.v)}
                linked={highlight(v.v)}
                color={highlights[verseKey(book.id, chapter, v.v)]}
                hasNote={!!verseNotes[verseKey(book.id, chapter, v.v)]}
                onToggle={() => setSelected((s) => (s.includes(v.v) ? s.filter((x) => x !== v.v) : [...s, v.v]))}
              />{' '}
              {v.t.includes('\n') && <span className="block" />}
            </span>
          ))}
        </div>
      ) : (
        <p>This chapter isn't available in {used.abbr}.</p>
      )}

      <p className="mt-6 text-sm text-stone-600 dark:text-stone-400">
        {notice}
        {fellBack && <span className="mt-1 block font-semibold">{fallbackMessage(chosen.abbr, fellBack)}</span>}
      </p>

      <div className="mt-6 grid gap-2">
        <OpenOnlineLink passage={passage} className={buttonClass('secondary', 'w-full')} />
        <Link to={`/study?ref=${encodeURIComponent(formatReference(passage))}`} className={buttonClass('secondary', 'w-full')}>
          Study this chapter
        </Link>
      </div>

      {selected.length > 0 && (
        <VerseActions
          book={book.id}
          chapter={chapter}
          selected={selected}
          verses={verses}
          translationAbbr={used.abbr}
          onClear={() => setSelected([])}
        />
      )}

      <nav aria-label="Chapters" className={`mt-6 grid grid-cols-2 gap-2 ${selected.length ? 'pb-56' : ''}`}>
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

function VerseButton(props: {
  id: string
  num: number
  text: string
  selected: boolean
  linked: boolean
  color?: keyof typeof HIGHLIGHT_STYLES
  hasNote: boolean
  onToggle: () => void
}) {
  const { id, num, text, selected, linked, color, hasNote, onToggle } = props
  const bg = color ? HIGHLIGHT_STYLES[color].bg : linked ? 'bg-amber-100 dark:bg-amber-900/50' : ''
  return (
    <button
      type="button"
      id={id}
      onClick={onToggle}
      aria-pressed={selected}
      className={`inline cursor-pointer rounded box-decoration-clone px-0.5 text-left font-serif ${bg} ${
        selected ? 'underline decoration-amber-600 decoration-dashed decoration-2 underline-offset-[6px] dark:decoration-amber-300' : ''
      }`}
    >
      <sup className="mr-1 font-sans text-xs font-semibold text-stone-600 dark:text-stone-400">{num}</sup>
      <span className={text.includes('\n') ? 'whitespace-pre-line' : ''}>{text}</span>
      {hasNote && (
        <>
          <NotesIcon width="0.9em" height="0.9em" className="ml-1 inline align-baseline text-amber-700 dark:text-amber-300" />
          <span className="sr-only"> (has a note)</span>
        </>
      )}
    </button>
  )
}
