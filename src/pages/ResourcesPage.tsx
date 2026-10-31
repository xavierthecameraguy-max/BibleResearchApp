import { resources } from '../lib/content.ts'
import { useTitle } from '../lib/hooks.ts'
import { ExternalA, MentorNote, PageTitle } from '../components/ui.tsx'
import { ExternalIcon } from '../components/Icons.tsx'

export function ResourcesPage() {
  useTitle('Further resources')
  return (
    <div>
      <PageTitle sub={resources.intro}>Further resources</PageTitle>
      {resources.sections.map((s, si) => (
        <section key={s.title} className="mb-8" aria-labelledby={`resources-${si}`}>
          <h2 id={`resources-${si}`} className="font-serif text-2xl font-semibold">
            {s.title}
          </h2>
          {s.intro && <p className="mt-1 text-stone-600 dark:text-stone-400">{s.intro}</p>}
          <ul className="mt-3 space-y-3">
            {s.items.map((r) => (
              <li key={r.title}>
                <ExternalA
                  href={r.url}
                  className="block rounded-2xl border border-stone-200 bg-white p-4 hover:bg-stone-50 dark:border-stone-800 dark:bg-stone-900 dark:hover:bg-stone-800"
                >
                  <span className="flex items-start gap-2">
                    <span className="flex-1">
                      <span className="block text-lg font-semibold">{r.title}</span>
                      {r.by && <span className="block text-stone-600 dark:text-stone-400">{r.by}</span>}
                    </span>
                    {r.tag && (
                      <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-sm dark:bg-stone-800">{r.tag}</span>
                    )}
                    <ExternalIcon className="shrink-0 text-stone-400" width="1.2em" height="1.2em" />
                  </span>
                  <span className="mt-1 block leading-relaxed text-stone-700 dark:text-stone-300">{r.description}</span>
                </ExternalA>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <MentorNote />
    </div>
  )
}
