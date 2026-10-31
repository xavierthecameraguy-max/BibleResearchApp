import { useTitle } from '../lib/hooks.ts'
import { PageTitle, RowLink } from '../components/ui.tsx'
import { BrainIcon, PrayIcon, BookmarkIcon, CalendarIcon, CompareIcon, SearchIcon, GlossaryIcon, InfoIcon, LinkIcon, NotesIcon, SettingsIcon, TimelineIcon } from '../components/Icons.tsx'

const ITEMS = [
  { to: '/my-bible', label: 'My Bible', desc: 'Your bookmarks, highlights and verse notes', icon: BookmarkIcon },
  { to: '/plans', label: 'Reading plans', desc: 'Read through the Bible, the New Testament or the Gospels', icon: CalendarIcon },
  { to: '/memory', label: 'Memory verses', desc: 'Learn verses by heart with spaced repetition', icon: BrainIcon },
  { to: '/prayer', label: 'Prayer journal', desc: 'What you’re praying for, and how God answered', icon: PrayIcon },
  { to: '/search', label: 'Search', desc: 'Find any word or phrase in the Bible', icon: SearchIcon },
  { to: '/compare', label: 'Compare translations', desc: 'See a passage in several translations', icon: CompareIcon },
  { to: '/timeline', label: 'Timeline', desc: 'Bible and church history, from Abraham to today', icon: TimelineIcon },
  { to: '/glossary', label: 'Glossary', desc: 'Key words explained simply', icon: GlossaryIcon },
  { to: '/notes', label: 'Notes', desc: 'Your saved passage studies', icon: NotesIcon },
  { to: '/resources', label: 'Further resources', desc: 'BibleProject, BiblicalTraining.org and books', icon: LinkIcon },
  { to: '/settings', label: 'Settings', desc: 'Text size, dark mode, translations', icon: SettingsIcon },
  { to: '/about', label: 'About', desc: 'Privacy, sources and a note on these lessons', icon: InfoIcon },
]

export function MorePage() {
  useTitle('More')
  return (
    <div>
      <PageTitle>More</PageTitle>
      <ul className="divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white dark:divide-stone-800 dark:border-stone-800 dark:bg-stone-900">
        {ITEMS.map(({ to, label, desc, icon: Icon }) => (
          <li key={to}>
            <RowLink to={to}>
              <span className="flex items-center gap-4">
                <Icon className="shrink-0 text-stone-500" />
                <span>
                  <span className="block font-semibold">{label}</span>
                  <span className="block text-sm text-stone-600 dark:text-stone-400">{desc}</span>
                </span>
              </span>
            </RowLink>
          </li>
        ))}
      </ul>
    </div>
  )
}
