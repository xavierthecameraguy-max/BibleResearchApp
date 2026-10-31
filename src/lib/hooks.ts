import { useEffect, useState } from 'react'
import { listOnline, reportView } from './online.ts'
import {
  BUNDLED,
  listImported,
  listPrivate,
  loadChapter,
  onTranslationsChanged,
  type ChapterFailure,
  type Translation,
} from './bible.ts'
import type { Verse } from './bibleTypes.ts'
import { useAppState } from './storage.ts'

/** All translations available on this device. */
export function useTranslations(): Translation[] {
  const [imported, setImported] = useState<Translation[]>([])
  const [priv, setPriv] = useState<Translation[]>([])
  const [online, setOnline] = useState<Translation[]>([])
  useEffect(() => {
    listPrivate().then(setPriv)
    listOnline().then(setOnline)
    const refresh = () => listImported().then(setImported)
    refresh()
    return onTranslationsChanged(refresh)
  }, [])
  return [...online, ...priv, ...imported, ...BUNDLED]
}

/**
 * The translation chosen in Settings. "auto" (the default) means the NKJV if
 * it's available (online or built in), then any private translation, then
 * the KJV.
 */
export function useCurrentTranslation(): Translation {
  const id = useAppState((s) => s.settings.translation)
  const all = useTranslations()
  return (
    all.find((t) => t.id === id) ??
    all.find((t) => t.abbr === 'NKJV') ??
    all.find((t) => t.kind === 'private') ??
    BUNDLED[0]
  )
}

export interface ChapterState {
  verses: Verse[]
  loading: boolean
  /** The translation actually shown (the KJV when the chosen one can't be loaded) */
  used: Translation
  /** Why we fell back to the KJV, if we did */
  fellBack: ChapterFailure | null
  notice: string
}

/** Load chapters [from..to] of a book in the chosen translation, falling back to the KJV. */
export function useChapters(bookId: string | undefined, from: number, to: number = from): ChapterState & { chapters: Verse[][] } {
  const chosen = useCurrentTranslation()
  const [state, setState] = useState<ChapterState & { chapters: Verse[][] }>({
    verses: [],
    chapters: [],
    loading: true,
    used: chosen,
    fellBack: null,
    notice: chosen.notice,
  })
  useEffect(() => {
    if (!bookId) return
    let cancelled = false
    setState((s) => ({ ...s, loading: true }))
    const nums = Array.from({ length: Math.min(to - from + 1, 6) }, (_, i) => from + i)
    const load = (t: Translation) => Promise.all(nums.map((c) => loadChapter(t, bookId, c)))
    ;(async () => {
      let used = chosen
      let results = await load(chosen)
      let fellBack: ChapterFailure | null = null
      const failure = results.find((r): r is ChapterFailure => typeof r === 'string')
      if (failure && chosen.id !== BUNDLED[0].id) {
        fellBack = failure
        used = BUNDLED[0]
        results = await load(used)
      }
      if (cancelled) return
      const chapters = results.map((r) => (typeof r === 'string' ? [] : r.verses))
      const notice = results.map((r) => (typeof r === 'string' ? undefined : r.notice)).find(Boolean) ?? used.notice
      setState({ chapters, verses: chapters[0] ?? [], loading: false, used, fellBack, notice })
      // API.Bible asks apps to report each time its text is shown.
      for (const r of results) if (typeof r !== 'string') reportView(r.fumsToken)
    })()
    return () => {
      cancelled = true
    }
  }, [bookId, from, to, chosen.id]) // eslint-disable-line react-hooks/exhaustive-deps
  return state
}

/** Plain-English reason shown when the chosen translation couldn't be used. */
export function fallbackMessage(chosen: string, reason: ChapterFailure | null): string {
  if (!reason) return ''
  if (reason === 'offline') return `${chosen} needs an internet connection, so the KJV is shown.`
  if (reason === 'missing') return `${chosen} doesn't include this passage, so the KJV is shown.`
  return `${chosen} couldn't be loaded right now, so the KJV is shown.`
}

/** Set the page title for browser tabs and screen readers. */
export function useTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · Foundations` : 'Foundations'
  }, [title])
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}
