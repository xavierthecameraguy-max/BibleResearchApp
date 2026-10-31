// The Hebrew or Greek words behind a verse, with meanings and grammar.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { explainMorphSync, getVerseWords, loadMorphTable, type OriginalWord } from '../lib/data/original.ts'
import { formatReference } from '../lib/references.ts'
import { Sheet } from './ui.tsx'

export function OriginalWordsSheet(props: { open: boolean; onClose: () => void; book: string; chapter: number; verse: number }) {
  const { open, onClose, book, chapter, verse } = props
  const [words, setWords] = useState<OriginalWord[] | null>(null)
  const [, setMorphReady] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setWords(null)
    loadMorphTable().then((ok) => !cancelled && setMorphReady(ok))
    getVerseWords(book, chapter, verse).then((w) => !cancelled && setWords(w))
    return () => {
      cancelled = true
    }
  }, [open, book, chapter, verse])

  const here = formatReference({ book, startChapter: chapter, startVerse: verse, endChapter: chapter, endVerse: verse })
  const lang = words?.[0]?.language
  return (
    <Sheet open={open} onClose={onClose} title={`${here} in ${lang === 'greek' ? 'Greek' : lang ? 'Hebrew' : 'the original'}`}>
      <div className="max-h-[65vh] overflow-y-auto">
        {!words ? (
          <p className="text-stone-600 dark:text-stone-400">Loading…</p>
        ) : !words.length ? (
          <p>The original-language words for this verse aren't available.</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-stone-600 dark:text-stone-400">
              {lang === 'greek' ? 'Read left to right.' : 'Hebrew is read right to left; the words are listed in order.'} Tap a word to
              study it.
            </p>
            <ol className="space-y-2">
              {words.map((w) => {
                const morph = explainMorphSync(w.morph)
                return (
                  <li key={w.position}>
                    <Link
                      to={`/word/${w.strong}`}
                      onClick={onClose}
                      className="flex items-start gap-3 rounded-xl border border-stone-200 p-3 hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-800"
                    >
                      <span
                        lang={w.language === 'greek' ? 'grc' : 'hbo'}
                        dir={w.language === 'greek' ? 'ltr' : 'rtl'}
                        className="min-w-20 text-right font-serif text-2xl leading-tight"
                      >
                        {w.text}
                      </span>
                      <span className="flex-1">
                        <span className="block font-semibold">{w.gloss || '—'}</span>
                        <span className="block text-sm text-stone-600 dark:text-stone-400">
                          <i>{w.translit}</i> · {w.strong}
                          {w.edition === 'kjv' && ' · only in the KJV’s Greek text'}
                          {w.edition === 'modern' && ' · only in modern Greek texts'}
                        </span>
                        {morph && <span className="block text-xs text-stone-600 dark:text-stone-400">{morph.description}</span>}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ol>
            <p className="mt-4 text-xs text-stone-600 dark:text-stone-400">
              Original-language data from STEP Bible (STEPBible.org), Tyndale House Cambridge, CC BY 4.0.
            </p>
          </>
        )}
      </div>
    </Sheet>
  )
}
