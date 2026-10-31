// Small shared building blocks.

import { useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CloseIcon, ChevronIcon, InfoIcon } from './Icons.tsx'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900 ${className}`}>
      {children}
    </div>
  )
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-5">
      <h1 className="font-serif text-3xl font-semibold leading-tight">{children}</h1>
      {sub && <p className="mt-2 text-stone-600 dark:text-stone-400">{sub}</p>}
    </div>
  )
}

const BTN = {
  primary:
    'bg-amber-700 text-white hover:bg-amber-800 active:bg-amber-900 dark:bg-amber-300 dark:text-stone-950 dark:hover:bg-amber-200',
  secondary:
    'border border-stone-300 bg-white text-stone-900 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:hover:bg-stone-800',
  ghost: 'text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800',
}

export function buttonClass(kind: keyof typeof BTN = 'primary', extra = '') {
  return `inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-semibold transition-colors disabled:opacity-50 ${BTN[kind]} ${extra}`
}

/** A full-width tappable row that links somewhere. */
export function RowLink({ to, children, aside }: { to: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <Link
      to={to}
      className="flex min-h-14 items-center gap-3 rounded-xl px-4 py-3 hover:bg-stone-100 dark:hover:bg-stone-800"
    >
      <span className="flex-1">{children}</span>
      {aside}
      <ChevronIcon className="shrink-0 text-stone-400" />
    </Link>
  )
}

export function ProgressBar({ value, max, label, barClass = 'bg-amber-600 dark:bg-amber-400' }: { value: number; max: number; label: string; barClass?: string }) {
  const pct = max ? Math.round((value / max) * 100) : 0
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={`${value} of ${max} complete`}
      className="h-2.5 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800"
    >
      <div className={`h-full rounded-full ${barClass}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function MentorNote({ compact = false }: { compact?: boolean }) {
  return (
    <aside
      aria-label="A note about these lessons"
      className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[0.95rem] text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <InfoIcon className="mt-0.5 shrink-0" />
      <p>
        {compact
          ? 'These lessons are an introduction. Talk them over with a pastor or mentor.'
          : 'These lessons are a friendly introduction, not the final word. They are well worth talking over with a pastor, mentor or a small group at your church, who can answer questions and walk alongside you.'}
      </p>
    </aside>
  )
}

/**
 * An accessible bottom sheet built on the native <dialog> element, which
 * handles focus and the Escape key for us.
 */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      aria-labelledby="sheet-title"
      className="m-0 mt-auto w-full max-w-none bg-transparent p-0 backdrop:bg-black/50 sm:m-auto sm:max-w-lg"
    >
      <div className="safe-bottom rounded-t-3xl bg-white p-6 text-stone-900 sm:rounded-3xl dark:bg-stone-900 dark:text-stone-100">
        <div className="mb-3 flex items-start gap-3">
          <h2 id="sheet-title" className="flex-1 font-serif text-2xl font-semibold">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="-m-2 rounded-full p-2 hover:bg-stone-100 dark:hover:bg-stone-800" aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}

export function ExternalA({ href, children, className = '' }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
      <span className="sr-only"> (opens another website)</span>
    </a>
  )
}
