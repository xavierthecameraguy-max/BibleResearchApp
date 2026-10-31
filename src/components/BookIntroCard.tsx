import { Link } from 'react-router-dom'
import { getIntro, getLesson } from '../lib/content.ts'

export function BookIntroCard({ bookId }: { bookId: string }) {
  const intro = getIntro(bookId)
  if (!intro) return null
  const lesson = intro.lessonId ? getLesson(intro.lessonId) : undefined
  const rows: [string, string][] = [
    ['Author', intro.author],
    ['Date', intro.date],
    ['Original audience', intro.audience],
    ['Kind of writing', intro.genre],
    ['Where it fits in the big story', intro.storyPlace],
  ]
  return (
    <section aria-label={`About ${intro.name}`} className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
      <p className="text-sm font-semibold uppercase tracking-wide text-stone-600 dark:text-stone-400">
        {intro.testament === 'OT' ? 'Old Testament' : 'New Testament'} · {intro.section}
      </p>
      <p className="mt-2 text-lg leading-relaxed">{intro.summary}</p>
      <dl className="mt-4 space-y-4">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-sm font-semibold text-stone-600 dark:text-stone-400">{k}</dt>
            <dd className="mt-0.5 leading-relaxed">{v}</dd>
          </div>
        ))}
      </dl>
      {lesson && (
        <p className="mt-4">
          Related lesson:{' '}
          <Link to={`/lesson/${lesson.id}`} className="font-semibold text-amber-800 underline underline-offset-2 dark:text-amber-300">
            {lesson.title}
          </Link>
        </p>
      )}
    </section>
  )
}
