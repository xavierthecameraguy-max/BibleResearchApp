// API.Bible (American Bible Society): the licensed route to the NKJV and
// other copyrighted translations. Free "Starter" plan: non-commercial apps,
// up to 3 copyrighted Bibles, 5,000 calls a month.
//
// Terms we follow (api.bible/terms-and-conditions, docs.api.bible):
//  - key kept on the server, or (on GitHub Pages) saved only on your own phone
//    and sent only to API.Bible; never put into the app's files
//  - visible credit + link to https://api.bible, and a copyright page
//  - FUMS view tracking: we pass each response's fumsToken to the app
//  - no text-to-speech of the text; cached text refreshed within 14 days
//
// Env:
//   API_BIBLE_KEY      your key from https://api.bible (Starter plan is free)
//   API_BIBLE_BIBLES   optional list of translations, "ABBR=bibleId|Full name"
//                      separated by commas. Defaults to the NKJV.

import type { Verse } from '../../src/lib/bibleTypes.ts'
import type { ChapterResult, Env, OnlineTranslationInfo, Provider } from '../types.ts'

const BASE = 'https://rest.api.bible/v1'

/** Known Bible IDs from the API.Bible catalogue (see docs). */
export const NKJV_ID = '63097d2a0a2f7db3-01'

const DEFAULT_NOTICES: Record<string, string> = {
  NKJV: 'New King James Version®, Copyright © 1982, Thomas Nelson. All rights reserved.',
}

interface Configured {
  abbr: string
  bibleId: string
  name: string
}

function configured(env: Env): Configured[] {
  if (!env.API_BIBLE_KEY) return []
  const raw = env.API_BIBLE_BIBLES?.trim() || `NKJV=${NKJV_ID}|New King James Version`
  return raw
    .split(',')
    .map((part) => {
      const m = part.trim().match(/^([A-Za-z0-9]+)\s*=\s*([\w-]+)(?:\s*\|\s*(.+))?$/)
      return m ? { abbr: m[1].toUpperCase(), bibleId: m[2], name: m[3]?.trim() || m[1].toUpperCase() } : null
    })
    .filter((x): x is Configured => !!x)
}

// ---- Parsing the JSON content format -----------------------------------------

interface Node {
  name?: string
  type?: string
  text?: string
  attrs?: Record<string, unknown>
  items?: Node[]
}

const HEADING = /^(s\d?|ms\d?|mr|d|sp|qa|cl|mt\d?)$/
const SKIP_PARA = /^(r|ide|toc\d|h)$/
const POETRY = /^(q\d?|qr|qc|qm\d?|li\d?|pi\d?)$/

export function versesFromApiBibleJson(content: Node[]): Verse[] {
  const verses: Verse[] = []
  const byNum = new Map<number, Verse>()
  let pendingHeading: string | undefined
  let pendingPara = true
  let lineBreak = false

  const verseFor = (verseId: string): Verse | null => {
    const n = Number(verseId.split('.').pop())
    if (!Number.isFinite(n)) return null
    let v = byNum.get(n)
    if (!v) {
      v = { v: n, t: '' }
      if (pendingPara) v.p = true
      if (pendingHeading) v.h = pendingHeading
      pendingPara = false
      pendingHeading = undefined
      byNum.set(n, v)
      verses.push(v)
    }
    return v
  }

  const textOf = (n: Node): string => (n.text ?? '') + (n.items ?? []).map(textOf).join('')

  const walk = (nodes: Node[]) => {
    for (const n of nodes) {
      if (n.type === 'text') {
        const id = n.attrs?.verseId
        if (typeof id === 'string') {
          const v = verseFor(id)
          if (v) {
            v.t += (lineBreak && v.t ? '\n' : '') + (n.text ?? '')
            lineBreak = false
          }
        }
        continue
      }
      const style = String(n.attrs?.style ?? '')
      if (n.name === 'verse') continue // the verse-number label
      if (n.name === 'note' || style === 'f' || style === 'x') continue
      if (n.name === 'para') {
        if (SKIP_PARA.test(style)) continue
        if (HEADING.test(style)) {
          const h = textOf(n).trim()
          if (h) pendingHeading = h
          pendingPara = true
          continue
        }
        if (POETRY.test(style)) lineBreak = true
        else pendingPara = true
        // A paragraph that continues a verse begun earlier marks a new paragraph inside it.
        walk(n.items ?? [])
        continue
      }
      walk(n.items ?? [])
    }
  }
  walk(content)
  for (const v of verses) v.t = v.t.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n')
  return verses.filter((v) => v.t)
}

// ---- Provider -------------------------------------------------------------

export const apiBible: Provider = {
  translations(env) {
    return configured(env).map(
      (c): OnlineTranslationInfo => ({
        id: `apibible-${c.abbr.toLowerCase()}`,
        abbr: c.abbr,
        name: c.name,
        provider: 'API.Bible',
        notice: DEFAULT_NOTICES[c.abbr] ?? `${c.name}. Used by permission via API.Bible.`,
        cacheSeconds: 14 * 86400,
        attributionUrl: 'https://api.bible',
        noSpeech: true,
        copyrightPage:
          c.abbr === 'NKJV'
            ? 'Scripture taken from the New King James Version®. Copyright © 1982 by Thomas Nelson. Used by permission. All rights reserved. (harpercollins.com)'
            : undefined,
      }),
    )
  },

  async chapter(env, translationId, book, chapter): Promise<ChapterResult | null> {
    const c = configured(env).find((x) => `apibible-${x.abbr.toLowerCase()}` === translationId)
    if (!c) return null
    const params = new URLSearchParams({
      'content-type': 'json',
      'include-notes': 'false',
      'include-titles': 'true',
      'include-chapter-numbers': 'false',
      'include-verse-numbers': 'true',
      'include-verse-spans': 'false',
    })
    const res = await fetch(`${BASE}/bibles/${c.bibleId}/chapters/${book}.${chapter}?${params}`, {
      headers: { 'api-key': env.API_BIBLE_KEY!, accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`API.Bible replied ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`)
    const body = (await res.json()) as { data?: { content?: Node[]; copyright?: string }; meta?: { fumsToken?: string } }
    const verses = versesFromApiBibleJson(body.data?.content ?? [])
    return {
      verses,
      notice: (body.data?.copyright?.trim() || DEFAULT_NOTICES[c.abbr] || c.name).replace(/\s+/g, ' '),
      attributionUrl: 'https://api.bible',
      fumsToken: body.meta?.fumsToken,
    }
  },
}
