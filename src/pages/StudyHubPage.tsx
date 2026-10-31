// The Study tab: every study tool in one place.

import { Link } from 'react-router-dom'
import { useTitle } from '../lib/hooks.ts'
import { todayStr, useAppState } from '../lib/storage.ts'
import { PageTitle } from '../components/ui.tsx'
import {
  BookmarkIcon,
  BrainIcon,
  CompareIcon,
  GlossaryIcon,
  NotesIcon,
  PenIcon,
  PrayIcon,
  SearchIcon,
  TimelineIcon,
} from '../components/Icons.tsx'
import { STUDY_EXTRA_TOOLS } from '../lib/studyTools.ts'

export function StudyHubPage() {
  useTitle('Study')
  const memory = useAppState((s) => s.memory)
  const notes = useAppState((s) => s.notes)
  const prayers = useAppState((s) => s.prayers)
  const due = Object.values(memory).filter((c) => c.due <= todayStr()).length

  const tools = [
    { to: '/study/passage', label: 'Study a passage', desc: 'Five guided questions, saved as notes', icon: PenIcon },
    ...STUDY_EXTRA_TOOLS,
    { to: '/memory', label: 'Memory verses', desc: due ? `${due} to review today` : 'Learn verses by heart', icon: BrainIcon },
    { to: '/notes', label: 'Study notes', desc: `${notes.length} saved`, icon: NotesIcon },
    { to: '/my-bible', label: 'My Bible', desc: 'Highlights, bookmarks and verse notes', icon: BookmarkIcon },
    { to: '/prayer', label: 'Prayer journal', desc: `${prayers.filter((p) => !p.answeredAt).length} open`, icon: PrayIcon },
    { to: '/compare', label: 'Compare translations', desc: 'One passage, several translations', icon: CompareIcon },
    { to: '/search', label: 'Search the Bible', desc: 'Any word or phrase', icon: SearchIcon },
    { to: '/timeline', label: 'Timeline', desc: 'Abraham to today', icon: TimelineIcon },
    { to: '/glossary', label: 'Glossary', desc: 'Key words explained', icon: GlossaryIcon },
  ]

  return (
    <div>
      <PageTitle sub="Tools for digging deeper into any passage.">Study</PageTitle>
      <ul className="grid grid-cols-2 gap-3">
        {tools.map(({ to, label, desc, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              className="flex h-full min-h-32 flex-col gap-2 rounded-2xl border border-stone-200 bg-white p-4 hover:bg-stone-50 dark:border-stone-800 dark:bg-stone-900 dark:hover:bg-stone-800"
            >
              <Icon className="text-amber-700 dark:text-amber-300" />
              <span className="font-semibold leading-snug">{label}</span>
              <span className="text-sm text-stone-600 dark:text-stone-400">{desc}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
