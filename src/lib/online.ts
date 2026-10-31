// Licensed translations read online (NKJV, ESV, NLT…).
//
// - Most come through the app's own server proxy (/api/bible/…), which holds
//   your API keys. If you set an access code on the server, the app sends it.
// - With no server (GitHub Pages), or if you prefer, you can save your keys on
//   the phone instead (Settings). The app then runs the proxy's own code
//   (server/bibleApi.ts) itself, and calls the Bible services directly.
// - The NLT also works with no sign-up at all: the app asks Tyndale's NLT API
//   directly, using its anonymous allowance (50 verses per request).
// - Fetched chapters are kept on this device only within each provider's
//   limits: never more than 400 verses per translation, and only for the
//   time the provider allows (at most 14 days).

import { get, set, del } from 'idb-keyval'
import type { Verse } from './bibleTypes.ts'
import { loadBook, notifyTranslationsChanged, type ChapterFailure, type ChapterText, type Translation } from './bible.ts'
import { NLT_NOTICE, NLT_SHORT, nltRef, versesFromNltHtml } from './nlt.ts'
import { BOOK_IDS } from './books.ts'
import { STATIC_HOST, publicUrl } from './paths.ts'

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

// ---- Keys saved on this device ----------------------------------------------
// Saved only in this app on this phone (not in backups), and sent only to the
// Bible services themselves.

const DEVICE_KEYS = 'foundations:device-keys'

export type DeviceKeys = {
  /** API.Bible key (the NKJV and others) */
  API_BIBLE_KEY?: string
  /** Optional list of API.Bible translations, "ABBR=bibleId|Full name", comma-separated */
  API_BIBLE_BIBLES?: string
  ESV_API_KEY?: string
  NLT_API_KEY?: string
}

export function getDeviceKeys(): DeviceKeys {
  try {
    const raw = JSON.parse(localStorage.getItem(DEVICE_KEYS) ?? '{}') as unknown
    return raw && typeof raw === 'object' ? (raw as DeviceKeys) : {}
  } catch {
    return {}
  }
}

/** True when keys are saved on this device (they're used instead of a server). */
export function usingDeviceKeys(keys: DeviceKeys = getDeviceKeys()): boolean {
  return !!(keys.API_BIBLE_KEY || keys.ESV_API_KEY || keys.NLT_API_KEY)
}

export function setDeviceKeys(keys: DeviceKeys) {
  const clean: DeviceKeys = {}
  for (const [name, value] of Object.entries(keys)) {
    if (typeof value === 'string' && value.trim()) clean[name as keyof DeviceKeys] = value.trim()
  }
  try {
    if (Object.keys(clean).length) localStorage.setItem(DEVICE_KEYS, JSON.stringify(clean))
    else localStorage.removeItem(DEVICE_KEYS)
  } catch {
    // storage blocked
  }
  onlineList = null
  notifyTranslationsChanged()
}

/** Ask the Bible proxy: the server's, or the same code run here with this device's keys. */
async function apiFetch(path: string, timeoutMs = 8_000): Promise<Response> {
  const keys = getDeviceKeys()
  if (usingDeviceKeys(keys)) {
    const { handleBibleApi } = await import('../../server/bibleApi.ts')
    return handleBibleApi(new Request(new URL(path, 'https://this-device.invalid/')), keys)
  }
  if (STATIC_HOST) throw new Error('This copy of the app has no server part.')
  const code = getAccessCode()
  return fetch(publicUrl(path), { headers: code ? { 'x-access-code': code } : {}, signal: AbortSignal.timeout(timeoutMs) })
}

// ---- Which online translations exist ---------------------------------------

/**
 * ok: the server answered. device: keys saved on this phone are used.
 * no-server: a copy with no server part (GitHub Pages) and no keys saved yet.
 */
export type ServerStatus = 'ok' | 'needs-code' | 'unavailable' | 'device' | 'no-server'

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

async function fetchOnlineList(device: boolean): Promise<{ list: Translation[]; status: ServerStatus }> {
  if (STATIC_HOST && !device) return { list: [], status: 'no-server' }
  try {
    const r = await apiFetch('/api/bible/translations')
    const type = r.headers.get('content-type') ?? ''
    if (r.status === 401) return { list: [], status: 'needs-code' }
    if (!r.ok || !type.includes('json')) throw new Error('unavailable')
    const raw = (await r.json()) as Omit<Translation, 'kind'>[]
    const list = Array.isArray(raw) ? raw.map((t) => ({ ...t, kind: 'online' as const })) : []
    if (device) return { list, status: 'device' }
    try {
      localStorage.setItem(ONLINE_LIST_KEY, JSON.stringify(list))
    } catch {
      // storage full or blocked
    }
    return { list, status: 'ok' }
  } catch {
    return { list: device ? [] : remembered(), status: 'unavailable' }
  }
}

export function listOnlineWithStatus(): Promise<{ list: Translation[]; status: ServerStatus }> {
  onlineList ??= fetchOnlineList(usingDeviceKeys()).then(({ list, status }) => ({
    // Offer the no-sign-up NLT unless the NLT is already set up.
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

/**
 * Check that a translation's key works by loading John 1 (not shown or kept).
 * Returns null when it works, or a plain-English problem.
 */
export async function checkOnlineTranslation(t: Translation): Promise<string | null> {
  const service = t.provider ?? t.abbr
  try {
    const r = await apiFetch(`/api/bible/chapter?t=${encodeURIComponent(t.id)}&book=JHN&c=1`, 20_000)
    if (r.ok) return null
    const body = (await r.json().catch(() => ({}))) as { error?: string }
    const code = Number(/replied (\d{3})/.exec(body.error ?? '')?.[1] ?? r.status)
    const apiBible = /api\.bible/i.test(service)
    if (code === 401 || (code === 403 && !apiBible)) return `${service} didn’t accept the key. Check that you copied all of it.`
    if (code === 403) return `Your API.Bible key doesn’t include the ${t.abbr} yet. In your API.Bible dashboard, add it to your plan’s Bibles.`
    if (code === 404) return `${service} couldn’t find the ${t.abbr}. Check its Bible ID.`
    if (code === 429) return `${service} says the key has been used too much for now. Try again later.`
    return `${service} couldn’t be reached. Check your connection and try again.`
  } catch {
    return `${service} couldn’t be reached. Check your connection and try again.`
  }
}

let audioObjectUrl: string | null = null

/** The ESV's official audio, fetched with a key saved on this device. */
async function deviceEsvAudio(book: string, chapter: number): Promise<string | null> {
  const key = getDeviceKeys().ESV_API_KEY
  if (!key) return null
  const bb = String(BOOK_IDS.indexOf(book) + 1).padStart(2, '0')
  const cc = String(chapter).padStart(3, '0')
  const r = await fetch(`https://api.esv.org/v3/passage/audio/?q=${bb}${cc}001-${bb}${cc}999`, {
    headers: { Authorization: `Token ${key}` },
    signal: AbortSignal.timeout(60_000),
  })
  if (!r.ok) return null
  // Crossway sends the browser on to the MP3 itself: play it from there.
  if (r.redirected && r.url) {
    void r.body?.cancel()
    return r.url
  }
  if (audioObjectUrl) URL.revokeObjectURL(audioObjectUrl)
  audioObjectUrl = URL.createObjectURL(await r.blob())
  return audioObjectUrl
}

/** The URL of a translation's official chapter audio (e.g. the ESV), or null. */
export async function chapterAudioUrl(t: Translation, book: string, chapter: number): Promise<string | null> {
  if (!t.hasAudio) return null
  try {
    if (usingDeviceKeys()) return t.id === 'esv' ? await deviceEsvAudio(book, chapter) : null
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
