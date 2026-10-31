// Everything the app remembers (progress, notes, settings) is kept in the
// browser's localStorage under one key. Nothing is sent anywhere.

import { useSyncExternalStore } from 'react'

export const STORAGE_KEY = 'foundations:v1'

export type Theme = 'system' | 'light' | 'dark' | 'sepia'
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

/** A memory verse, reviewed with spaced repetition */
export interface MemoryCard {
  /** "JHN.3.16" or "JHN.3.16-17" */
  key: string
  addedAt: string
  /** Next review date, YYYY-MM-DD */
  due: string
  /** Days until the next review after a good answer */
  interval: number
  ease: number
  reps: number
  lapses: number
}

export interface PrayerItem {
  id: string
  title: string
  details: string
  createdAt: string
  answeredAt?: string
  answerNote?: string
}

export type ReaderFont = 'serif' | 'sans'
export type LineSpacing = 'normal' | 'relaxed' | 'loose'

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
  linkSite: 'biblegateway' | 'youversion' | 'blueletterbible'
  readerFont: ReaderFont
  lineSpacing: LineSpacing
  showVerseNumbers: boolean
  showHeadings: boolean
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
  memory: Record<string, MemoryCard>
  prayers: PrayerItem[]
  /** Days (YYYY-MM-DD) with any reading or study, for the streak */
  activity: string[]
  /** True once the welcome screens have been seen */
  onboarded?: boolean
}

const DEFAULT_STATE: AppState = {
  progress: {},
  notes: [],
  highlights: {},
  verseNotes: {},
  bookmarks: [],
  plans: {},
  memory: {},
  prayers: [],
  activity: [],
  settings: {
    theme: 'system',
    textSize: 'md',
    translation: 'auto',
    compare: ['kjv', 'web'],
    linkVersion: 'NKJV',
    linkSite: 'biblegateway',
    readerFont: 'serif',
    lineSpacing: 'relaxed',
    showVerseNumbers: true,
    showHeadings: true,
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
  recordActivity()
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
  recordActivity()
}

// ---- Daily activity (for the streak) ---------------------------------------

export const todayStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function recordActivity() {
  const t = todayStr()
  if (state.activity.at(-1) === t) return
  setState((s) => ({ ...s, activity: [...s.activity.filter((d) => d !== t), t].slice(-400) }))
}

/** Consecutive days up to today (or yesterday, so the streak isn't lost before you read today). */
export function currentStreak(activity: string[]): number {
  const days = new Set(activity)
  const d = new Date()
  if (!days.has(todayStr(d))) d.setDate(d.getDate() - 1)
  let n = 0
  while (days.has(todayStr(d))) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}

// ---- Memory verses (spaced repetition, a simplified SM-2) ------------------

export function addMemoryCard(key: string) {
  if (state.memory[key]) return
  const card: MemoryCard = { key, addedAt: new Date().toISOString(), due: todayStr(), interval: 0, ease: 2.5, reps: 0, lapses: 0 }
  setState((s) => ({ ...s, memory: { ...s.memory, [key]: card } }))
}

export function removeMemoryCard(key: string) {
  setState((s) => {
    const memory = { ...s.memory }
    delete memory[key]
    return { ...s, memory }
  })
}

export type Recall = 'again' | 'hard' | 'good' | 'easy'

/** Schedule the next review based on how well you remembered. */
export function reviewMemoryCard(key: string, recall: Recall) {
  const c = state.memory[key]
  if (!c) return
  let { interval, ease, reps, lapses } = c
  if (recall === 'again') {
    interval = 0
    lapses++
    reps = 0
    ease = Math.max(1.3, ease - 0.2)
  } else {
    reps++
    if (recall === 'hard') ease = Math.max(1.3, ease - 0.15)
    if (recall === 'easy') ease += 0.15
    if (reps === 1) interval = recall === 'easy' ? 3 : 1
    else if (reps === 2) interval = recall === 'hard' ? 2 : recall === 'easy' ? 7 : 4
    else interval = Math.round(interval * (recall === 'hard' ? 1.2 : recall === 'easy' ? ease * 1.3 : ease))
  }
  const due = new Date()
  due.setDate(due.getDate() + interval)
  setState((s) => ({ ...s, memory: { ...s.memory, [key]: { ...c, interval, ease, reps, lapses, due: todayStr(due) } } }))
  recordActivity()
}

// ---- Prayer journal --------------------------------------------------------

export function savePrayer(item: Omit<PrayerItem, 'id' | 'createdAt'> & { id?: string; createdAt?: string }) {
  const full: PrayerItem = { ...item, id: item.id ?? newId(), createdAt: item.createdAt ?? new Date().toISOString() }
  setState((s) => ({ ...s, prayers: [full, ...s.prayers.filter((p) => p.id !== full.id)] }))
}

export function deletePrayer(id: string) {
  setState((s) => ({ ...s, prayers: s.prayers.filter((p) => p.id !== id) }))
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
    if (!p.done.includes(day)) queueMicrotask(recordActivity)
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

export function finishOnboarding() {
  setState((s) => ({ ...s, onboarded: true }))
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
      memory: { ...s.memory, ...obj<MemoryCard>(data.memory) },
      prayers: Array.isArray(data.prayers)
        ? [...data.prayers.filter((p) => !s.prayers.some((x) => x.id === p.id)), ...s.prayers]
        : s.prayers,
      activity: [...new Set([...s.activity, ...(Array.isArray(data.activity) ? data.activity : [])])].sort().slice(-400),
    }
  })
  return { notes: notes.length, lessons: Object.keys(progress).length }
}

/** All your study notes, verse notes and prayers as readable text (Markdown). */
export function exportNotesText(): string {
  const s = state
  const out: string[] = ['# My Foundations notes', `Exported ${new Date().toLocaleDateString()}`, '']
  if (s.notes.length) {
    out.push('## Passage studies', '')
    for (const n of s.notes) {
      out.push(`### ${n.passageRef}`)
      const labels: Record<keyof StudyAnswers, string> = {
        genre: 'What kind of writing is this?',
        context: 'What comes before and after it?',
        audience: 'What did it mean to the original audience?',
        story: "Where does it fit in the Bible's larger story?",
        today: 'What does it mean for me today?',
      }
      for (const k of Object.keys(labels) as (keyof StudyAnswers)[]) if (n.answers[k]?.trim()) out.push(`**${labels[k]}**`, n.answers[k].trim(), '')
    }
  }
  const vn = Object.entries(s.verseNotes)
  if (vn.length) {
    out.push('## Verse notes', '')
    for (const [k, v] of vn) out.push(`**${k.replace(/\./g, ' ').replace(/ (\d+) (\d+)/, ' $1:$2')}**`, v.text, '')
  }
  if (s.prayers.length) {
    out.push('## Prayer journal', '')
    for (const p of s.prayers) {
      out.push(`- **${p.title}**${p.answeredAt ? ` (answered ${new Date(p.answeredAt).toLocaleDateString()})` : ''}`)
      if (p.details) out.push(`  ${p.details}`)
      if (p.answerNote) out.push(`  Answer: ${p.answerNote}`)
    }
  }
  return out.join('\n')
}

/** Remove everything this app has stored on the device. */
export async function eraseEverything() {
  try {
    localStorage.clear()
    sessionStorage.clear()
  } catch {
    // ignore
  }
  try {
    const { clear } = await import('idb-keyval')
    await clear()
  } catch {
    // ignore
  }
  try {
    for (const k of await caches.keys()) if (k === 'study-data') await caches.delete(k)
  } catch {
    // ignore
  }
  state = { ...DEFAULT_STATE }
  listeners.forEach((l) => l())
}

export function applySettingsToDocument() {
  const { theme, textSize } = state.settings
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.classList.toggle('sepia', theme === 'sepia')
  document.documentElement.dataset.textSize = textSize
}
