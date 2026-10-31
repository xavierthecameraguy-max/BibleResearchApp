import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PLANS, todayIndex, type Plan } from '../lib/plans.ts'
import { formatReference, readerPath } from '../lib/references.ts'
import { startPlan, stopPlan, togglePlanDay, useAppState } from '../lib/storage.ts'
import { useTitle } from '../lib/hooks.ts'
import { Card, PageTitle, ProgressBar, buttonClass } from '../components/ui.tsx'
import { CheckIcon } from '../components/Icons.tsx'

function ActivePlan({ plan }: { plan: Plan }) {
  const progress = useAppState((s) => s.plans[plan.id])!
  const today = todayIndex(progress.startedAt, plan.days.length)
  const [showAll, setShowAll] = useState(false)
  const firstUndone = plan.days.findIndex((_, i) => !progress.done.includes(i + 1)) + 1 || plan.days.length
  const focus = firstUndone
  const visible = showAll ? plan.days.map((_, i) => i + 1) : [focus, focus + 1, focus + 2].filter((d) => d <= plan.days.length)

  return (
    <Card className="border-2 border-amber-300 dark:border-amber-700">
      <h2 className="font-serif text-2xl font-semibold">{plan.title}</h2>
      <p className="mt-1 text-stone-600 dark:text-stone-400">
        Day {today} of {plan.days.length} · {progress.done.length} done
      </p>
      <div className="mt-3">
        <ProgressBar value={progress.done.length} max={plan.days.length} label={`${plan.title} progress`} />
      </div>
      <ol className="mt-4 space-y-2">
        {visible.map((day) => {
          const done = progress.done.includes(day)
          return (
            <li key={day} className="flex items-start gap-3 rounded-xl bg-stone-50 p-3 dark:bg-stone-800/50">
              <button
                type="button"
                id={`plan-${plan.id}-day-${day}`}
                onClick={() => {
                  togglePlanDay(plan.id, day)
                  // The list moves on to the next unread day; keep focus on a day button.
                  setTimeout(() => {
                    const el =
                      document.getElementById(`plan-${plan.id}-day-${day}`) ?? document.getElementById(`plan-${plan.id}-day-${day + 1}`)
                    el?.focus()
                  }, 0)
                }}
                aria-pressed={done}
                aria-label={`Mark day ${day} ${done ? 'not done' : 'done'}`}
                className={`flex size-9 shrink-0 items-center justify-center rounded-full border-2 ${
                  done ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-400 dark:bg-emerald-500' : 'border-stone-400'
                }`}
              >
                {done && <CheckIcon width="1.1em" height="1.1em" />}
              </button>
              <div>
                <p className="font-semibold">
                  Day {day}
                  {day === today && <span className="ml-2 rounded-full bg-amber-100 px-2 text-sm text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">Today</span>}
                </p>
                <p className="flex flex-wrap gap-x-3">
                  {plan.days[day - 1].map((p) => (
                    <Link key={formatReference(p)} to={readerPath(p)} className="text-amber-800 underline underline-offset-2 dark:text-amber-300">
                      {formatReference(p)}
                    </Link>
                  ))}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={buttonClass('secondary')} onClick={() => setShowAll((s) => !s)}>
          {showAll ? 'Show fewer days' : 'Show all days'}
        </button>
        <button
          type="button"
          className={buttonClass('ghost')}
          onClick={() => {
            if (confirm(`Stop "${plan.title}"? Your ticks for this plan will be cleared.`)) stopPlan(plan.id)
          }}
        >
          Stop plan
        </button>
      </div>
    </Card>
  )
}

export function PlansPage() {
  useTitle('Reading plans')
  const active = useAppState((s) => s.plans)
  const running = PLANS.filter((p) => active[p.id])
  const others = PLANS.filter((p) => !active[p.id])
  return (
    <div className="space-y-5">
      <PageTitle sub="A little each day adds up. Tick off each day as you read; you can catch up any time.">Reading plans</PageTitle>
      {running.map((p) => (
        <ActivePlan key={p.id} plan={p} />
      ))}
      {others.length > 0 && (
        <section aria-labelledby="choose">
          <h2 id="choose" className="mb-3 font-serif text-2xl font-semibold">
            {running.length ? 'More plans' : 'Choose a plan'}
          </h2>
          <ul className="space-y-3">
            {others.map((p) => (
              <li key={p.id}>
                <Card>
                  <h3 className="text-lg font-semibold">{p.title}</h3>
                  <p className="mt-1 text-stone-700 dark:text-stone-300">{p.description}</p>
                  <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">{p.days.length} days</p>
                  <button type="button" className={buttonClass('primary', 'mt-3')} onClick={() => startPlan(p.id)}>
                    Start this plan
                  </button>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
