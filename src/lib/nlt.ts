// The NLT API from Tyndale (https://api.nlt.to). Shared by the server proxy
// (with your free key) and the app itself (anonymous access, which Tyndale
// allows: up to 50 verses per request and 500 requests a day per device).

import type { Verse } from './bibleTypes.ts'
import { hasClass, tidyVerseText, tokenize } from './htmlTokens.ts'

export const NLT_NOTICE =
  'Scripture quotations marked NLT are taken from the Holy Bible, New Living Translation, copyright © 1996, 2004, 2015 by Tyndale House Foundation. Used by permission of Tyndale House Publishers, Inc., Carol Stream, Illinois 60188. All rights reserved.'
export const NLT_SHORT = 'Holy Bible, New Living Translation, © 1996, 2004, 2015 Tyndale House Foundation. Used by permission.'

/** USFM book id → the book codes the NLT API understands. */
const CODES: Record<string, string> = {
  GEN: 'Gen', EXO: 'Exod', LEV: 'Lev', NUM: 'Num', DEU: 'Deut', JOS: 'Josh', JDG: 'Judg', RUT: 'Ruth',
  '1SA': '1Sam', '2SA': '2Sam', '1KI': '1Kgs', '2KI': '2Kgs', '1CH': '1Chr', '2CH': '2Chr', EZR: 'Ezra',
  NEH: 'Neh', EST: 'Esth', JOB: 'Job', PSA: 'Ps', PRO: 'Prov', ECC: 'Eccl', SNG: 'Song', ISA: 'Isa',
  JER: 'Jer', LAM: 'Lam', EZK: 'Ezek', DAN: 'Dan', HOS: 'Hos', JOL: 'Joel', AMO: 'Amos', OBA: 'Obad',
  JON: 'Jonah', MIC: 'Mic', NAM: 'Nah', HAB: 'Hab', ZEP: 'Zeph', HAG: 'Hag', ZEC: 'Zech', MAL: 'Mal',
  MAT: 'Matt', MRK: 'Mark', LUK: 'Luke', JHN: 'John', ACT: 'Acts', ROM: 'Rom', '1CO': '1Cor', '2CO': '2Cor',
  GAL: 'Gal', EPH: 'Eph', PHP: 'Phil', COL: 'Col', '1TH': '1Thess', '2TH': '2Thess', '1TI': '1Tim',
  '2TI': '2Tim', TIT: 'Titus', PHM: 'Phlm', HEB: 'Heb', JAS: 'Jas', '1PE': '1Pet', '2PE': '2Pet',
  '1JN': '1John', '2JN': '2John', '3JN': '3John', JUD: 'Jude', REV: 'Rev',
}

export function nltRef(book: string, chapter: number, from?: number, to?: number): string {
  const code = CODES[book]
  if (!code) throw new Error(`Unknown book ${book}`)
  if (!from) return `${code}.${chapter}`
  return `${code}.${chapter}.${from}${to && to !== from ? `-${to}` : ''}`
}

/** Parse NLT API passage HTML into verses (headings kept, footnotes removed). */
export function versesFromNltHtml(html: string): Verse[] {
  const tokens = tokenize(html)
  const verses: Verse[] = []
  let cur: Verse | null = null
  let started = false // text of the current verse has begun
  let pendingHeading: string | undefined
  let pendingPara = false
  let skip = 0
  let skipTag = ''
  let headingDepth = 0
  let heading = ''
  let smallCaps = 0

  for (const t of tokens) {
    if (skip) {
      if (t.type === 'open' && t.tag === skipTag && !t.selfClosing) skip++
      if (t.type === 'close' && t.tag === skipTag) skip--
      continue
    }
    if (t.type === 'open') {
      const a = t.attrs
      if (t.tag === 'verse_export') {
        const n = parseInt(a.vn ?? '', 10)
        if (Number.isFinite(n)) {
          cur = { v: n, t: '' }
          started = false
          verses.push(cur)
        }
        continue
      }
      // Footnotes, verse numbers, chapter numbers and the passage header are skipped.
      if (
        (t.tag === 'span' && (hasClass(a, 'tn') || hasClass(a, 'vn'))) ||
        (t.tag === 'a' && hasClass(a, 'a-tn')) ||
        t.tag === 'h2' ||
        hasClass(a, 'chapter-number') ||
        t.tag === 'head' ||
        t.tag === 'title'
      ) {
        if (!t.selfClosing) {
          skip = 1
          skipTag = t.tag
        }
        continue
      }
      if (t.tag === 'h3' || t.tag === 'h4' || (t.tag === 'p' && hasClass(a, 'psa-title'))) {
        headingDepth++
        heading = ''
        continue
      }
      if (t.tag === 'span' && hasClass(a, 'sc')) {
        smallCaps++
        continue
      }
      if (t.tag === 'p') {
        const poetry = /\bpoet/.test(a.class ?? '')
        if (cur && started) {
          if (poetry) cur.t += '\n'
          else cur.t += ' '
        } else if (!poetry) {
          pendingPara = true
        }
        continue
      }
      if (t.tag === 'br' && cur && started) cur.t += '\n'
      continue
    }
    if (t.type === 'close') {
      if (headingDepth && (t.tag === 'h3' || t.tag === 'h4' || t.tag === 'p')) {
        headingDepth--
        const h = heading.replace(/\s+/g, ' ').trim()
        if (h) pendingHeading = pendingHeading ? `${pendingHeading} · ${h}` : h
        continue
      }
      if (t.tag === 'span' && smallCaps) smallCaps--
      continue
    }
    const text = smallCaps ? t.text.toUpperCase() : t.text
    if (headingDepth) {
      heading += text
      continue
    }
    if (!cur || (!started && !text.trim())) continue
    if (!started) {
      started = true
      if (pendingPara) cur.p = true
      if (pendingHeading) cur.h = pendingHeading
      pendingPara = false
      pendingHeading = undefined
    }
    cur.t += text
  }
  for (const v of verses) v.t = tidyVerseText(v.t)
  return verses.filter((v) => v.t)
}
