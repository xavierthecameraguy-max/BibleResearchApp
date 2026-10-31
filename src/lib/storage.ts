// Everything the app remembers (progress, notes, settings) is kept in the
// browser's localStorage under one key. Nothing is sent anywhere.

import { useSyncExternalStore } from 'react'

export const STORAGE_KEY = 'foundations:v1'

export type Theme = 'system' | 'light' | 'dark'
export type TextSize = 'md' | 'lg' | 'xl'

export interface LessonProgress {
  completedAt: string
  quizScore: number
  quizTotal: number
}

export interface StudyAnswers {
  genre: string
  context: string
  audience: string
  story: string
  today: string
}

export interface Note {
  id: string
  passageRef: string
  answers: StudyAnswers
  createdAt: string
  updatedAt: string
}

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple'

/** A verse note: keyed like "JHN.3.16" */
export interface VerseNote {
  text: string
  updatedAt: string
}

export interface Bookmark {
  /** "JHN.3.16" or a range "JHN.3.16-18" */
  key: string
  createdAt: string
}

export interface PlanProgress {
  planId: string
  startedAt: string
  /** Day numbers (1-based) marked done */
  done: number[]
}

export interface Settings {
  theme: Theme
  textSize: TextSize
  /**
   * Translation id, e.g. "kjv", "web", "nkjv" or an imported one like
   * "user-nkjv". "auto" picks the NKJV when it's available, otherwise the KJV.
   */
  translation: string
  /** Translations shown side by side in Compare */
  compare: string[]
  /** The translation used for "Open in …" links to other Bible sites */
  linkVersion: string
  /** Which site those links go to */
  linkSite: 'biblegateway' | 'youversion'
}

export interface AppState {
  progress: Record<string, LessonProgress>
  notes: Note[]
  settings: Settings
  lastRead?: { book: string; chapter: number }
  lastLesson?: string
  /** Verse key ("JHN.3.16") → highlight colour */
  highlights: Record<string, HighlightColor>
  /** Verse key → personal note */
  verseNotes: Record<string, VerseNote>
  bookmarks: Bookmark[]
  plans: Record<string, PlanProgress>
}

const DEFAULT_STATE: AppState = {
  progress: {},
  notes: [],
  highlights: {},
  verseNotes: {},
  bookmarks: [],
  plans: {},
  settings: {
    theme: 'system',
    textSize: 'md',
    translation: 'auto',
    compare: ['kjv', 'web'],
    linkVersion: 'NKJV',
    linkSite: 'biblegateway',
  },
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STATE
    const parsed = JSON.parse(raw) as Partial<AppState>
    return {
      ...DEFAULT_STATE,
      ...parsed,
      settings: { ...DEFAULT_STATE.settings, ...parsed.settings },
    }
  } catch {
    return DEFAULT_STATE
  }
}

let state: AppState = load()
const listeners = new Set<() => void>()

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage can be full or blocked (e.g. private browsing). The app keeps
    // working for this visit; it just can't remember.
  }
}

export function getState(): AppState {
  return state
}

export function setState(update: (s: AppState) => AppState) {
  state = update(state)
  save()
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// Keep several open tabs in sync.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      state = load()
      listeners.forEach((l) => l())
    }
  })
}

export function useAppState<T>(select: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => select(state))
}

// ---- Actions ---------------------------------------------------------------

export function completeLesson(id: string, quizScore: number, quizTotal: number) {
  setState((s) => ({
    ...s,
    progress: { ...s.progress, [id]: { completedAt: new Date().toISOString(), quizScore, quizTotal } },
  }))
}

export function resetLesson(id: string) {
  setState((s) => {
    const progress = { ...s.progress }
    delete progress[id]
    return { ...s, progress }
  })
}

export function setLastLesson(id: string) {
  if (state.lastLesson !== id) setState((s) => ({ ...s, lastLesson: id }))
}

export function setLastRead(book: string, chapter: number) {
  setState((s) => ({ ...s, lastRead: { book, chapter } }))
}

export function updateSettings(patch: Partial<Settings>) {
  setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }))
  applySettingsToDocument()
}

export function saveNote(note: Omit<Note, 'createdAt' | 'updatedAt'> & { createdAt?: string }): Note {
  const now = new Date().toISOString()
  const full: Note = { ...note, createdAt: note.createdAt ?? now, updatedAt: now }
  setState((s) => {
    const others = s.notes.filter((n) => n.id !== note.id)
    return { ...s, notes: [full, ...others] }
  })
  return full
}

export function deleteNote(id: string) {
  setState((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) }))
}

// ---- Verse highlights, notes and bookmarks ---------------------------------

export const verseKey = (book: string, chapter: number, verse: number) => `${book}.${chapter}.${verse}`

export function setHighlight(keys: string[], color: HighlightColor | null) {
  setState((s) => {
    const highlights = { ...s.highlights }
    for (const k of keys) {
      if (color) highlights[k] = color
      else delete highlights[k]
    }
    return { ...s, highlights }
  })
}

export function setVerseNote(key: string, text: string) {
  setState((s) => {
    const verseNotes = { ...s.verseNotes }
    if (text.trim()) verseNotes[key] = { text, updatedAt: new Date().toISOString() }
    else delete verseNotes[key]
    return { ...s, verseNotes }
  })
}

export function toggleBookmark(key: string) {
  setState((s) => {
    const has = s.bookmarks.some((b) => b.key === key)
    return {
      ...s,
      bookmarks: has ? s.bookmarks.filter((b) => b.key !== key) : [{ key, createdAt: new Date().toISOString() }, ...s.bookmarks],
    }
  })
}

// ---- Reading plans ---------------------------------------------------------

export function startPlan(planId: string) {
  setState((s) => ({ ...s, plans: { ...s.plans, [planId]: { planId, startedAt: new Date().toISOString(), done: [] } } }))
}

export function togglePlanDay(planId: string, day: number) {
  setState((s) => {
    const p = s.plans[planId]
    if (!p) return s
    const done = p.done.includes(day) ? p.done.filter((d) => d !== day) : [...p.done, day].sort((a, b) => a - b)
    return { ...s, plans: { ...s.plans, [planId]: { ...p, done } } }
  })
}

export function stopPlan(planId: string) {
  setState((s) => {
    const plans = { ...s.plans }
    delete plans[planId]
    return { ...s, plans }
  })
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

/** Everything saved, as a file the user can keep as a backup. */
export function exportBackup(): string {
  return JSON.stringify({ app: 'foundations', version: 1, exportedAt: new Date().toISOString(), data: state }, null, 2)
}

/** Restore a backup file. Notes are merged; progress, highlights and the like from the file win. */
export function importBackup(text: string): { notes: number; lessons: number } {
  const parsed = JSON.parse(text)
  const data: Partial<AppState> | undefined = parsed?.app === 'foundations' ? parsed.data : undefined
  if (!data || typeof data !== 'object') throw new Error('This does not look like a Foundations backup file.')
  const notes = Array.isArray(data.notes) ? data.notes : []
  const progress = data.progress && typeof data.progress === 'object' ? data.progress : {}
  setState((s) => {
    const byId = new Map(s.notes.map((n) => [n.id, n]))
    for (const n of notes) if (n && n.id && n.answers) byId.set(n.id, n)
    const obj = <T,>(x: unknown): Record<string, T> => (x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, T>) : {})
    const marks = new Map(s.bookmarks.map((b) => [b.key, b]))
    for (const b of Array.isArray(data.bookmarks) ? data.bookmarks : []) if (b?.key) marks.set(b.key, b)
    return {
      ...s,
      progress: { ...s.progress, ...progress },
      notes: [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      highlights: { ...s.highlights, ...obj<HighlightColor>(data.highlights) },
      verseNotes: { ...s.verseNotes, ...obj<VerseNote>(data.verseNotes) },
      bookmarks: [...marks.values()],
      plans: { ...s.plans, ...obj<PlanProgress>(data.plans) },
    }
  })
  return { notes: notes.length, lessons: Object.keys(progress).length }
}

export function applySettingsToDocument() {
  const { theme, textSize } = state.settings
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.dataset.textSize = textSize
}
