// A tiny, forgiving HTML tokenizer used to turn Bible-API HTML into verses.
// It runs both in the browser and on the server (Netlify Function), so it
// doesn't use the DOM. It only needs to understand simple, well-known markup.

export type Token =
  | { type: 'open'; tag: string; attrs: Record<string, string>; selfClosing: boolean }
  | { type: 'close'; tag: string }
  | { type: 'text'; text: string }

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  hellip: '…',
  thinsp: ' ',
}

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : m
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })
}

export function tokenize(html: string): Token[] {
  const out: Token[] = []
  const re = /<!--[\s\S]*?-->|<\/?([a-zA-Z][\w:-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|[^<]+|</g
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const raw = m[0]
    if (raw.startsWith('<!--')) continue
    if (m[1]) {
      const tag = m[1].toLowerCase()
      if (raw[1] === '/') {
        out.push({ type: 'close', tag })
      } else {
        const attrs: Record<string, string> = {}
        const ar = /([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g
        let a: RegExpExecArray | null
        while ((a = ar.exec(m[2] ?? ''))) attrs[a[1].toLowerCase()] = decodeEntities(a[2] ?? a[3] ?? a[4] ?? '')
        out.push({ type: 'open', tag, attrs, selfClosing: !!m[3] || /^(br|hr|img|meta|link|input|wbr)$/.test(tag) })
      }
    } else {
      out.push({ type: 'text', text: decodeEntities(raw) })
    }
  }
  return out
}

export const hasClass = (attrs: Record<string, string>, cls: string) => (attrs.class ?? '').split(/\s+/).includes(cls)

/** Collapse whitespace inside each poetry line and tidy spacing before punctuation. */
export function tidyVerseText(t: string): string {
  return t
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').replace(/\s+([,.;:!?’”)\]])/g, '$1').replace(/([‘“(\[])\s+/g, '$1').trim())
    .filter(Boolean)
    .join('\n')
}
