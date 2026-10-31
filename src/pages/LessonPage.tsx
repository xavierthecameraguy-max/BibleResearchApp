import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getLesson, getTrack, nextLessonAfter, previousLessonBefore, trackStyle } from '../lib/content.ts'
import { completeLesson, resetLesson, setLastLesson, useAppState } from '../lib/storage.ts'
import { useTitle } from '../lib/hooks.ts'
import { formatReference } from '../lib/references.ts'
import { LessonMarkdown } from '../components/LessonMarkdown.tsx'
import { PassageText } from '../components/PassageText.tsx'
import { Quiz } from '../components/Quiz.tsx'
import { MentorNote, buttonClass } from '../components/ui.tsx'
import { CheckIcon, ClockIcon } from '../components/Icons.tsx'
import { NotFoundPage } from './NotFoundPage.tsx'
import { speak, speechSupported, stopSpeaking, useSpeaking } from '../lib/speech.ts'
import { getTerm } from '../lib/content.ts'

/** Lesson Markdown as plain sentences for reading aloud. */
function speakable(md: string): string[] {
  return md
    .replace(/\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g, (_m, id: string, label?: string) => label ?? getTerm(id)?.term ?? id)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`>#]/g, '')
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

export function LessonPage() {
  const { lessonId = '' } = useParams()
  const lesson = getLesson(lessonId)
  const progress = useAppState((s) => s.progress[lessonId])
  const [retake, setRetake] = useState(false)
  const speaking = useSpeaking()
  useTitle(lesson?.title ?? 'Not found')

  useEffect(() => {
    if (lesson) setLastLesson(lesson.id)
    setRetake(false)
  }, [lesson])

  if (!lesson) return <NotFoundPage />
  const track = getTrack(lesson.track)!
  const style = trackStyle(lesson.track)
  const next = nextLessonAfter(lesson.id)
  const prev = previousLessonBefore(lesson.id)

  return (
    <article aria-labelledby="lesson-title">
      <Link to={`/learn/${track.id}`} className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${style.chip}`}>
        {track.title} · Lesson {lesson.order}
      </Link>
      <h1 id="lesson-title" className="mt-3 font-serif text-3xl font-semibold leading-tight">
        {lesson.title}
      </h1>
      <p className="mt-2 flex items-center gap-2 text-stone-600 dark:text-stone-400">
        <ClockIcon width="1em" height="1em" />
        <span>{lesson.minutes} minute read</span>
        {progress && (
          <>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
              <CheckIcon width="1em" height="1em" /> Completed
            </span>
          </>
        )}
      </p>

      {speechSupported && (
        <button
          type="button"
          className={buttonClass('secondary', 'mt-4 min-h-11 px-4 py-2 text-[0.95rem]')}
          aria-pressed={speaking}
          onClick={() => (speaking ? stopSpeaking() : speak([lesson.title, lesson.summary, ...speakable(lesson.body)]))}
        >
          {speaking ? 'Stop reading' : 'Listen to this lesson'}
        </button>
      )}

      <div className="mt-5 rounded-2xl bg-stone-100 p-5 dark:bg-stone-900">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600 dark:text-stone-400">In short</h2>
        <p className="mt-2 text-lg leading-relaxed">{lesson.summary}</p>
      </div>

      <div className="mt-6">
        <PassageText passage={lesson.passage} />
      </div>

      <div className="mt-8">
        <LessonMarkdown source={lesson.body} />
      </div>

      <div className="mt-8">
        <Link
          to={`/study/passage?ref=${encodeURIComponent(formatReference(lesson.passage))}`}
          className={buttonClass('secondary', 'w-full')}
        >
          Study {formatReference(lesson.passage)} yourself
        </Link>
      </div>

      {progress && !retake ? (
        <section className="mt-10 rounded-2xl border border-emerald-300 bg-emerald-50 p-5 dark:border-emerald-800 dark:bg-emerald-950/40" aria-label="Lesson complete">
          <p className="flex items-center gap-2 text-lg font-semibold text-emerald-900 dark:text-emerald-200">
            <CheckIcon /> Lesson complete
          </p>
          <p className="mt-1 text-emerald-900 dark:text-emerald-200">
            Quiz score: {progress.quizScore} of {progress.quizTotal}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={buttonClass('secondary')} onClick={() => setRetake(true)}>
              Retake the quiz
            </button>
            <button type="button" className={buttonClass('ghost')} onClick={() => resetLesson(lesson.id)}>
              Mark as not done
            </button>
          </div>
        </section>
      ) : (
        <Quiz
          key={lesson.id + String(retake)}
          questions={lesson.quiz}
          onFinish={(score) => {
            completeLesson(lesson.id, score, lesson.quiz.length)
            setRetake(false)
          }}
        />
      )}

      <div className="mt-8">
        <MentorNote compact />
      </div>

      <nav aria-label="Lessons" className="mt-8 grid gap-3">
        {next && (
          <Link to={`/lesson/${next.id}`} className={buttonClass(progress ? 'primary' : 'secondary', 'w-full')}>
            Next: {next.title}
          </Link>
        )}
        {!next && (
          <Link to="/learn" className={buttonClass('secondary', 'w-full')}>
            Track finished: choose another
          </Link>
        )}
        {prev && (
          <Link to={`/lesson/${prev.id}`} className={buttonClass('ghost', 'w-full')}>
            Previous: {prev.title}
          </Link>
        )}
      </nav>
    </article>
  )
}
