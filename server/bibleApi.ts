// The Bible proxy's router. Runs as a Netlify Function in production and as
// Vite middleware during `npm run dev` / `npm run preview` (see vite.config.ts).
//
//   GET /api/bible/translations                 → configured online translations
//   GET /api/bible/chapter?t=esv&book=JHN&c=3    → { verses, notice }

import { getBook } from '../src/lib/books.ts'
import type { Env, Provider } from './types.ts'
import { PROVIDERS } from './providers/index.ts'

function json(body: unknown, status = 200, cacheSeconds = 0): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cacheSeconds > 0 ? `private, max-age=${cacheSeconds}` : 'no-store',
    },
  })
}

function allTranslations(env: Env) {
  return PROVIDERS.flatMap((p) => p.translations(env).map((t) => ({ t, p })))
}

export async function handleBibleApi(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url)
  if (req.method !== 'GET') return json({ error: 'Only GET is supported' }, 405)

  if (/\/translations\/?$/.test(url.pathname)) {
    return json(allTranslations(env).map(({ t }) => t))
  }

  if (/\/chapter\/?$/.test(url.pathname)) {
    const id = url.searchParams.get('t') ?? ''
    const bookId = (url.searchParams.get('book') ?? '').toUpperCase()
    const chapter = Number(url.searchParams.get('c'))
    const book = getBook(bookId)
    if (!book || !Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) {
      return json({ error: 'Unknown book or chapter' }, 400)
    }
    const match = allTranslations(env).find(({ t }) => t.id === id)
    if (!match) return json({ error: `Translation "${id}" is not set up on this server` }, 404)
    try {
      const result = await (match.p as Provider).chapter(env, id, book.id, chapter)
      if (!result || !result.verses.length) return json({ error: 'Not found' }, 404)
      return json(result, 200, match.t.cacheSeconds)
    } catch (e) {
      return json({ error: `The ${match.t.provider} service could not be reached: ${(e as Error).message}` }, 502)
    }
  }

  return json({ error: 'Not found' }, 404)
}
