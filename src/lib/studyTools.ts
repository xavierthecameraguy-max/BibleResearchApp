// Study tools powered by the offline datasets (added as each dataset lands).

import type { SVGProps } from 'react'
import { GlossaryIcon, LanguageIcon, NotesIcon, PeopleIcon, TopicIcon } from '../components/Icons.tsx'

export interface StudyTool {
  to: string
  label: string
  desc: string
  icon: (p: SVGProps<SVGSVGElement>) => React.JSX.Element
}

export const STUDY_EXTRA_TOOLS: StudyTool[] = [
  { to: '/words', label: 'Word study', desc: 'Hebrew and Greek behind the English', icon: LanguageIcon },
  { to: '/dictionary', label: 'Bible dictionary', desc: 'Easton’s, Smith’s and Bible names', icon: GlossaryIcon },
  { to: '/commentary', label: 'Commentary', desc: 'Matthew Henry’s classic notes', icon: NotesIcon },
  { to: '/topics', label: 'Topical Bible', desc: 'What the Bible says about…', icon: TopicIcon },
  { to: '/people', label: 'People and places', desc: 'Family trees, maps and every mention', icon: PeopleIcon },
]
