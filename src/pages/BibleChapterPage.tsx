import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ChapterJump } from '../components/ChapterJump.tsx'
import { getBook } from '../lib/books.ts'
import { fallbackMessage, useChapters, useCurrentTranslation, useTitle, useTranslations } from '../lib/hooks.ts'
import { loadChapter } from '../lib/bible.ts'
import { chapterAudioUrl, reportView } from '../lib/online.ts'
import type { Verse } from '../lib/bibleTypes.ts'
import { setLastRead, updateSettings, useAppState, verseKey } from '../lib/storage.ts'
import { speak, speechSupported, stopSpeaking, useSpeaking } from '../lib/speech.ts'
import { HIGHLIGHT_STYLES, VerseActions } from '../components/VerseActions.tsx'
import { NotesIcon } from '../components/Icons.tsx'
import { TextCredit } from '../components/TextCredit.tsx'
import { CrossRefSheet } from '../components/CrossRefSheet.tsx'
import { OriginalWordsSheet } from '../components/OriginalWordsSheet.tsx'
import { DictionarySheet } from '../components/DictionarySheet.tsx'
import { TopicsSheet } from '../components/TopicsSheet.tsx'
import { CommentarySheet } from '../components/CommentarySheet.tsx'
import { ChapterEntities } from '../components/ChapterEntities.tsx'
import { InterlinearRow } from '../components/Interlinear.tsx'
import { getChapterWords, type OriginalWord } from '../lib/data/original.ts'
import { Chip } from '../components/VerseActions.tsx'
import { BUNDLED } from '../lib/bible.ts'
import { formatReference } from '../lib/references.ts'
import { TranslationPicker } from '../components/TranslationPicker.tsx'
import { OpenOnlineLink } from '../components/OpenOnlineLink.tsx'
import { BookIntroCard } from '../components/BookIntroCard.tsx'
import { Sheet, buttonClass } from '../components/ui.tsx'
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
  const [panel, setPanel] = useState<null | 'xrefs' | 'words' | 'dict' | 'topics' | 'comm'>(null)
  const [jumpOpen, setJumpOpen] = useState(false)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [audioSrc, setAudioSrc] = useState<string | null>(null)
  const [interlinear, setInterlinear] = useState(() => sessionStorage.getItem('interlinear') === '1')
  // Parallel reading: a second translation under each verse.
  const allTranslations = useTranslations()
  const [parallelId, setParallelId] = useState(() => sessionStorage.getItem('parallel') ?? '')
  const parallelT = allTranslations.find((t) => t.id === parallelId)
  const [parallel, setParallel] = useState<{ verses: Verse[]; notice?: string } | null>(null)
  useEffect(() => {
    try {
      sessionStorage.setItem('parallel', parallelId)
    } catch {
      // ignore
    }
    if (!parallelT || !book) {
      setParallel(null)
      return
    }
    let cancelled = false
    loadChapter(parallelT, book.id, chapter).then((r) => {
      if (cancelled) return
      setParallel(typeof r === 'string' ? { verses: [] } : r)
      if (typeof r !== 'string') reportView(r.fumsToken)
    })
    return () => {
      cancelled = true
    }
  }, [parallelT?.id, book, chapter]) // eslint-disable-line react-hooks/exhaustive-deps
  const [orig, setOrig] = useState<OriginalWord[][] | null>(null)
  useEffect(() => {
    try {
      sessionStorage.setItem('interlinear', interlinear ? '1' : '0')
    } catch {
      // ignore
    }
    if (!interlinear || !book) return
    let cancelled = false
    setOrig(null)
    getChapterWords(book.id, chapter).then((w) => !cancelled && setOrig(w))
    return () => {
      cancelled = true
    }
  }, [interlinear, book, chapter])
  const navigate = useNavigate()
  // Swipe left/right to change chapter (ignored while verses are selected).
  const touch = useRef<{ x: number; y: number; t: number } | null>(null)
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touch.current = { x: t.clientX, y: t.clientY, t: Date.now() }
  }
  const settings = useAppState((s) => s.settings)
  const leading = { normal: 'leading-[1.6]', relaxed: 'leading-[1.85]', loose: 'leading-[2.1]' }[settings.lineSpacing]
  const fontClass = settings.readerFont === 'sans' ? 'font-sans' : 'font-serif'
  useTitle(book ? formatReference({ book: book.id, startChapter: chapter, endChapter: chapter }) : 'Not found')

  const [hlStart, hlEnd] = (search.get('v') ?? '').split('-').map((n) => parseInt(n, 10))
  const highlight = (v: number) => !!hlStart && v >= hlStart && v <= (hlEnd || hlStart)

  useEffect(() => {
    if (book && chapter >= 1 && chapter <= book.chapters) setLastRead(book.id, chapter)
    setSelected([])
    stopSpeaking()
    setAudioSrc(null)
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

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current
    touch.current = null
    if (!start || selected.length) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 2 && Date.now() - start.t < 600) {
      if (dx < 0 && next) navigate(next)
      if (dx > 0 && prev) navigate(prev)
    }
  }

  return (
    <article aria-labelledby="chapter-title" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <ChapterJump open={jumpOpen} onClose={() => setJumpOpen(false)} currentBook={book.id} />
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h1 id="chapter-title" className="font-serif text-3xl font-semibold">
          <button
            type="button"
            onClick={() => setJumpOpen(true)}
            className="inline-flex items-baseline gap-1 rounded-lg text-left hover:underline"
            aria-label={`${book.id === 'PSA' ? 'Psalm' : book.name} ${chapter}. Choose another book or chapter`}
          >
            {book.id === 'PSA' ? 'Psalm' : book.name} {chapter}
            <span aria-hidden="true" className="text-xl text-stone-500">
              ▾
            </span>
          </button>
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

      <div className="mb-4 flex items-end gap-2">
        <div className="flex-1">
          <TranslationPicker compact />
        </div>
        {used.hasAudio && !loading ? (
          <button
            type="button"
            className={buttonClass('secondary', 'min-h-11 px-3 py-2 text-[0.95rem]')}
            onClick={async () => {
              if (audioSrc) {
                setAudioSrc(null)
                return
              }
              const src = await chapterAudioUrl(used, book.id, chapter)
              if (src) setAudioSrc(src)
              else if (speechSupported) speak(verses.map((v) => v.t))
            }}
            aria-pressed={!!audioSrc}
          >
            {audioSrc ? 'Close audio' : 'Listen'}
          </button>
        ) : (
          speechSupported &&
          !loading &&
          verses.length > 0 &&
          !used.noSpeech && (
            <button
              type="button"
              className={buttonClass('secondary', 'min-h-11 px-3 py-2 text-[0.95rem]')}
              onClick={() => (speaking ? stopSpeaking() : speak(verses.map((v) => v.t)))}
              aria-pressed={speaking}
            >
              {speaking ? 'Stop' : 'Listen'}
            </button>
          )
        )}
        <button
          type="button"
          className={buttonClass('secondary', 'min-h-11 px-3 py-2 font-serif text-lg')}
          onClick={() => setOptionsOpen(true)}
          aria-label="Reading options"
        >
          Aa
        </button>
      </div>
      {audioSrc && (
        <div className="mb-4">
          <audio src={audioSrc} controls autoPlay className="w-full" aria-label={`Audio of ${book.name} ${chapter}`} />
          <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">Official {used.abbr} audio recording.</p>
        </div>
      )}
      <Sheet open={optionsOpen} onClose={() => setOptionsOpen(false)} title="Reading options">
        <div className="max-h-[65vh] space-y-5 overflow-y-auto">
          <label className="block">
            <span className="font-semibold">Parallel translation</span>
            <span className="block text-sm text-stone-600 dark:text-stone-400">Shown in smaller type under each verse.</span>
            <select
              value={parallelId}
              onChange={(e) => setParallelId(e.target.value)}
              className="mt-2 min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base dark:border-stone-700 dark:bg-stone-950"
            >
              <option value="">None</option>
              {allTranslations
                .filter((t) => t.id !== used.id)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.abbr}: {t.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="flex min-h-12 items-center justify-between gap-3">
            <span>
              <span className="block font-semibold">{book.testament === 'OT' ? 'Hebrew' : 'Greek'} under each verse</span>
              <span className="block text-sm text-stone-600 dark:text-stone-400">Original words with English glosses (interlinear).</span>
            </span>
            <input type="checkbox" className="size-6 accent-amber-700" checked={interlinear} onChange={(e) => setInterlinear(e.target.checked)} />
          </label>
          <label className="flex min-h-12 items-center justify-between gap-3">
            <span className="font-semibold">Verse numbers</span>
            <input
              type="checkbox"
              className="size-6 accent-amber-700"
              checked={settings.showVerseNumbers}
              onChange={(e) => updateSettings({ showVerseNumbers: e.target.checked })}
            />
          </label>
          <label className="flex min-h-12 items-center justify-between gap-3">
            <span className="font-semibold">Section headings</span>
            <input
              type="checkbox"
              className="size-6 accent-amber-700"
              checked={settings.showHeadings}
              onChange={(e) => updateSettings({ showHeadings: e.target.checked })}
            />
          </label>
          <div>
            <span className="font-semibold">Font</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(
                [
                  ['serif', 'Classic'],
                  ['sans', 'Modern'],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={settings.readerFont === v}
                  onClick={() => updateSettings({ readerFont: v })}
                  className={`min-h-11 rounded-xl border-2 ${v === 'serif' ? 'font-serif' : 'font-sans'} ${
                    settings.readerFont === v ? 'border-amber-700 dark:border-amber-300' : 'border-stone-300 dark:border-stone-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="font-semibold">Text size</span>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(
                [
                  ['md', 'A'],
                  ['lg', 'A+'],
                  ['xl', 'A++'],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={settings.textSize === v}
                  aria-label={`Text size ${label}`}
                  onClick={() => updateSettings({ textSize: v })}
                  className={`min-h-11 rounded-xl border-2 ${
                    settings.textSize === v ? 'border-amber-700 dark:border-amber-300' : 'border-stone-300 dark:border-stone-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {!allTranslations.some((t) => t.abbr === 'NKJV') && (
            <Link to="/settings#licensed" className="block font-semibold text-amber-800 underline dark:text-amber-300" onClick={() => setOptionsOpen(false)}>
              Set up the NKJV (free)
            </Link>
          )}
          <Link to="/settings" className="block text-sm underline" onClick={() => setOptionsOpen(false)}>
            More settings (theme, line spacing, translations)
          </Link>
        </div>
      </Sheet>
      {Object.keys(highlights).length < 3 && (
        <p className="mb-3 text-sm text-stone-600 dark:text-stone-400">
          Tap a verse for highlights, notes, cross-references and more. Swipe to change chapter.
        </p>
      )}

      {loading ? (
        <p className="text-stone-500">Loading…</p>
      ) : verses.length ? (
        <div className={`${fontClass} text-[1.15rem] ${leading}`}>
          {verses.map((v, i) => (
            <span key={v.v}>
              {v.h && settings.showHeadings && (
                <span className="mb-2 mt-4 block font-sans text-base italic text-stone-600 dark:text-stone-400">{v.h}</span>
              )}
              {v.p && i > 0 && !v.h && <span className="block h-3" aria-hidden="true" />}
              <VerseButton
                id={`v${v.v}`}
                num={v.v}
                showNumber={settings.showVerseNumbers}
                fontClass={fontClass}
                text={v.t}
                selected={selected.includes(v.v)}
                linked={highlight(v.v)}
                color={highlights[verseKey(book.id, chapter, v.v)]}
                hasNote={!!verseNotes[verseKey(book.id, chapter, v.v)]}
                onToggle={() => setSelected((s) => (s.includes(v.v) ? s.filter((x) => x !== v.v) : [...s, v.v]))}
              />{' '}
              {v.t.includes('\n') && !interlinear && <span className="block" />}
              {interlinear && <InterlinearRow words={orig?.[v.v]} />}
              {parallelT && parallel && (
                <span className="mb-3 mt-1 block border-l-4 border-stone-300 pl-3 font-sans text-[0.95rem] leading-relaxed text-stone-700 dark:border-stone-700 dark:text-stone-300">
                  <span className="mr-1 text-xs font-semibold text-stone-600 dark:text-stone-400">{parallelT.abbr}</span>
                  {parallel.verses.find((x) => x.v === v.v)?.t.replace(/\n/g, ' ') ?? '—'}
                </span>
              )}
            </span>
          ))}
        </div>
      ) : (
        <p>This chapter isn't available in {used.abbr}.</p>
      )}

      <p className="mt-6 text-sm text-stone-600 dark:text-stone-400">
        <TextCredit used={used} notice={notice} />
        {fellBack && <span className="mt-1 block font-semibold">{fallbackMessage(chosen.abbr, fellBack)}</span>}
      </p>

      {parallelT && parallel && parallelT.kind === 'online' && (
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
          <TextCredit used={parallelT} notice={parallel.notice ?? parallelT.notice} />
        </p>
      )}
      <ChapterEntities book={book.id} chapter={chapter} />

      <div className="mt-6 grid gap-2">
        <OpenOnlineLink passage={passage} className={buttonClass('secondary', 'w-full')} />
        <Link to={`/study/passage?ref=${encodeURIComponent(formatReference(passage))}`} className={buttonClass('secondary', 'w-full')}>
          Study this chapter
        </Link>
        <Link to={`/commentary/${book.id}/${chapter}`} className={buttonClass('secondary', 'w-full')}>
          Commentary on this chapter
        </Link>
      </div>

      {selected.length > 0 && (
        <VerseActions
          book={book.id}
          chapter={chapter}
          selected={selected}
          verses={verses}
          translationAbbr={used.abbr}
          noSpeech={used.noSpeech}
          onClear={() => setSelected([])}
          extra={
            <>
              <Chip onClick={() => setPanel('xrefs')}>
                Cross-refs{selected.length > 1 ? ` (v${Math.min(...selected)})` : ''}
              </Chip>
              <Chip onClick={() => setPanel('words')}>{book.testament === 'OT' ? 'Hebrew' : 'Greek'}</Chip>
              <Chip onClick={() => setPanel('comm')}>Commentary</Chip>
              <Chip onClick={() => setPanel('topics')}>Topics</Chip>
              <Chip onClick={() => setPanel('dict')}>Dictionary</Chip>
            </>
          }
        />
      )}
      {selected.length > 0 && (
        <CommentarySheet
          open={panel === 'comm'}
          onClose={() => setPanel(null)}
          book={book.id}
          chapter={chapter}
          verse={Math.min(...selected)}
        />
      )}
      {selected.length > 0 && (
        <TopicsSheet
          open={panel === 'topics'}
          onClose={() => setPanel(null)}
          book={book.id}
          chapter={chapter}
          verse={Math.min(...selected)}
        />
      )}
      {selected.length > 0 && (
        <DictionarySheet
          open={panel === 'dict'}
          onClose={() => setPanel(null)}
          book={book.id}
          chapter={chapter}
          verse={Math.min(...selected)}
        />
      )}
      {selected.length > 0 && (
        <OriginalWordsSheet
          open={panel === 'words'}
          onClose={() => setPanel(null)}
          book={book.id}
          chapter={chapter}
          verse={Math.min(...selected)}
        />
      )}
      {selected.length > 0 && (
        <CrossRefSheet
          open={panel === 'xrefs'}
          onClose={() => setPanel(null)}
          book={book.id}
          chapter={chapter}
          verse={Math.min(...selected)}
          previewIn={used.kind === 'online' ? (BUNDLED.find((t) => t.id === 'bsb') ?? BUNDLED[0]) : used}
        />
      )}

      <nav aria-label="Chapters" className={`mt-6 grid grid-cols-2 gap-2 ${selected.length ? 'pb-72' : ''}`}>
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
  showNumber: boolean
  fontClass: string
  text: string
  selected: boolean
  linked: boolean
  color?: keyof typeof HIGHLIGHT_STYLES
  hasNote: boolean
  onToggle: () => void
}) {
  const { id, num, showNumber, fontClass, text, selected, linked, color, hasNote, onToggle } = props
  const bg = color ? HIGHLIGHT_STYLES[color].bg : linked ? 'bg-amber-100 dark:bg-amber-900/50' : ''
  return (
    <button
      type="button"
      id={id}
      onClick={onToggle}
      aria-pressed={selected}
      className={`inline cursor-pointer rounded box-decoration-clone px-0.5 text-left ${fontClass} ${bg} ${
        selected ? 'underline decoration-amber-600 decoration-dashed decoration-2 underline-offset-[6px] dark:decoration-amber-300' : ''
      }`}
    >
      {showNumber ? (
        <sup className="mr-1 font-sans text-xs font-semibold text-stone-600 dark:text-stone-400">{num}</sup>
      ) : (
        <span className="sr-only">Verse {num}. </span>
      )}
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
