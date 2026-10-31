// Bible translations:
// - bundled: public-domain Bibles shipped with the app (offline)
// - private: built in from your own file with `npm run add-bible` (offline)
// - imported: loaded from a file inside the app, stored on this device (offline)
// - online: licensed translations (NKJV, ESV, NLT…) fetched a chapter at a
//   time through the app's own server proxy, following each provider's terms

import { get, set, del } from 'idb-keyval'
import type { BookText, Verse } from './bibleTypes.ts'
import type { BookMap } from './bibleImport.ts'

export interface Translation {
  id: string
  /** Folder under /bible/ holding the book files (bundled and private translations) */
  dir?: string
  abbr: string
  name: string
  kind: 'bundled' | 'private' | 'imported' | 'online'
  /** online: the service that provides it */
  provider?: string
  /** online: how long a fetched chapter may be kept, in seconds (0 = this session only) */
  cacheSeconds?: number
  /** Shown under the text */
  notice: string
  /** Books available (imported translations may be partial) */
  books?: string[]
  importedAt?: string
}

export const BUNDLED: Translation[] = [
  {
    id: 'kjv',
    abbr: 'KJV',
    name: 'King James Version',
    kind: 'bundled',
    notice: 'King James Version (1769 standard text). Public domain outside the UK. Source: eBible.org.',
  },
  {
    id: 'web',
    abbr: 'WEB',
    name: 'World English Bible',
    kind: 'bundled',
    notice: 'World English Bible. Public domain. Source: eBible.org.',
  },
]

/**
 * Translations built into this copy of the app from your own files with
 * `npm run add-bible` (see README). They live in public/bible/private/,
 * which is never committed to Git.
 */
let privateList: Promise<Translation[]> | null = null
export function listPrivate(): Promise<Translation[]> {
  privateList ??= fetch('/bible/private/translations.json')
    .then((r) => (r.ok ? r.json() : []))
    .then((list: Omit<Translation, 'kind'>[]) => (Array.isArray(list) ? list.map((t) => ({ ...t, kind: 'private' as const })) : []))
    .catch(() => [])
  return privateList
}

/**
 * Licensed translations the server proxy is set up for (it has the API
 * keys). The last list seen is remembered so the picker still shows them
 * when offline; reading them then falls back to the KJV.
 */
const ONLINE_LIST_KEY = 'foundations:online-translations'
let onlineList: Promise<Translation[]> | null = null
export function listOnline(): Promise<Translation[]> {
  const remembered = (): Translation[] => {
    try {
      return JSON.parse(localStorage.getItem(ONLINE_LIST_KEY) ?? '[]')
    } catch {
      return []
    }
  }
  onlineList ??= fetch('/api/bible/translations')
    .then((r) => {
      const type = r.headers.get('content-type') ?? ''
      return r.ok && type.includes('json') ? r.json() : Promise.reject(new Error('unavailable'))
    })
    .then((list: Omit<Translation, 'kind'>[]) => {
      const out = Array.isArray(list) ? list.map((t) => ({ ...t, kind: 'online' as const })) : []
      try {
        localStorage.setItem(ONLINE_LIST_KEY, JSON.stringify(out))
      } catch {
        // storage full or blocked: fine, we just won't remember the list
      }
      return out
    })
    .catch(() => remembered())
  return onlineList
}

const IMPORTED_LIST_KEY = 'translations'
const bookKey = (tid: string, book: string) => `bible:${tid}:${book}`

export async function listImported(): Promise<Translation[]> {
  try {
    return ((await get(IMPORTED_LIST_KEY)) as Translation[] | undefined) ?? []
  } catch {
    return []
  }
}

export async function saveImported(abbr: string, name: string, books: BookMap): Promise<Translation> {
  const id = 'user-' + abbr.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const t: Translation = {
    id,
    abbr: abbr.toUpperCase(),
    name: name || abbr.toUpperCase(),
    kind: 'imported',
    notice: `${abbr.toUpperCase()}: imported by you for personal study. Stored only on this device.`,
    books: [...books.keys()],
    importedAt: new Date().toISOString(),
  }
  const existing = await listImported()
  const old = existing.find((x) => x.id === id)
  if (old?.books) await Promise.all(old.books.map((b) => del(bookKey(id, b))))
  await Promise.all([...books.values()].map((b) => set(bookKey(id, b.id), b)))
  await set(IMPORTED_LIST_KEY, [...existing.filter((x) => x.id !== id), t])
  cache.clear()
  notify()
  return t
}

export async function removeImported(id: string) {
  const existing = await listImported()
  const t = existing.find((x) => x.id === id)
  if (t?.books) await Promise.all(t.books.map((b) => del(bookKey(id, b))))
  await set(IMPORTED_LIST_KEY, existing.filter((x) => x.id !== id))
  cache.clear()
  notify()
}

const cache = new Map<string, Promise<BookText | null>>()

/** Load one book. Returns null if this translation doesn't have it. */
export function loadBook(translationId: string, book: string): Promise<BookText | null> {
  const key = `${translationId}:${book}`
  let p = cache.get(key)
  if (!p) {
    p = translationId.startsWith('user-')
      ? get(bookKey(translationId, book)).then((b) => (b as BookText | undefined) ?? null)
      : listPrivate()
          .then((priv) => priv.find((t) => t.id === translationId)?.dir ?? translationId)
          .then((dir) => fetch(`/bible/${dir}/${book}.json`)).then((r) => (r.ok ? (r.json() as Promise<BookText>) : null))
    p = p.catch(() => null)
    cache.set(key, p)
    p.then((b) => {
      if (!b) cache.delete(key)
    })
  }
  return p
}

export interface ChapterText {
  verses: Verse[]
  /** Copyright line to show under the text (online translations) */
  notice?: string
}

export type ChapterFailure = 'offline' | 'missing' | 'error'

const chapterCache = new Map<string, { at: number; text: ChapterText }>()

/**
 * Load one chapter. Online translations are fetched through the proxy and
 * kept only as long as the provider allows (in memory, for this session at
 * most); everything else comes from the offline book files.
 */
export async function loadChapter(
  translation: Translation,
  book: string,
  chapter: number,
): Promise<ChapterText | ChapterFailure> {
  if (translation.kind !== 'online') {
    const b = await loadBook(translation.id, book)
    const verses = b?.chapters[chapter - 1]
    return verses?.length ? { verses } : 'missing'
  }
  const key = `${translation.id}:${book}:${chapter}`
  const hit = chapterCache.get(key)
  const maxAge = (translation.cacheSeconds ?? 0) * 1000
  if (hit && (maxAge === 0 || Date.now() - hit.at < maxAge)) return hit.text
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'offline'
  try {
    const r = await fetch(`/api/bible/chapter?t=${encodeURIComponent(translation.id)}&book=${book}&c=${chapter}`)
    if (r.status === 404) return 'missing'
    if (!r.ok) return 'error'
    const text = (await r.json()) as ChapterText
    chapterCache.set(key, { at: Date.now(), text })
    // Keep only a few recent chapters in memory.
    if (chapterCache.size > 12) chapterCache.delete(chapterCache.keys().next().value!)
    return text
  } catch {
    return typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error'
  }
}

// Tiny change notification so screens can refresh their translation list.
const listeners = new Set<() => void>()
export function onTranslationsChanged(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
function notify() {
  listeners.forEach((l) => l())
}
