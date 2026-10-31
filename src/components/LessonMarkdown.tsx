// Renders lesson Markdown. Glossary words written as [[term]] become
// tappable definitions, and Bible references are linked to the reader.

import { useEffect, useState, type ReactNode } from 'react'
import { searchDictionary } from '../lib/data/dictionary.ts'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Link } from 'react-router-dom'
import { getTerm } from '../lib/content.ts'
import { GLOSSARY_LINK } from '../lib/lessonFormat.ts'
import { parseReference, readerPath, REFERENCE_IN_TEXT } from '../lib/references.ts'
import { Sheet, buttonClass } from './ui.tsx'
import { DIAGRAMS } from './Diagrams.tsx'

/** Turn our shorthand into ordinary Markdown links the renderer understands. */
function preprocess(md: string): string {
  const saved: string[] = []
  const keep = (m: string) => {
    saved.push(m)
    return `\u0000${saved.length - 1}\u0000`
  }
  const termName = (id: string, label?: string) => label ?? getTerm(id)?.term ?? id
  // Headings show the glossary word without a link and get no Bible links.
  let out = md.replace(/^\s*#.*$/gm, (line) => keep(line.replace(GLOSSARY_LINK, (_m, id: string, label?: string) => termName(id, label))))
  // Protect existing links and glossary terms, then link Bible references.
  // This works across the line breaks inside a paragraph.
  out = out.replace(/\[[^\]]*\]\([^)]*\)|\[\[[^\]]+\]\]/g, keep)
  out = out.replace(REFERENCE_IN_TEXT, (ref) => {
    const p = parseReference(ref.replace(/\s+/g, ' '))
    return p ? `[${ref}](${readerPath(p)})` : ref
  })
  while (/\u0000\d+\u0000/.test(out)) out = out.replace(/\u0000(\d+)\u0000/g, (_m, i) => saved[Number(i)])
  return out.replace(GLOSSARY_LINK, (_m, id: string, label?: string) => `[${termName(id, label).replace(/\s+/g, ' ')}](glossary:${id})`)
}

export function GlossaryLink({ id, children }: { id: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [inDictionary, setInDictionary] = useState(false)
  const term = getTerm(id)
  useEffect(() => {
    if (!open || !term) return
    let cancelled = false
    searchDictionary(term.term.replace(/\s*\(.*\)$/, ''), 1)
      .then((r) => !cancelled && setInDictionary(r.length > 0))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [open, term])
  if (!term) return <>{children}</>
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-help rounded-sm text-inherit underline decoration-amber-600 decoration-dotted decoration-2 underline-offset-4 dark:decoration-amber-300"
        aria-haspopup="dialog"
      >
        {children}
        <span className="sr-only"> (glossary)</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={term.term}>
        <p className="text-lg leading-relaxed">{term.definition}</p>
        <div className={`mt-5 grid gap-2 ${inDictionary ? 'grid-cols-2' : ''}`}>
          <Link to={`/glossary#${id}`} className={buttonClass('secondary')}>
            Glossary
          </Link>
          {inDictionary && (
            <Link to={`/dictionary?q=${encodeURIComponent(term.term.replace(/\s*\(.*\)$/, ''))}`} className={buttonClass('secondary')}>
              Dictionary
            </Link>
          )}
        </div>
      </Sheet>
    </>
  )
}

/** Lesson text, with {{diagram:name}} lines replaced by diagrams. */
export function LessonMarkdown({ source }: { source: string }) {
  const parts = source.split(/^\{\{diagram:([a-z-]+)\}\}\s*$/m)
  return (
    <div className="lesson-prose">
      {parts.map((part, i) => {
        if (i % 2 === 1) {
          const D = DIAGRAMS[part]
          return D ? <D key={i} /> : null
        }
        return <MarkdownChunk key={i} source={part} />
      })}
    </div>
  )
}

function MarkdownChunk({ source }: { source: string }) {
  return (
    <>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => url}
        components={{
          a: ({ href = '', children }) => {
            if (href.startsWith('glossary:')) return <GlossaryLink id={href.slice(9)}>{children}</GlossaryLink>
            if (href.startsWith('/')) return <Link to={href}>{children}</Link>
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
                <span className="sr-only"> (opens another website)</span>
              </a>
            )
          },
        }}
      >
        {preprocess(source)}
      </ReactMarkdown>
    </>
  )
}
