// The ESV API from Crossway (https://api.esv.org). Free for non-commercial use.
//
// Terms we follow (api.esv.org):
//  - key kept server-side, never published
//  - one chapter per request (always under the 500-verse / half-a-book limit)
//  - the app stores at most a few chapters (well under 500 verses) and clears them
//  - every page with ESV text shows "ESV" and links to www.esv.org; full notice on the Copyright page
//  - the words are never changed (we leave out footnotes and cross-references, which is allowed)
//
// Env: ESV_API_KEY

import type { Verse } from '../../src/lib/bibleTypes.ts'
import { getBook, BOOK_IDS } from '../../src/lib/books.ts'
import { hasClass, tidyVerseText, tokenize } from '../../src/lib/htmlTokens.ts'
import type { ChapterResult, Provider } from '../types.ts'

export const ESV_NOTICE =
  'Scripture quotations marked “ESV” are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved. The ESV text may not be quoted in any publication made available to the public by a Creative Commons license. The ESV may not be translated into any other language. Users may not copy or download more than 500 verses of the ESV Bible or more than one half of any book of the ESV Bible.'

/** Parse the ESV API's HTML for one chapter into verses. */
export function versesFromEsvHtml(html: string): Verse[] {
  const tokens = tokenize(html)
  const verses: Verse[] = []
  let cur: Verse | null = null
  let pendingHeading: string | undefined
  let pendingPara = false
  // Elements whose text we skip entirely (footnotes, headers, audio links…)
  let skipDepth = 0
  let skipTag = ''
  let headingDepth = 0
  let heading = ''
  let inNumber = 0
  let divineName = 0

  for (const t of tokens) {
    if (skipDepth) {
      if (t.type === 'open' && t.tag === skipTag && !t.selfClosing) skipDepth++
      if (t.type === 'close' && t.tag === skipTag) skipDepth--
      continue
    }
    if (t.type === 'open') {
      const a = t.attrs
      if (
        t.tag === 'h2' ||
        t.tag === 'sup' ||
        t.tag === 'small' ||
        hasClass(a, 'footnote') ||
        hasClass(a, 'footnotes') ||
        hasClass(a, 'extra_text') ||
        hasClass(a, 'crossref') ||
        hasClass(a, 'audio') ||
        (t.tag === 'div' && hasClass(a, 'footnotes'))
      ) {
        if (!t.selfClosing) {
          skipDepth = 1
          skipTag = t.tag
        }
        continue
      }
      if (t.tag === 'h3' || t.tag === 'h4') {
        headingDepth++
        heading = ''
        continue
      }
      if (t.tag === 'b' && (hasClass(a, 'verse-num') || hasClass(a, 'chapter-num'))) {
        // id="v43003016-1" → verse 16
        const m = (a.id ?? '').match(/^v\d{2}(\d{3})(\d{3})/)
        if (m) {
          cur = { v: parseInt(m[2], 10), t: '' }
          if (pendingPara) cur.p = true
          if (pendingHeading) cur.h = pendingHeading
          pendingPara = false
          pendingHeading = undefined
          verses.push(cur)
        }
        inNumber++
        continue
      }
      if (t.tag === 'p') {
        if (hasClass(a, 'line') || hasClass(a, 'indent') || hasClass(a, 'indent-line')) {
          if (cur) cur.t += '\n'
        } else {
          pendingPara = true
        }
        continue
      }
      if (t.tag === 'span' && (hasClass(a, 'line') || hasClass(a, 'indent'))) {
        if (cur && cur.t.trim()) cur.t += '\n'
        continue
      }
      if (t.tag === 'span' && hasClass(a, 'divine-name')) {
        divineName++
        continue
      }
      if (t.tag === 'br' && cur) cur.t += '\n'
      continue
    }
    if (t.type === 'close') {
      if ((t.tag === 'h3' || t.tag === 'h4') && headingDepth) {
        headingDepth--
        const h = heading.replace(/\s+/g, ' ').trim()
        if (h) pendingHeading = pendingHeading ? `${pendingHeading} · ${h}` : h
        pendingPara = true
      }
      if (t.tag === 'b' && inNumber) inNumber--
      if (t.tag === 'span' && divineName) divineName--
      continue
    }
    // text ("Lord" in small caps is printed LORD)
    const text = divineName ? t.text.toUpperCase() : t.text
    if (headingDepth) heading += text
    else if (!inNumber && cur) cur.t += text
  }
  for (const v of verses) v.t = tidyVerseText(v.t)
  return verses.filter((v) => v.t)
}

export const esv: Provider = {
  translations(env) {
    if (!env.ESV_API_KEY) return []
    return [
      {
        id: 'esv',
        abbr: 'ESV',
        name: 'English Standard Version',
        provider: 'ESV API (Crossway)',
        notice: 'ESV® Bible © 2001 by Crossway. Used by permission. All rights reserved.',
        cacheSeconds: 7 * 86400,
        attributionUrl: 'https://www.esv.org',
        copyrightPage: ESV_NOTICE,
      },
    ]
  },

  async chapter(env, _id, book, chapter): Promise<ChapterResult | null> {
    const info = getBook(book)
    if (!info) return null
    // ESV verse ids are BBCCCVVV: request the whole chapter by id range.
    const bb = String(BOOK_IDS.indexOf(book) + 1).padStart(2, '0')
    const cc = String(chapter).padStart(3, '0')
    const params = new URLSearchParams({
      q: `${bb}${cc}001-${bb}${cc}999`,
      'include-passage-references': 'false',
      'include-footnotes': 'false',
      'include-footnote-body': 'false',
      'include-headings': 'true',
      'include-subheadings': 'true',
      'include-short-copyright': 'false',
      'include-copyright': 'false',
      'include-audio-link': 'false',
      'include-chapter-numbers': 'true',
      'include-crossrefs': 'false',
      'include-book-titles': 'false',
      'include-css-link': 'false',
      'wrapping-div': 'false',
    })
    const res = await fetch(`https://api.esv.org/v3/passage/html/?${params}`, {
      headers: { Authorization: `Token ${env.ESV_API_KEY}` },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`ESV API replied ${res.status}`)
    const body = (await res.json()) as { passages?: string[] }
    const verses = versesFromEsvHtml((body.passages ?? []).join('\n'))
    return { verses, notice: 'ESV® Bible © 2001 by Crossway. Used by permission.', attributionUrl: 'https://www.esv.org' }
  },
}
