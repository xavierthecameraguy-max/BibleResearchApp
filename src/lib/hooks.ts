import { useEffect, useState } from 'react'
import { BUNDLED, listImported, loadBook, onTranslationsChanged, type Translation } from './bible.ts'
import type { BookText } from './bibleTypes.ts'
import { useAppState } from './storage.ts'

/** All translations available on this device. */
export function useTranslations(): Translation[] {
  const [imported, setImported] = useState<Translation[]>([])
  useEffect(() => {
    const refresh = () => listImported().then(setImported)
    refresh()
    return onTranslationsChanged(refresh)
  }, [])
  return [...imported, ...BUNDLED]
}

/** The translation chosen in Settings (falls back to KJV if it's gone). */
export function useCurrentTranslation(): Translation {
  const id = useAppState((s) => s.settings.translation)
  const all = useTranslations()
  return all.find((t) => t.id === id) ?? BUNDLED[0]
}

export interface BookState {
  book: BookText | null
  loading: boolean
  /** The translation that was actually used (KJV when the chosen one lacks this book) */
  used: Translation
  fellBack: boolean
}

export function useBookText(bookId: string | undefined): BookState {
  const chosen = useCurrentTranslation()
  const [state, setState] = useState<BookState>({ book: null, loading: true, used: chosen, fellBack: false })
  useEffect(() => {
    if (!bookId) return
    let cancelled = false
    setState((s) => ({ ...s, loading: true }))
    loadBook(chosen.id, bookId).then(async (book) => {
      if (cancelled) return
      if (book || chosen.id === BUNDLED[0].id) {
        setState({ book, loading: false, used: chosen, fellBack: false })
        return
      }
      const fallback = await loadBook(BUNDLED[0].id, bookId)
      if (!cancelled) setState({ book: fallback, loading: false, used: BUNDLED[0], fellBack: true })
    })
    return () => {
      cancelled = true
    }
  }, [bookId, chosen.id]) // eslint-disable-line react-hooks/exhaustive-deps
  return state
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
