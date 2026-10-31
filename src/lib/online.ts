// Licensed translations read online (NKJV, ESV, NLT…).
//
// - Most come through the app's own server proxy (/api/bible/…), which holds
//   your API keys. If you set an access code on the server, the app sends it.
// - The NLT also works with no sign-up at all: the app asks Tyndale's NLT API
//   directly, using its anonymous allowance (50 verses per request).
// - Fetched chapters are kept on this device only within each provider's
//   limits: never more than 400 verses per translation, and only for the
//   time the provider allows (at most 14 days).

import { get, set, del } from 'idb-keyval'
import type { Verse } from './bibleTypes.ts'
import { loadBook, notifyTranslationsChanged, type ChapterFailure, type ChapterText, type Translation } from './bible.ts'
import { NLT_NOTICE, NLT_SHORT, nltRef, versesFromNltHtml } from './nlt.ts'

// ---- Access code -----------------------------------------------------------

const CODE_KEY = 'foundations:access-code'

export function getAccessCode(): string {
  try {
    return localStorage.getItem(CODE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setAccessCode(code: string) {
  try {
    localStorage.setItem(CODE_KEY, code.trim())
  } catch {
    // ignore
  }
  onlineList = null
  notifyTranslationsChanged()
}

function apiFetch(path: string, timeoutMs = 8_000): Promise<Response> {
  const code = getAccessCode()
  return fetch(path, { headers: code ? { 'x-access-code': code } : {}, signal: AbortSignal.timeout(timeoutMs) })
}

// ---- Which online translations exist ---------------------------------------

export type ServerStatus = 'ok' | 'needs-code' | 'unavailable'

/** The NLT with no sign-up (used when the server has no NLT key). */
export const NLT_OPEN: Translation = {
  id: 'nlt-open',
  abbr: 'NLT',
  name: 'New Living Translation',
  kind: 'online',
  provider: 'NLT API (Tyndale), no sign-up',
  notice: NLT_SHORT,
  cacheSeconds: 7 * 86400,
  attributionUrl: 'https://www.tyndale.com',
  copyrightPage: NLT_NOTICE,
}

const ONLINE_LIST_KEY = 'foundations:online-translations'
let onlineList: Promise<{ list: Translation[]; status: ServerStatus }> | null = null

function remembered(): Translation[] {
  try {
    return JSON.parse(localStorage.getItem(ONLINE_LIST_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function listOnlineWithStatus(): Promise<{ list: Translation[]; status: ServerStatus }> {
  onlineList ??= apiFetch('/api/bible/translations')
    .then(async (r) => {
      const type = r.headers.get('content-type') ?? ''
      if (r.status === 401) return { list: [] as Translation[], status: 'needs-code' as const }
      if (!r.ok || !type.includes('json')) throw new Error('unavailable')
      const raw = (await r.json()) as Omit<Translation, 'kind'>[]
      const list = Array.isArray(raw) ? raw.map((t) => ({ ...t, kind: 'online' as const })) : []
      try {
        localStorage.setItem(ONLINE_LIST_KEY, JSON.stringify(list))
      } catch {
        // storage full or blocked
      }
      return { list, status: 'ok' as const }
    })
    .catch(() => ({ list: remembered(), status: 'unavailable' as const }))
    .then(({ list, status }) => ({
      // Offer the no-sign-up NLT unless the server already provides the NLT.
      list: list.some((t) => t.abbr === 'NLT') ? list : [...list, NLT_OPEN],
      status,
    }))
  return onlineList
}

export const listOnline = () => listOnlineWithStatus().then((r) => r.list)

// ---- Device cache within each provider's limits ----------------------------

const MAX_VERSES_PER_TRANSLATION = 400
interface CacheEntry {
  key: string
  at: number
  verses: number
}
const indexKey = (tid: string) => `online-index:${tid}`
const memory = new Map<string, { at: number; text: ChapterText }>()

async function cacheGet(t: Translation, key: string): Promise<ChapterText | null> {
  const maxAge = Math.min(t.cacheSeconds ?? 0, 14 * 86400) * 1000
  const mem = memory.get(key)
  if (mem && (maxAge === 0 || Date.now() - mem.at < maxAge)) return mem.text
  if (maxAge === 0) return null
  try {
    const hit = (await get(key)) as { at: number; text: ChapterText } | undefined
    if (hit && Date.now() - hit.at < maxAge) {
      memory.set(key, hit)
      return hit.text
    }
    if (hit) await del(key)
  } catch {
    // IndexedDB unavailable: just fetch
  }
  return null
}

async function cachePut(t: Translation, key: string, text: ChapterText) {
  const entry = { at: Date.now(), text }
  memory.set(key, entry)
  if (memory.size > 12) memory.delete(memory.keys().next().value!)
  if (!t.cacheSeconds) return
  try {
    const maxAge = Math.min(t.cacheSeconds, 14 * 86400) * 1000
    let index = (((await get(indexKey(t.id))) as CacheEntry[] | undefined) ?? []).filter(
      (e) => e.key !== key && Date.now() - e.at < maxAge,
    )
    index.push({ key, at: entry.at, verses: text.verses.length })
    // Drop the oldest chapters until we're within the verse limit.
    const evicted: string[] = []
    while (index.reduce((n, e) => n + e.verses, 0) > MAX_VERSES_PER_TRANSLATION && index.length > 1) {
      evicted.push(index.shift()!.key)
    }
    if (index.reduce((n, e) => n + e.verses, 0) > MAX_VERSES_PER_TRANSLATION) {
      evicted.push(...index.map((e) => e.key))
      index = []
    } else {
      await set(key, entry)
    }
    await Promise.all(evicted.map((k) => del(k)))
    await set(indexKey(t.id), index)
  } catch {
    // ignore storage problems
  }
}

/** Remove every stored chapter of online translations (e.g. when a key is removed). */
export async function clearOnlineCache(translationIds: string[]) {
  memory.clear()
  for (const id of translationIds) {
    const index = ((await get(indexKey(id))) as CacheEntry[] | undefined) ?? []
    await Promise.all(index.map((e) => del(e.key)))
    await del(indexKey(id))
  }
}

// ---- Loading a chapter -----------------------------------------------------

async function fetchNltOpen(book: string, chapter: number): Promise<ChapterText | ChapterFailure> {
  // Anonymous access allows 50 verses per request, so long chapters are
  // fetched in parts. The KJV tells us how many verses the chapter has.
  const kjv = await loadBook('kjv', book)
  const count = kjv?.chapters[chapter - 1]?.length ?? 50
  const verses: Verse[] = []
  for (let from = 1; from <= count; from += 50) {
    const ref = count <= 50 ? nltRef(book, chapter) : nltRef(book, chapter, from, Math.min(from + 49, count))
    const r = await fetch(`https://api.nlt.to/api/passages?ref=${encodeURIComponent(ref)}&version=NLT`, {
      signal: AbortSignal.timeout(15_000),
    })
    if (!r.ok) return 'error'
    verses.push(...versesFromNltHtml(await r.text()))
  }
  return verses.length ? { verses, notice: NLT_SHORT } : 'missing'
}

export async function loadOnlineChapter(t: Translation, book: string, chapter: number): Promise<ChapterText | ChapterFailure> {
  const key = `online:${t.id}:${book}:${chapter}`
  const cached = await cacheGet(t, key)
  if (cached) return cached
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'offline'
  try {
    let result: ChapterText | ChapterFailure
    if (t.id === NLT_OPEN.id) {
      result = await fetchNltOpen(book, chapter)
    } else {
      const r = await apiFetch(`/api/bible/chapter?t=${encodeURIComponent(t.id)}&book=${book}&c=${chapter}`, 20_000)
      if (r.status === 404) return 'missing'
      if (!r.ok) return 'error'
      result = (await r.json()) as ChapterText
    }
    if (typeof result !== 'string') await cachePut(t, key, { ...result, fumsToken: undefined })
    return result
  } catch {
    return typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error'
  }
}

/** The URL of a translation's official chapter audio (e.g. the ESV), or null. */
export async function chapterAudioUrl(t: Translation, book: string, chapter: number): Promise<string | null> {
  if (!t.hasAudio) return null
  try {
    const r = await apiFetch(`/api/bible/audio?t=${encodeURIComponent(t.id)}&book=${book}&c=${chapter}`)
    if (!r.ok) return null
    return ((await r.json()) as { url?: string }).url ?? null
  } catch {
    return null
  }
}

// ---- API.Bible view reporting (FUMS) ---------------------------------------

let fumsScript: Promise<void> | null = null
declare global {
  interface Window {
    fums?: (action: string, token: string) => void
  }
}

/** Tell API.Bible that its text was shown (required by its terms for web apps). */
export function reportView(token: string | undefined) {
  if (!token || typeof document === 'undefined') return
  fumsScript ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://pkg.api.bible/fumsV3.min.js'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('FUMS script failed to load'))
    document.head.appendChild(s)
  })
  fumsScript
    .then(() => window.fums?.('trackView', token))
    .catch(() => {
      fumsScript = null
    })
}
