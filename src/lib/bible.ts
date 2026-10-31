// Bible translations: the bundled public-domain ones, plus any the user has
// imported themselves (stored only on this device, in IndexedDB).

import { get, set, del } from 'idb-keyval'
import type { BookText } from './bibleTypes.ts'
import type { BookMap } from './bibleImport.ts'

export interface Translation {
  id: string
  /** Folder under /bible/ holding the book files (bundled and private translations) */
  dir?: string
  abbr: string
  name: string
  kind: 'bundled' | 'private' | 'imported'
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
