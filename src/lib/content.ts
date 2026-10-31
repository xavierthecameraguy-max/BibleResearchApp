// Loads everything in /content at build time. Edit the files there, not here.

import tracksJson from '../../content/tracks.json'
import glossaryJson from '../../content/glossary.json'
import timelineJson from '../../content/timeline.json'
import introsJson from '../../content/book-intros.json'
import resourcesJson from '../../content/resources.json'
import votdJson from '../../content/verses-of-the-day.json'
import { lessonMeta, bodies } from 'virtual:lessons'
import type { LessonMeta } from './lessonFormat.ts'

export type { QuizQuestion } from './lessonFormat.ts'
/** A lesson's details; its text is loaded separately with loadLessonBody(). */
export type Lesson = LessonMeta

export interface Track {
  id: string
  title: string
  tagline: string
  description: string
  color: string
}

export interface GlossaryTerm {
  id: string
  term: string
  definition: string
}

export interface TimelineEvent {
  id: string
  year: number
  when: string
  title: string
  description: string
  kind: 'biblical' | 'church'
  lessonId?: string
}

export interface BookIntro {
  id: string
  name: string
  testament: 'OT' | 'NT'
  section: string
  author: string
  date: string
  audience: string
  genre: string
  storyPlace: string
  summary: string
  lessonId?: string
}

export interface Resource {
  title: string
  by?: string
  url: string
  description: string
  tag?: string
}

export interface Resources {
  intro: string
  sections: { title: string; intro?: string; items: Resource[] }[]
}

export const tracks = tracksJson as Track[]
export const glossary = (glossaryJson as GlossaryTerm[]).slice().sort((a, b) => a.term.localeCompare(b.term))
export const timeline = (timelineJson as TimelineEvent[]).slice().sort((a, b) => a.year - b.year)
export const bookIntros = introsJson as BookIntro[]
export const resources = resourcesJson as Resources
export const versesOfTheDay = votdJson as string[]

export const lessons: Lesson[] = (lessonMeta as Lesson[])
  .slice()
  .sort((a, b) => tracks.findIndex((t) => t.id === a.track) - tracks.findIndex((t) => t.id === b.track) || a.order - b.order)

const bodyCache = new Map<string, Promise<string>>()
/** A lesson's text (Markdown), loaded when the lesson is opened. */
export function loadLessonBody(id: string): Promise<string> {
  let p = bodyCache.get(id)
  if (!p) {
    const load = (bodies as Record<string, () => Promise<{ default: string }>>)[id]
    p = load ? load().then((m) => m.default) : Promise.resolve('')
    p.catch(() => bodyCache.delete(id))
    bodyCache.set(id, p)
  }
  return p
}

const lessonById = new Map(lessons.map((l) => [l.id, l]))
const termById = new Map(glossary.map((g) => [g.id, g]))
const introById = new Map(bookIntros.map((b) => [b.id, b]))

export const getLesson = (id: string) => lessonById.get(id)
export const getTerm = (id: string) => termById.get(id)
export const getIntro = (id: string) => introById.get(id)
export const getTrack = (id: string) => tracks.find((t) => t.id === id)
export const lessonsInTrack = (trackId: string) => lessons.filter((l) => l.track === trackId)

export function nextLessonAfter(id: string): Lesson | undefined {
  const l = getLesson(id)
  if (!l) return undefined
  const inTrack = lessonsInTrack(l.track)
  return inTrack[inTrack.indexOf(l) + 1]
}

export function previousLessonBefore(id: string): Lesson | undefined {
  const l = getLesson(id)
  if (!l) return undefined
  const inTrack = lessonsInTrack(l.track)
  return inTrack[inTrack.indexOf(l) - 1]
}

/**
 * The suggested next lesson: continue the track you were last in, otherwise
 * the first unfinished lesson in track order.
 */
export function suggestedLesson(completed: Record<string, unknown>, lastLesson?: string): Lesson | undefined {
  if (lastLesson) {
    const last = getLesson(lastLesson)
    if (last) {
      if (!completed[last.id]) return last
      const next = lessonsInTrack(last.track).find((l) => !completed[l.id])
      if (next) return next
    }
  }
  return lessons.find((l) => !completed[l.id])
}

/** Color classes for each track (kept here so Tailwind sees them). */
export const TRACK_STYLES: Record<string, { bar: string; chip: string; ring: string }> = {
  amber: {
    bar: 'bg-amber-600 dark:bg-amber-400',
    chip: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
    ring: 'border-amber-300 dark:border-amber-700',
  },
  sky: {
    bar: 'bg-sky-600 dark:bg-sky-400',
    chip: 'bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200',
    ring: 'border-sky-300 dark:border-sky-700',
  },
  emerald: {
    bar: 'bg-emerald-600 dark:bg-emerald-400',
    chip: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200',
    ring: 'border-emerald-300 dark:border-emerald-700',
  },
  rose: {
    bar: 'bg-rose-600 dark:bg-rose-400',
    chip: 'bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-200',
    ring: 'border-rose-300 dark:border-rose-700',
  },
  violet: {
    bar: 'bg-violet-600 dark:bg-violet-400',
    chip: 'bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-200',
    ring: 'border-violet-300 dark:border-violet-700',
  },
}

export const trackStyle = (trackId: string) => TRACK_STYLES[getTrack(trackId)?.color ?? 'amber'] ?? TRACK_STYLES.amber
