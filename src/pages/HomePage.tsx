import { Link, Navigate } from 'react-router-dom'
import { lessonsInTrack, suggestedLesson, tracks, trackStyle, getTrack, getLesson } from '../lib/content.ts'
import { useAppState } from '../lib/storage.ts'
import { useTitle } from '../lib/hooks.ts'
import { getBook } from '../lib/books.ts'
import { Card, MentorNote, ProgressBar, buttonClass } from '../components/ui.tsx'
import { ClockIcon } from '../components/Icons.tsx'
import { PLANS, todayIndex } from '../lib/plans.ts'
import { formatReference, readerPath } from '../lib/references.ts'
import { VerseOfTheDay } from '../components/VerseOfTheDay.tsx'
import { currentStreak, todayStr } from '../lib/storage.ts'

export function HomePage() {
  useTitle('')
  const progress = useAppState((s) => s.progress)
  const lastLesson = useAppState((s) => s.lastLesson)
  const lastRead = useAppState((s) => s.lastRead)
  const plans = useAppState((s) => s.plans)
  // The plan you're reading now: the first started plan that still has days left.
  const startedPlans = PLANS.filter((p) => plans[p.id])
  const activePlan = startedPlans.find((p) => plans[p.id].done.length < p.days.length) ?? startedPlans[0]
  const activity = useAppState((s) => s.activity)
  const memory = useAppState((s) => s.memory)
  const streak = currentStreak(activity)
  const dueCards = Object.values(memory).filter((c) => c.due <= todayStr()).length
  const onboarded = useAppState((s) => s.onboarded)
  const next = suggestedLesson(progress, lastLesson)
  const doneCount = Object.keys(progress).filter((id) => getLesson(id)).length
  const isNew = doneCount === 0 && !lastLesson

  // First visit (nothing done yet): show the welcome screens.
  if (!onboarded && isNew && !Object.keys(memory).length) return <Navigate to="/welcome" replace />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold leading-tight">{isNew ? 'Welcome' : 'Welcome back'}</h1>
        <p className="mt-2 text-stone-600 dark:text-stone-400">
          {isNew
            ? 'Learn the Bible from the ground up: its big story, how we got it, how the church got here, and how to read it well.'
            : doneCount
              ? `You've completed ${doneCount} lesson${doneCount === 1 ? '' : 's'}. Keep going.`
              : 'Pick up where you left off.'}
        </p>
      </div>

      {(streak > 0 || dueCards > 0) && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4">
            <p className="text-3xl font-semibold">{streak}</p>
            <p className="text-sm text-stone-600 dark:text-stone-400">day{streak === 1 ? '' : 's'} in a row</p>
          </Card>
          <Link to="/memory" className="block rounded-2xl border border-stone-200 bg-white p-4 shadow-sm hover:bg-stone-50 dark:border-stone-800 dark:bg-stone-900 dark:hover:bg-stone-800">
            <p className="text-3xl font-semibold">{dueCards}</p>
            <p className="text-sm text-stone-600 dark:text-stone-400">memory verse{dueCards === 1 ? '' : 's'} to review</p>
          </Link>
        </div>
      )}

      <Link
        to="/today"
        className="flex items-center justify-between gap-3 rounded-2xl bg-amber-700 p-5 text-white shadow-sm hover:bg-amber-800 dark:bg-amber-300 dark:text-stone-950 dark:hover:bg-amber-200"
      >
        <span>
          <span className="block text-xl font-semibold">Start today’s quiet time</span>
          <span className="block text-[0.95rem]">Pray, read, reflect: about 10 minutes</span>
        </span>
        <span aria-hidden="true" className="text-2xl">
          →
        </span>
      </Link>

      <VerseOfTheDay />

      {next ? (
        <Card className={`border-2 ${trackStyle(next.track).ring}`}>
          <p className="text-sm font-semibold uppercase tracking-wide text-stone-600 dark:text-stone-400">
            {isNew ? 'Start here' : 'Suggested next'}
          </p>
          <h2 className="mt-1 font-serif text-2xl font-semibold">{next.title}</h2>
          <p className="mt-1 flex items-center gap-2 text-stone-600 dark:text-stone-400">
            <span>{getTrack(next.track)?.title}</span>
            <span aria-hidden="true">·</span>
            <ClockIcon width="1em" height="1em" />
            <span>{next.minutes} min</span>
          </p>
          <p className="mt-3">{next.summary}</p>
          <Link to={`/lesson/${next.id}`} className={buttonClass('primary', 'mt-5 w-full')}>
            {progress[next.id] ? 'Review lesson' : 'Start lesson'}
          </Link>
        </Card>
      ) : (
        <Card>
          <h2 className="font-serif text-2xl font-semibold">You've finished every lesson!</h2>
          <p className="mt-2">What a journey. Keep reading the Bible, use the Study tool, and explore the Further Resources.</p>
        </Card>
      )}

      {activePlan &&
        (() => {
          const pr = plans[activePlan.id]
          // The next day you haven't ticked off (reading ahead is fine).
          const show = activePlan.days.findIndex((_, i) => !pr.done.includes(i + 1)) + 1
          const day = todayIndex(pr.startedAt, activePlan.days.length)
          if (!show)
            return (
              <Card>
                <p className="text-lg font-semibold">🎉 You finished “{activePlan.title}”!</p>
                <Link to="/plans" className={buttonClass('secondary', 'mt-3 w-full')}>
                  Choose another reading plan
                </Link>
              </Card>
            )
          return (
            <Card>
              <p className="text-sm font-semibold uppercase tracking-wide text-stone-600 dark:text-stone-400">
                Today's reading · {activePlan.title}
              </p>
              <p className="mt-1 font-semibold">
                Day {show}
                {show > day && <span className="font-normal text-stone-600 dark:text-stone-400"> · you're ahead!</span>}
                {show < day && <span className="font-normal text-stone-600 dark:text-stone-400"> · catching up (today is day {day})</span>}
              </p>
              <p className="mt-1 flex flex-wrap gap-x-3">
                {activePlan.days[show - 1].map((p) => (
                  <Link key={formatReference(p)} to={readerPath(p)} className="inline-flex min-h-11 items-center text-lg text-amber-800 underline underline-offset-2 dark:text-amber-300">
                    {formatReference(p)}
                  </Link>
                ))}
              </p>
              <Link to="/plans" className="inline-flex min-h-11 items-center text-sm underline underline-offset-2">
                Open plan
              </Link>
            </Card>
          )
        })()}

      <section aria-labelledby="progress-title">
        <h2 id="progress-title" className="mb-3 font-serif text-2xl font-semibold">
          Your progress
        </h2>
        <ul className="space-y-3">
          {tracks.map((t) => {
            const all = lessonsInTrack(t.id)
            const done = all.filter((l) => progress[l.id]).length
            return (
              <li key={t.id}>
                <Link
                  to={`/learn/${t.id}`}
                  className="block rounded-2xl border border-stone-200 bg-white p-4 hover:bg-stone-50 dark:border-stone-800 dark:bg-stone-900 dark:hover:bg-stone-800"
                >
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <span className="font-semibold">{t.title}</span>
                    <span className="text-sm text-stone-600 dark:text-stone-400">
                      {done} / {all.length}
                    </span>
                  </div>
                  <ProgressBar value={done} max={all.length} label={`${t.title} progress`} barClass={trackStyle(t.id).bar} />
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Link to={lastRead ? `/bible/${lastRead.book}/${lastRead.chapter}` : '/bible'} className={buttonClass('secondary')}>
          {lastRead ? `${getBook(lastRead.book)?.name} ${lastRead.chapter}` : 'Read the Bible'}
        </Link>
        <Link to="/timeline" className={buttonClass('secondary')}>
          Timeline
        </Link>
        {!activePlan && (
          <Link to="/plans" className={buttonClass('secondary')}>
            Reading plans
          </Link>
        )}
        <Link to="/my-bible" className={buttonClass('secondary')}>
          My Bible
        </Link>
      </div>

      <MentorNote />
    </div>
  )
}
