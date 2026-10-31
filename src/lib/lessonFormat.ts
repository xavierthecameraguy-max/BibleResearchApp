// Reading and checking lesson files. Shared by the app and by
// scripts/check-content.mjs, which runs before every build.

import { parse as parseYaml } from 'yaml'
import { parseReference, type Passage } from './references.ts'

export interface QuizQuestion {
  q: string
  options: string[]
  answer: number
  explain?: string
}

export interface Lesson {
  id: string
  track: string
  order: number
  title: string
  minutes: number
  keyPassage: string
  passage: Passage
  summary: string
  quiz: QuizQuestion[]
  /** "Talk it over" questions for a mentor, small group or journal (optional) */
  discuss: string[]
  /** One small, practical step to try this week (optional) */
  apply?: string
  body: string
}

/** Everything about a lesson except its text */
export type LessonMeta = Omit<Lesson, 'body'>

export const TRACK_IDS = ['big-story', 'bible-origins', 'church-history', 'reading-bible', 'first-steps']

/** Matches [[term]] and [[term|shown text]] */
export const GLOSSARY_LINK = /\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g

/**
 * Parse a lesson file. Returns the lesson and a list of human-readable
 * problems (empty when everything is fine).
 */
export function parseLesson(source: string, fileName: string, glossaryIds?: Set<string>): { lesson?: Lesson; problems: string[] } {
  const problems: string[] = []
  const m = source.replace(/^﻿/, '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!m) return { problems: [`${fileName}: the file must start with a --- header block and end it with ---`] }
  let fm: Record<string, unknown>
  try {
    fm = (parseYaml(m[1]) ?? {}) as Record<string, unknown>
  } catch (e) {
    return { problems: [`${fileName}: the header could not be read (${(e as Error).message.split('\n')[0]})`] }
  }
  const body = m[2].trim()
  const need = (key: string, type: string) => {
    if (typeof fm[key] !== type || (type === 'string' && !(fm[key] as string).trim())) {
      problems.push(`${fileName}: "${key}" is missing or is not a ${type}`)
    }
  }
  need('id', 'string')
  need('track', 'string')
  need('order', 'number')
  need('title', 'string')
  need('minutes', 'number')
  need('keyPassage', 'string')
  need('summary', 'string')
  if (typeof fm.track === 'string' && !TRACK_IDS.includes(fm.track)) {
    problems.push(`${fileName}: track "${fm.track}" should be one of ${TRACK_IDS.join(', ')}`)
  }
  const passage = typeof fm.keyPassage === 'string' ? parseReference(fm.keyPassage) : null
  if (typeof fm.keyPassage === 'string' && !passage) {
    problems.push(`${fileName}: keyPassage "${fm.keyPassage}" is not a Bible reference the app understands`)
  }

  const quiz: QuizQuestion[] = []
  if (!Array.isArray(fm.quiz) || fm.quiz.length < 1) {
    problems.push(`${fileName}: "quiz" needs at least one question`)
  } else {
    fm.quiz.forEach((raw, i) => {
      const q = raw as Record<string, unknown>
      const label = `${fileName}: quiz question ${i + 1}`
      if (typeof q?.q !== 'string') problems.push(`${label} has no "q" (question text)`)
      if (!Array.isArray(q?.options) || q.options.length < 2) problems.push(`${label} needs at least two "options"`)
      else if (typeof q.answer !== 'number' || q.answer < 0 || q.answer >= q.options.length || !Number.isInteger(q.answer)) {
        problems.push(`${label}: "answer" must be a number from 0 to ${q.options.length - 1} (0 = first option)`)
      }
      quiz.push({
        q: String(q?.q ?? ''),
        options: Array.isArray(q?.options) ? q.options.map(String) : [],
        answer: Number(q?.answer ?? 0),
        explain: q?.explain ? String(q.explain) : undefined,
      })
    })
  }

  if (fm.discuss !== undefined && (!Array.isArray(fm.discuss) || fm.discuss.some((d) => typeof d !== 'string'))) {
    problems.push(`${fileName}: "discuss" must be a list of questions`)
  }
  if (fm.apply !== undefined && typeof fm.apply !== 'string') problems.push(`${fileName}: "apply" must be text`)

  if (glossaryIds) {
    for (const g of body.matchAll(GLOSSARY_LINK)) {
      if (!glossaryIds.has(g[1])) problems.push(`${fileName}: glossary term [[${g[1]}]] is not in glossary.json`)
    }
  }
  if (!body) problems.push(`${fileName}: the lesson has no text below the header`)

  if (problems.length) return { problems }
  return {
    lesson: {
      id: fm.id as string,
      track: fm.track as string,
      order: fm.order as number,
      title: fm.title as string,
      minutes: fm.minutes as number,
      keyPassage: fm.keyPassage as string,
      passage: passage!,
      summary: (fm.summary as string).trim(),
      quiz,
      discuss: Array.isArray(fm.discuss) ? (fm.discuss as string[]) : [],
      apply: typeof fm.apply === 'string' ? fm.apply.trim() : undefined,
      body,
    },
    problems,
  }
}
