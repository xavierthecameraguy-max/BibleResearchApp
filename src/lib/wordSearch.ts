// Search the Hebrew and Greek lexicons (STEPBible data) by English meaning,
// transliteration, original spelling or Strong's number.

import type { LexiconEntry } from './data/original.ts'

let all: Promise<LexiconEntry[]> | null = null
let loaded = false

/** True once the lexicon has been downloaded in this session. */
export const lexiconLoaded = () => loaded

/** Load every lexicon bucket (about 6 MB, cached on the device after the first time). */
function loadAll(): Promise<LexiconEntry[]> {
  all ??= Promise.all(
    [
      ...Array.from({ length: 20 }, (_, i) => `H${i}`),
      ...Array.from({ length: 44 }, (_, i) => `G${i}`),
    ].map((b) =>
      fetch(`/data/original/lexicon/${b}.json`)
        .then((r) => (r.ok && (r.headers.get('content-type') ?? '').includes('json') ? r.json() : {}))
        .catch(() => ({})),
    ),
  ).then((buckets) => {
    loaded = true
    return buckets.flatMap((b: Record<string, LexiconEntry & { senses?: unknown }>) =>
      Object.entries(b).map(([strong, e]) => ({ ...e, strong, senses: (e.senses as LexiconEntry['senses']) ?? [] })),
    )
  })
  return all
}

const strip = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-֑ͯ-ׇ]/g, '')
    .toLowerCase()

export async function searchLexicon(query: string, limit = 60): Promise<LexiconEntry[]> {
  const scored = await scoreAll(query)
  // Hebrew ח is written "ch" or "h" ("chesed"/"hesed"), so search both spellings.
  if (/^h[^h]/i.test(query.trim())) {
    for (const x of await scoreAll('c' + query.trim())) {
      const have = scored.find((y) => y.e.strong === x.e.strong)
      if (!have) scored.push(x)
      else have.score = Math.max(have.score, x.score)
    }
  }
  return scored
    .sort((a, b) => b.score - a.score || Number(a.e.strong.slice(1)) - Number(b.e.strong.slice(1)))
    .slice(0, limit)
    .map((x) => x.e)
}

async function scoreAll(query: string): Promise<{ e: LexiconEntry; score: number }[]> {
  const q = strip(query.trim())
  if (!q) return []
  const entries = await loadAll()
  const strongQ = q.match(/^([hg])0*(\d+)$/)
  const scored: { e: LexiconEntry; score: number }[] = []
  for (const e of entries) {
    let score = 0
    if (strongQ && e.strong.toLowerCase() === `${strongQ[1]}${strongQ[2]}`) score = 100
    const gloss = strip(e.gloss)
    const tr = strip(e.translit)
    const lemma = strip(e.lemma)
    if (gloss === q) score = Math.max(score, 80)
    else if (new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(gloss)) score = Math.max(score, 60)
    if (tr === q || lemma === q) score = Math.max(score, 90)
    else if (tr.startsWith(q) || lemma.startsWith(q)) score = Math.max(score, 50)
    if (!score && q.length > 3 && strip(e.definition).includes(q)) score = 10
    // Personal and place names (glosses like "Hesed") rank below ordinary words.
    if (score && /^[A-Z]/.test(e.gloss)) score -= 15
    if (score) scored.push({ e, score })
  }
  return scored
}
