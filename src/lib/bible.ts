// Bible translations:
// - bundled: public-domain Bibles shipped with the app (offline)
// - private: built in from your own file with `npm run add-bible` (offline)
// - imported: loaded from a file inside the app, stored on this device (offline)
// - online: licensed translations (NKJV, ESV, NLT…) fetched a chapter at a
//   time through the app's own server proxy, following each provider's terms

import { get, set, del } from 'idb-keyval'
import { loadOnlineChapter } from './online.ts'
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
  /** online: link the provider requires wherever its text is shown */
  attributionUrl?: string
  /** online: true when its terms don't allow text-to-speech */
  noSpeech?: boolean
  /** online: full copyright statement for the Copyright page */
  copyrightPage?: string
  /** online: official narrated audio is available */
  hasAudio?: boolean
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
    id: 'bsb',
    abbr: 'BSB',
    name: 'Berean Standard Bible',
    kind: 'bundled',
    notice:
      'The Holy Bible, Berean Standard Bible, BSB is produced in cooperation with Bible Hub, Discovery Bible, OpenBible.com, and the Berean Bible Translation Committee. This text of God’s Word has been dedicated to the public domain.',
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

export interface ChapterText {
  verses: Verse[]
  /** Copyright line to show under the text (online translations) */
  notice?: string
  /** API.Bible view-tracking token */
  fumsToken?: string
}

export type ChapterFailure = 'offline' | 'missing' | 'error'

/**
 * Load one chapter. Online translations come through online.ts (within each
 * provider's caching limits); everything else from the offline book files.
 */
export async function loadChapter(
  translation: Translation,
  book: string,
  chapter: number,
): Promise<ChapterText | ChapterFailure> {
  if (translation.kind === 'online') return loadOnlineChapter(translation, book, chapter)
  const b = await loadBook(translation.id, book)
  const verses = b?.chapters[chapter - 1]
  return verses?.length ? { verses } : 'missing'
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
export const notifyTranslationsChanged = notify
