// A small USFM parser. USFM is the plain-text format most Bible translations
// are published in. Used both by scripts/build-bible.mjs (bundled
// translations) and by the in-app "Add a translation" importer.
//
// Only erasable TypeScript syntax is used here so Node can run this file
// directly when building the bundled Bibles.

import type { BookText, Verse } from './bibleTypes.ts'

const PARAGRAPH = /^(p|m|pi\d?|mi|nb|pc|pm|pmo|pmc|pmr|li\d?|cls|b)$/
const POETRY = /^(q\d?|qr|qc|qm\d?)$/

function cleanInline(text: string): string {
  return (
    text
      // footnotes, cross references, figures, end notes
      .replace(/\\(f|fe|x|fig|ef|ex)\s[\s\S]*?\\\1\*/g, '')
      // word-level attributes: \w word|strong="H123"\w*
      .replace(/\|[^\\]*?(\\\+?[a-z]+\*)/g, '$1')
      // closing character markers like \w*, \wj*, \add*
      .replace(/\\\+?[a-z]+\d*\*/g, '')
      // opening character markers (the single space after them is part of the marker)
      .replace(/\\\+?[a-z]+\d* ?/g, '')
      .replace(/[ \t]+/g, ' ')
  )
}

/** Parse one USFM book file. Returns null if it has no \id line. */
export function parseUsfm(src: string): BookText | null {
  const idMatch = src.match(/\\id\s+([A-Z0-9]{3})/)
  if (!idMatch) return null
  const id = idMatch[1]
  const chapters: Verse[][] = []
  let chapter: Verse[] | null = null
  let verse: Verse | null = null
  let pendingP = false
  let pendingH: string | undefined

  // Put every marker that starts a block onto its own line.
  const lines = src
    .replace(/\r/g, '')
    .replace(/\s*\\(c|v|p|m|q\d?|s\d?|d|ms\d?|mr|r|pi\d?|li\d?|nb|b|mi|pc|qr|qc|qa)(\s|$)/g, '\n\\$1$2')
    .split('\n')

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const m = line.match(/^\\([a-z]+\d*)\s*([\s\S]*)$/)
    if (!m) {
      if (verse) verse.t += ' ' + line
      continue
    }
    const [, marker, rest] = m
    if (marker === 'c') {
      const n = parseInt(rest, 10)
      chapter = []
      chapters[n - 1] = chapter
      verse = null
      pendingP = true
    } else if (marker === 'v') {
      if (!chapter) continue
      const vm = rest.match(/^(\d+)(?:[-–]\d+)?[a-z]?\s*([\s\S]*)$/)
      if (!vm) continue
      verse = { v: parseInt(vm[1], 10), t: vm[2] }
      if (pendingP) verse.p = true
      if (pendingH) verse.h = pendingH
      pendingP = false
      pendingH = undefined
      chapter.push(verse)
    } else if (PARAGRAPH.test(marker)) {
      pendingP = true
      if (rest && verse) verse.t += ' ' + rest
    } else if (POETRY.test(marker)) {
      if (verse && rest) verse.t += '\n' + rest
      else if (verse) verse.t += '\n'
      else if (rest) pendingH = (pendingH ? pendingH + ' ' : '') + rest
    } else if (marker === 'd' || marker === 'qa' || /^s\d?$/.test(marker) || /^ms\d?$/.test(marker)) {
      const heading = cleanInline(rest).trim()
      if (heading) pendingH = heading
      pendingP = true
    } else if (verse && !/^(id|ide|h|toc\d|mt\d?|mte\d?|imt\d?|is\d?|ip|ili\d?|rem|sts|cl|cp|ca|va|vp|r|mr|periph|usfm)$/.test(marker)) {
      // an unknown marker inside a verse: keep its text
      verse.t += ' ' + rest
    }
  }

  for (const ch of chapters) {
    if (!ch) continue
    for (const v of ch) {
      v.t = cleanInline(v.t)
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .join('\n')
      // The KJV marks paragraphs with a pilcrow.
      if (v.t.startsWith('¶')) {
        v.t = v.t.slice(1).trimStart()
        v.p = true
      }
    }
  }
  // Fill any gaps so chapters[n-1] always exists.
  for (let i = 0; i < chapters.length; i++) if (!chapters[i]) chapters[i] = []
  return { id, chapters }
}
