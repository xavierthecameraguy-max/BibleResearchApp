// Simple line icons. They're decorative (aria-hidden); every button that
// uses one also has a text label for screen readers.

import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>

function Svg({ children, ...p }: P) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1.5em"
      height="1.5em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...p}
    >
      {children}
    </svg>
  )
}

export const HomeIcon = (p: P) => (
  <Svg {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
    <path d="M10 21v-6h4v6" />
  </Svg>
)
export const LearnIcon = (p: P) => (
  <Svg {...p}>
    <path d="M2 7l10-4 10 4-10 4L2 7z" />
    <path d="M6 9v5c0 1.7 2.7 3 6 3s6-1.3 6-3V9" />
  </Svg>
)
export const BookIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5v-17z" />
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M12 6v6M9 9h6" />
  </Svg>
)
export const PenIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
  </Svg>
)
export const MenuIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </Svg>
)
export const BackIcon = (p: P) => (
  <Svg {...p}>
    <path d="M15 18l-6-6 6-6" />
  </Svg>
)
export const ChevronIcon = (p: P) => (
  <Svg {...p}>
    <path d="M9 18l6-6-6-6" />
  </Svg>
)
export const ExternalIcon = (p: P) => (
  <Svg {...p}>
    <path d="M14 4h6v6" />
    <path d="M20 4l-9 9" />
    <path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
  </Svg>
)
export const CheckIcon = (p: P) => (
  <Svg {...p}>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </Svg>
)
export const CloseIcon = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
)
export const ClockIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
)
export const TimelineIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 3v18" />
    <circle cx="12" cy="7" r="2" />
    <circle cx="12" cy="17" r="2" />
    <path d="M14 7h6M4 17h6" />
  </Svg>
)
export const GlossaryIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 5h11a4 4 0 0 1 4 4v10H8a4 4 0 0 1-4-4V5z" />
    <path d="M8 10h7M8 14h5" />
  </Svg>
)
export const LinkIcon = (p: P) => (
  <Svg {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </Svg>
)
export const NotesIcon = (p: P) => (
  <Svg {...p}>
    <path d="M6 3h9l4 4v14H6z" />
    <path d="M14 3v5h5M9 13h7M9 17h5" />
  </Svg>
)
export const InfoIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </Svg>
)
export const SettingsIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </Svg>
)
export const BookmarkIcon = (p: P) => (
  <Svg {...p}>
    <path d="M6 3h12v18l-6-4-6 4z" />
  </Svg>
)
export const CalendarIcon = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Svg>
)
export const SearchIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </Svg>
)
export const CompareIcon = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="4" width="7" height="16" rx="1.5" />
    <rect x="14" y="4" width="7" height="16" rx="1.5" />
  </Svg>
)
export const BrainIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 4a3 3 0 0 0-5.6 1.5A3 3 0 0 0 4 9a3 3 0 0 0 1 5.2A3 3 0 0 0 9 19a3 3 0 0 0 3-1z" />
    <path d="M12 4a3 3 0 0 1 5.6 1.5A3 3 0 0 1 20 9a3 3 0 0 1-1 5.2A3 3 0 0 1 15 19a3 3 0 0 1-3-1z" />
    <path d="M12 4v14" />
  </Svg>
)
export const PrayIcon = (p: P) => (
  <Svg {...p}>
    <path d="M12 3c-1 2-4 6-4 10v5l-3 3M12 3c1 2 4 6 4 10v5l3 3" />
    <path d="M12 3v15" />
  </Svg>
)
export const LanguageIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 5h8M8 3v2M6 5c0 4 3 7 6 8M10 5c0 3-2 6-6 8" />
    <path d="M13 21l4-9 4 9M14.5 18h5" />
  </Svg>
)
export const PeopleIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M15.5 14.2c3 .4 5.5 2.9 5.5 5.8" />
  </Svg>
)
export const TopicIcon = (p: P) => (
  <Svg {...p}>
    <path d="M4 6h16M4 12h10M4 18h7" />
    <circle cx="18" cy="16" r="3" />
    <path d="M20.2 18.2L22 20" />
  </Svg>
)
