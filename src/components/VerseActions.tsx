// The bar that appears when you tap verses in the reader: highlight,
// bookmark, note, copy, compare, study and listen.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Verse } from '../lib/bibleTypes.ts'
import { formatReference, type Passage } from '../lib/references.ts'
import {
  addMemoryCard,
  removeMemoryCard,
  setHighlight,
  setVerseNote,
  toggleBookmark,
  useAppState,
  verseKey,
  type HighlightColor,
} from '../lib/storage.ts'
import { speak, speechSupported } from '../lib/speech.ts'
import { Sheet, buttonClass } from './ui.tsx'
import { CloseIcon } from './Icons.tsx'

export const HIGHLIGHT_STYLES: Record<HighlightColor, { bg: string; swatch: string; label: string }> = {
  yellow: { bg: 'bg-yellow-200/80 dark:bg-yellow-500/30', swatch: 'bg-yellow-300', label: 'Yellow' },
  green: { bg: 'bg-green-200/80 dark:bg-green-500/30', swatch: 'bg-green-400', label: 'Green' },
  blue: { bg: 'bg-sky-200/80 dark:bg-sky-500/30', swatch: 'bg-sky-400', label: 'Blue' },
  pink: { bg: 'bg-pink-200/80 dark:bg-pink-500/30', swatch: 'bg-pink-400', label: 'Pink' },
  purple: { bg: 'bg-violet-200/80 dark:bg-violet-500/30', swatch: 'bg-violet-400', label: 'Purple' },
}

/** "JHN.3.16" or "JHN.3.16-18" for a run of selected verses */
export function rangeKey(book: string, chapter: number, nums: number[]): string {
  const sorted = [...nums].sort((a, b) => a - b)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  return `${book}.${chapter}.${first}${last !== first ? '-' + last : ''}`
}

export function passageFromKey(key: string): Passage | null {
  const m = key.match(/^([1-3A-Z]{3})\.(\d+)\.(\d+)(?:-(\d+))?$/)
  if (!m) return null
  const c = Number(m[2])
  return { book: m[1], startChapter: c, endChapter: c, startVerse: Number(m[3]), endVerse: Number(m[4] ?? m[3]) }
}

interface Props {
  book: string
  chapter: number
  selected: number[]
  verses: Verse[]
  translationAbbr: string
  /** The translation's terms don't allow read-aloud */
  noSpeech?: boolean
  onClear: () => void
  /** Extra actions (cross-references, original words) added by the reader */
  extra?: React.ReactNode
}

export function VerseActions({ book, chapter, selected, verses, translationAbbr, noSpeech, onClear, extra }: Props) {
  useEffect(() => {
    document.documentElement.classList.add('verse-bar-open')
    return () => document.documentElement.classList.remove('verse-bar-open')
  }, [])
  const [noteOpen, setNoteOpen] = useState(false)
  const [status, setStatus] = useState('')
  const sorted = [...selected].sort((a, b) => a - b)
  const keys = sorted.map((v) => verseKey(book, chapter, v))
  const highlights = useAppState((s) => s.highlights)
  const bookmarks = useAppState((s) => s.bookmarks)
  const memory = useAppState((s) => s.memory)
  const notes = useAppState((s) => s.verseNotes)
  // Selected verses grouped into unbroken runs: 16, 17, 18 and 21 → [16–18], [21].
  const runs: number[][] = []
  for (const n of sorted) {
    const last = runs[runs.length - 1]
    if (last && n === last[last.length - 1] + 1) last.push(n)
    else runs.push([n])
  }
  const runKeys = runs.map((r) => rangeKey(book, chapter, r))
  const key = rangeKey(book, chapter, sorted) // whole span, for Compare and Study
  const passage = passageFromKey(key)!
  const bookName = formatReference({ ...passage, startVerse: undefined, endVerse: undefined })
  const ref =
    runs.length === 1
      ? formatReference(passageFromKey(runKeys[0])!)
      : `${bookName}:${runs.map((r) => (r.length > 1 ? `${r[0]}–${r[r.length - 1]}` : `${r[0]}`)).join(', ')}`
  const bookmarked = runKeys.every((k) => bookmarks.some((b) => b.key === k))
  const memorizing = runKeys.every((k) => memory[k])
  useEffect(() => setStatus(''), [selected.length])
  const noteKey = keys[0]
  const [draft, setDraft] = useState(notes[noteKey]?.text ?? '')
  const runText = (r: number[]) => r.map((n) => verses.find((v) => v.v === n)?.t ?? '').join(' ').replace(/\n/g, ' ')
  const allSameColor = keys.every((k) => highlights[k] && highlights[k] === highlights[keys[0]]) ? highlights[keys[0]] : undefined

  const copy = async () => {
    // Licensed translations limit copying to small amounts; 100 verses is the strictest limit we follow.
    if (sorted.length > 100) {
      setStatus('Select 100 verses or fewer to copy')
      return
    }
    try {
      // Each unbroken run is quoted with its own reference, so nothing is silently left out.
      const quote = runs.map((r, i) => `“${runText(r)}” ${formatReference(passageFromKey(runKeys[i])!)}`).join('\n')
      await navigator.clipboard.writeText(`${quote}\n(${translationAbbr})`)
      setStatus('Copied')
    } catch {
      setStatus('Copy is not available here')
    }
  }

  return (
    <div
      data-verse-bar
      role="region"
      aria-label={`Actions for ${ref}`}
      style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom))' }}
      className="fixed inset-x-0 z-30 border-t border-stone-200 bg-white/98 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur dark:border-stone-800 dark:bg-stone-900/98"
    >
      <div className="mx-auto max-w-2xl px-4 py-3">
        <div className="flex items-center gap-2">
          <p className="flex-1 font-semibold">
            {ref} <span className="font-normal text-stone-600 dark:text-stone-400">· {translationAbbr}</span>
          </p>
          <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
            {status}
          </p>
          <button type="button" onClick={onClear} className="-mr-2 rounded-full p-2 hover:bg-stone-100 dark:hover:bg-stone-800" aria-label="Clear selection">
            <CloseIcon />
          </button>
        </div>

        <div className="mt-2 flex items-center gap-2" role="group" aria-label="Highlight colour">
          {(Object.keys(HIGHLIGHT_STYLES) as HighlightColor[]).map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Highlight ${HIGHLIGHT_STYLES[c].label}`}
              aria-pressed={allSameColor === c}
              onClick={() => setHighlight(keys, allSameColor === c ? null : c)}
              className={`size-11 rounded-full border-2 ${HIGHLIGHT_STYLES[c].swatch} ${
                allSameColor === c ? 'border-stone-900 dark:border-white' : 'border-transparent'
              }`}
            />
          ))}
          <button
            type="button"
            onClick={() => setHighlight(keys, null)}
            className="ml-1 min-h-11 rounded-full px-3 text-sm text-stone-700 underline underline-offset-2 dark:text-stone-300"
          >
            Remove
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" role="group" aria-label="Mark this verse">
          <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-stone-600 dark:text-stone-400">Mark</span>
          <Chip
            onClick={() => {
              for (const k of runKeys) if (bookmarked || !bookmarks.some((b) => b.key === k)) toggleBookmark(k)
            }}
            pressed={bookmarked}
          >
            {bookmarked ? 'Bookmarked' : 'Bookmark'}
          </Chip>
          <Chip
            onClick={() => {
              setDraft(notes[noteKey]?.text ?? '')
              setNoteOpen(true)
            }}
          >
            {notes[noteKey] ? 'Edit note' : 'Note'}
          </Chip>
          <Chip
            onClick={() => {
              if (memorizing) {
                runKeys.forEach(removeMemoryCard)
                setStatus('Removed from memory verses')
                return
              }
              runKeys.forEach(addMemoryCard)
              setStatus('Added to memory verses')
            }}
            pressed={memorizing}
          >
            {memorizing ? 'Memorizing' : 'Memorize'}
          </Chip>
          <Chip onClick={copy}>Copy</Chip>
          {speechSupported && !noSpeech && (
            <Chip onClick={() => speak(sorted.map((n) => verses.find((v) => v.v === n)?.t ?? ''))}>Listen</Chip>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" role="group" aria-label="Study this verse">
          <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-stone-600 dark:text-stone-400">Study</span>
          {extra}
          <ChipLink to={`/compare?ref=${encodeURIComponent(key)}`}>Compare</ChipLink>
          <ChipLink to={`/study/passage?ref=${encodeURIComponent(ref)}`}>Study passage</ChipLink>
        </div>
      </div>

      <Sheet open={noteOpen} onClose={() => setNoteOpen(false)} title={`Note on ${formatReference(passageFromKey(noteKey)!)}`}>
        <label htmlFor="verse-note" className="sr-only">
          Your note
        </label>
        <textarea
          id="verse-note"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={6}
          placeholder="What stands out to you?"
          className="w-full rounded-xl border border-stone-300 bg-white p-4 text-base leading-relaxed dark:border-stone-700 dark:bg-stone-950"
        />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            className={buttonClass('primary')}
            onClick={() => {
              setVerseNote(noteKey, draft)
              setNoteOpen(false)
              setStatus(draft.trim() ? 'Note saved' : 'Note removed')
            }}
          >
            Save
          </button>
          <button type="button" className={buttonClass('ghost')} onClick={() => setNoteOpen(false)}>
            Cancel
          </button>
        </div>
      </Sheet>
    </div>
  )
}

const CHIP =
  'inline-flex min-h-11 shrink-0 items-center rounded-full border border-stone-300 px-4 text-[0.95rem] font-medium whitespace-nowrap hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800'

export function Chip({ children, onClick, pressed }: { children: React.ReactNode; onClick: () => void; pressed?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={`${CHIP} ${pressed ? 'border-amber-700 bg-amber-50 dark:border-amber-300 dark:bg-amber-950/40' : ''}`}
    >
      {children}
    </button>
  )
}

export function ChipLink({ children, to }: { children: React.ReactNode; to: string }) {
  return (
    <Link to={to} className={CHIP}>
      {children}
    </Link>
  )
}
