// Study tools powered by the offline datasets (added as each dataset lands).

import type { SVGProps } from 'react'
import { LanguageIcon } from '../components/Icons.tsx'

export interface StudyTool {
  to: string
  label: string
  desc: string
  icon: (p: SVGProps<SVGSVGElement>) => React.JSX.Element
}

export const STUDY_EXTRA_TOOLS: StudyTool[] = [
  { to: '/words', label: 'Word study', desc: 'Hebrew and Greek behind the English', icon: LanguageIcon },
]
