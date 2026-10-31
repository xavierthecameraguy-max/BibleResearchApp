import { Link, useParams } from 'react-router-dom'
import { getTrack, lessonsInTrack, trackStyle } from '../lib/content.ts'
import { useAppState } from '../lib/storage.ts'
import { useTitle } from '../lib/hooks.ts'
import { PageTitle, ProgressBar } from '../components/ui.tsx'
import { CheckIcon } from '../components/Icons.tsx'
import { NotFoundPage } from './NotFoundPage.tsx'

export function TrackPage() {
  const { trackId = '' } = useParams()
  const track = getTrack(trackId)
  const progress = useAppState((s) => s.progress)
  useTitle(track?.title ?? 'Not found')
  if (!track) return <NotFoundPage />
  const all = lessonsInTrack(track.id)
  const done = all.filter((l) => progress[l.id]).length
  const style = trackStyle(track.id)

  return (
    <div>
      <PageTitle sub={track.description}>{track.title}</PageTitle>
      <div className="mb-6 flex items-center gap-3">
        <ProgressBar value={done} max={all.length} label={`${track.title} progress`} barClass={style.bar} />
        <span className="shrink-0 text-sm text-stone-600 dark:text-stone-400">
          {done} of {all.length} done
        </span>
      </div>
      <ol className="space-y-3">
        {all.map((l) => {
          const p = progress[l.id]
          return (
            <li key={l.id}>
              <Link
                to={`/lesson/${l.id}`}
                className="flex items-start gap-4 rounded-2xl border border-stone-200 bg-white p-4 hover:bg-stone-50 dark:border-stone-800 dark:bg-stone-900 dark:hover:bg-stone-800"
              >
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-full text-base font-semibold ${
                    p ? style.bar + ' text-white dark:text-stone-950' : 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
                  }`}
                  aria-hidden="true"
                >
                  {p ? <CheckIcon width="1.2em" height="1.2em" /> : l.order}
                </span>
                <span className="flex-1">
                  <span className="block font-semibold">{l.title}</span>
                  <span className="block text-sm text-stone-600 dark:text-stone-400">
                    {l.keyPassage} · {l.minutes} min
                    {p && ` · Quiz ${p.quizScore}/${p.quizTotal}`}
                  </span>
                  <span className="sr-only">{p ? 'Completed' : 'Not started'}</span>
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
