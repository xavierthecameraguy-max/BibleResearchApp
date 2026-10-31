import { useEffect, useRef, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { BackIcon, BookIcon, HomeIcon, LearnIcon, MenuIcon, PenIcon } from './Icons.tsx'
import { useOnline } from '../lib/hooks.ts'
import { UpdateBanner } from './UpdateBanner.tsx'

/** Pages that belong to the Study tab */
const STUDY_PATHS = ['/study', '/notes', '/memory', '/prayer', '/my-bible', '/words', '/word/', '/dictionary', '/topics', '/people', '/places', '/map', '/commentary']

const TABS = [
  { to: '/', label: 'Home', icon: HomeIcon, match: (p: string) => p === '/' },
  { to: '/learn', label: 'Learn', icon: LearnIcon, match: (p: string) => p.startsWith('/learn') || p.startsWith('/lesson') },
  { to: '/bible', label: 'Bible', icon: BookIcon, match: (p: string) => ['/bible', '/compare', '/search'].some((x) => p.startsWith(x)) },
  {
    to: '/study',
    label: 'Study',
    icon: PenIcon,
    match: (p: string) => STUDY_PATHS.some((x) => p.startsWith(x)),
  },
  {
    to: '/more',
    label: 'More',
    icon: MenuIcon,
    match: (p: string) => p !== '/' && !['/learn', '/lesson', '/bible', '/compare', '/search', ...STUDY_PATHS].some((x) => p.startsWith(x)),
  },
]

export function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const online = useOnline()
  const mainRef = useRef<HTMLElement>(null)
  const isTop = TABS.some((t) => t.to === pathname)

  // On every page change, scroll to the top and move focus to the page so
  // screen readers announce the new content.
  useEffect(() => {
    window.scrollTo(0, 0)
    mainRef.current?.focus({ preventScroll: true })
  }, [pathname])

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <UpdateBanner />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-amber-200 focus:px-4 focus:py-2 focus:text-stone-950"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-20 flex min-h-14 items-center gap-2 border-b border-stone-200 bg-stone-50/95 px-3 pt-[env(safe-area-inset-top)] backdrop-blur dark:border-stone-800 dark:bg-stone-950/95">
        {!isTop ? (
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
            className="flex min-h-12 items-center gap-1 rounded-xl px-2 text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            <BackIcon />
            <span>Back</span>
          </button>
        ) : (
          <span className="px-2 font-serif text-xl font-semibold tracking-tight">Foundations</span>
        )}
        <span className="flex-1" />
        {!online && (
          <span className="rounded-full bg-stone-200 px-3 py-1 text-sm text-stone-700 dark:bg-stone-800 dark:text-stone-300" role="status">
            Offline
          </span>
        )}
      </header>

      <main id="main" ref={mainRef} tabIndex={-1} className="flex-1 px-4 pb-32 pt-5 outline-none">
        {children}
      </main>

      <nav
        aria-label="Main"
        className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/95 backdrop-blur dark:border-stone-800 dark:bg-stone-900/95"
      >
        <ul className="mx-auto flex max-w-2xl">
          {TABS.map(({ to, label, icon: Icon, match }) => {
            const active = match(pathname)
            return (
              <li key={to} className="flex-1">
                <NavLink
                  to={to}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-16 flex-col items-center justify-center gap-0.5 text-[0.8rem] font-medium ${
                    active ? 'text-amber-800 dark:text-amber-300' : 'text-stone-600 dark:text-stone-400'
                  }`}
                >
                  <Icon />
                  {label}
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
