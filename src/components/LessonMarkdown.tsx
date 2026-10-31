// Renders lesson Markdown. Glossary words written as [[term]] become
// tappable definitions, and Bible references are linked to the reader.

import { useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Link } from 'react-router-dom'
import { getTerm } from '../lib/content.ts'
import { GLOSSARY_LINK } from '../lib/lessonFormat.ts'
import { parseReference, readerPath, REFERENCE_IN_TEXT } from '../lib/references.ts'
import { Sheet, buttonClass } from './ui.tsx'

/** Turn our shorthand into ordinary Markdown links the renderer understands. */
function preprocess(md: string): string {
  return md
    .split('\n')
    .map((line) => {
      if (/^\s*#/.test(line)) {
        // headings: just show the glossary word, no links
        return line.replace(GLOSSARY_LINK, (_m, id: string, label?: string) => label ?? getTerm(id)?.term ?? id)
      }
      // Protect existing links, then add Bible-reference links, then glossary links.
      const saved: string[] = []
      let out = line.replace(/\[[^\]]*\]\([^)]*\)|\[\[[^\]]+\]\]/g, (m) => {
        saved.push(m)
        return `\u0000${saved.length - 1}\u0000`
      })
      out = out.replace(REFERENCE_IN_TEXT, (ref) => {
        const p = parseReference(ref)
        return p ? `[${ref}](${readerPath(p)})` : ref
      })
      out = out.replace(/\u0000(\d+)\u0000/g, (_m, i) => saved[Number(i)])
      return out.replace(GLOSSARY_LINK, (_m, id: string, label?: string) => `[${label ?? id}](glossary:${id})`)
    })
    .join('\n')
}

export function GlossaryLink({ id, children }: { id: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const term = getTerm(id)
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
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Link to={`/glossary#${id}`} className={buttonClass('secondary')}>
            Glossary
          </Link>
          <Link to={`/dictionary?q=${encodeURIComponent(term.term.replace(/\s*\(.*\)$/, ''))}`} className={buttonClass('secondary')}>
            Dictionary
          </Link>
        </div>
      </Sheet>
    </>
  )
}

export function LessonMarkdown({ source }: { source: string }) {
  return (
    <div className="lesson-prose">
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
    </div>
  )
}
