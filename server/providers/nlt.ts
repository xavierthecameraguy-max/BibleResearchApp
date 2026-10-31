// NLT through the server, using your free key from https://api.nlt.to
// (500 verses per request, 5,000 requests a day). Without a key, the app
// talks to the NLT API directly instead (anonymous access).
//
// Env: NLT_API_KEY

import { NLT_NOTICE, NLT_SHORT, nltRef, versesFromNltHtml } from '../../src/lib/nlt.ts'
import type { ChapterResult, Provider } from '../types.ts'

export const nlt: Provider = {
  translations(env) {
    if (!env.NLT_API_KEY) return []
    return [
      {
        id: 'nlt',
        abbr: 'NLT',
        name: 'New Living Translation',
        provider: 'NLT API (Tyndale)',
        notice: NLT_SHORT,
        cacheSeconds: 7 * 86400,
        attributionUrl: 'https://www.tyndale.com',
        copyrightPage: NLT_NOTICE,
      },
    ]
  },

  async chapter(env, _id, book, chapter): Promise<ChapterResult | null> {
    const params = new URLSearchParams({ ref: nltRef(book, chapter), version: 'NLT', key: env.NLT_API_KEY! })
    const res = await fetch(`https://api.nlt.to/api/passages?${params}`, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) throw new Error(`NLT API replied ${res.status}`)
    return { verses: versesFromNltHtml(await res.text()), notice: NLT_SHORT }
  },
}
