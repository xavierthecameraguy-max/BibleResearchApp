import { Link } from 'react-router-dom'
import { lessonsInTrack, tracks, trackStyle } from '../lib/content.ts'
import { useAppState } from '../lib/storage.ts'
import { useTitle } from '../lib/hooks.ts'
import { PageTitle, ProgressBar } from '../components/ui.tsx'

export function LearnPage() {
  useTitle('Learn')
  const progress = useAppState((s) => s.progress)
  return (
    <div>
      <PageTitle sub={`${tracks.length} tracks. Each lesson takes about five to seven minutes and ends with a few questions.`}>Learn</PageTitle>
      <ul className="space-y-4">
        {tracks.map((t, i) => {
          const all = lessonsInTrack(t.id)
          const done = all.filter((l) => progress[l.id]).length
          const style = trackStyle(t.id)
          return (
            <li key={t.id}>
              <Link
                to={`/learn/${t.id}`}
                className="block rounded-2xl border border-stone-200 bg-white p-5 hover:bg-stone-50 dark:border-stone-800 dark:bg-stone-900 dark:hover:bg-stone-800"
              >
                <span className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${style.chip}`}>Track {i + 1}</span>
                <h2 className="mt-2 font-serif text-2xl font-semibold">{t.title}</h2>
                <p className="mt-1 text-stone-600 dark:text-stone-400">{t.description}</p>
                <div className="mt-4 flex items-center gap-3">
                  <ProgressBar value={done} max={all.length} label={`${t.title} progress`} barClass={style.bar} />
                  <span className="shrink-0 text-sm text-stone-600 dark:text-stone-400">
                    {done}/{all.length}
                  </span>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
