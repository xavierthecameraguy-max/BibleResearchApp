// Copyright notices for every Bible translation and dataset in the app.
// Licensed providers require a page like this.

import { useTitle, useTranslations } from '../lib/hooks.ts'
import { Card, ExternalA, PageTitle } from '../components/ui.tsx'
import { CREDITS } from '../lib/credits.ts'

export function CopyrightPage() {
  useTitle('Copyright')
  const all = useTranslations()
  return (
    <div className="space-y-4">
      <PageTitle sub="Where the Bible text and study data in this app come from, and the notices their owners require.">Copyright</PageTitle>
      {all.map((t) => (
        <Card key={t.id} className="[overflow-wrap:anywhere]">
          <h2 className="font-serif text-xl font-semibold">
            {t.abbr}: {t.name}
          </h2>
          <p className="mt-2 leading-relaxed">{t.copyrightPage ?? t.notice}</p>
          {t.provider && (
            <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
              Provided through {t.provider}
              {t.attributionUrl && (
                <>
                  {' · '}
                  <ExternalA href={t.attributionUrl} className="underline underline-offset-2">
                    {t.attributionUrl.replace(/^https?:\/\/(www\.)?/, '')}
                  </ExternalA>
                </>
              )}
            </p>
          )}
          {t.provider?.startsWith('API.Bible') && (
            <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
              Scripture text is provided by API.Bible, a service of the American Bible Society, for non-commercial use.
            </p>
          )}
        </Card>
      ))}
      {CREDITS.map((c) => (
        <Card key={c.title} className="[overflow-wrap:anywhere]">
          <h2 className="font-serif text-xl font-semibold">{c.title}</h2>
          <p className="mt-2 leading-relaxed">{c.text}</p>
          {c.url && (
            <p className="mt-2 text-sm">
              <ExternalA href={c.url} className="underline underline-offset-2">
                {c.url.replace(/^https?:\/\/(www\.)?/, '')}
              </ExternalA>
            </p>
          )}
        </Card>
      ))}
    </div>
  )
}
