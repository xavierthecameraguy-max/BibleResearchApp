// Shared shapes for the Bible proxy. It runs as a Netlify Function (keys in
// the site's settings), or inside the app with keys saved on the phone (for
// GitHub Pages). Either way it adds the key, calls the provider, and returns
// verses in the app's own format.

import type { Verse } from '../src/lib/bibleTypes.ts'

export type Env = Record<string, string | undefined>

export interface OnlineTranslationInfo {
  id: string
  abbr: string
  name: string
  /** Which service provides it, e.g. "ESV API" or "API.Bible" */
  provider: string
  /** Copyright line the provider requires us to show with the text */
  notice: string
  /** How long the app may keep a chapter (seconds). 0 = only while the app is open. */
  cacheSeconds: number
  /** Link the provider requires on every page that shows its text */
  attributionUrl?: string
  /** True when the terms don't allow reading the text aloud with text-to-speech */
  noSpeech?: boolean
  /** Full copyright statement for the Copyright page */
  copyrightPage?: string
  /** True when the provider offers official narrated audio */
  hasAudio?: boolean
}

export interface ChapterResult {
  verses: Verse[]
  /** Copyright line to display under the text */
  notice: string
  /** Link the provider requires next to its text */
  attributionUrl?: string
  /** API.Bible usage-tracking token (FUMS); the app reports a view when shown */
  fumsToken?: string
}

export interface Provider {
  /** Translations this provider can serve with the keys in env (empty if not configured) */
  translations(env: Env): OnlineTranslationInfo[]
  chapter(env: Env, translationId: string, book: string, chapter: number): Promise<ChapterResult | null>
  /** Optional: a playable audio URL for a chapter */
  audio?(env: Env, translationId: string, book: string, chapter: number): Promise<string | null>
}
