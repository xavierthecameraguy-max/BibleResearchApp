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

export interface Settings {
  theme: Theme
  textSize: TextSize
  /**
   * Translation id, e.g. "kjv", "web", "nkjv" (built in from your own file)
   * or an imported one like "user-nkjv". "auto" picks your built-in private
   * translation if there is one, otherwise the KJV.
   */
  translation: string
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
}

const DEFAULT_STATE: AppState = {
  progress: {},
  notes: [],
  settings: { theme: 'system', textSize: 'md', translation: 'auto', linkVersion: 'NKJV', linkSite: 'biblegateway' },
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

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

/** Everything saved, as a file the user can keep as a backup. */
export function exportBackup(): string {
  return JSON.stringify({ app: 'foundations', version: 1, exportedAt: new Date().toISOString(), data: state }, null, 2)
}

/** Restore a backup file. Notes are merged; progress from the file wins. */
export function importBackup(text: string): { notes: number; lessons: number } {
  const parsed = JSON.parse(text)
  const data: Partial<AppState> | undefined = parsed?.app === 'foundations' ? parsed.data : undefined
  if (!data || typeof data !== 'object') throw new Error('This does not look like a Foundations backup file.')
  const notes = Array.isArray(data.notes) ? data.notes : []
  const progress = data.progress && typeof data.progress === 'object' ? data.progress : {}
  setState((s) => {
    const byId = new Map(s.notes.map((n) => [n.id, n]))
    for (const n of notes) if (n && n.id && n.answers) byId.set(n.id, n)
    return {
      ...s,
      progress: { ...s.progress, ...progress },
      notes: [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
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
