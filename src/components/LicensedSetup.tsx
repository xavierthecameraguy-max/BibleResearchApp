// Settings → Licensed translations: status, access code and step-by-step
// setup for the NKJV (API.Bible), ESV and NLT.

import { useEffect, useState } from 'react'
import { getAccessCode, listOnlineWithStatus, setAccessCode, type ServerStatus } from '../lib/online.ts'
import type { Translation } from '../lib/bible.ts'
import { ExternalA, buttonClass } from './ui.tsx'

const GUIDES: { abbr: string; title: string; env: string; steps: React.ReactNode[] }[] = [
  {
    abbr: 'NKJV',
    title: 'NKJV: free through API.Bible',
    env: 'API_BIBLE_KEY',
    steps: [
      <>
        Sign up at{' '}
        <ExternalA href="https://api.bible" className="underline">
          api.bible
        </ExternalA>{' '}
        and choose the free <strong>Starter</strong> plan. Describe the app as a personal, non-commercial Bible study app.
      </>,
      <>
        In your API.Bible dashboard, open <strong>Plan</strong> and add the <strong>New King James Version</strong> to your key (the
        Starter plan allows up to 3 licensed Bibles).
      </>,
      <>
        Copy your API key and put it in the <code>API_BIBLE_KEY</code> setting (see “Where keys go” below).
      </>,
    ],
  },
  {
    abbr: 'ESV',
    title: 'ESV: free key from Crossway',
    env: 'ESV_API_KEY',
    steps: [
      <>
        Create a free account at{' '}
        <ExternalA href="https://api.esv.org" className="underline">
          api.esv.org
        </ExternalA>
        , then choose <strong>Create an API Application</strong> (intended use: personal study).
      </>,
      <>
        Copy the key and put it in the <code>ESV_API_KEY</code> setting.
      </>,
    ],
  },
  {
    abbr: 'NLT',
    title: 'NLT: works now, no sign-up',
    env: 'NLT_API_KEY',
    steps: [
      <>The NLT already works using Tyndale's free anonymous access.</>,
      <>
        Optional: register at{' '}
        <ExternalA href="https://api.nlt.to" className="underline">
          api.nlt.to
        </ExternalA>{' '}
        for a free key (higher limits) and put it in the <code>NLT_API_KEY</code> setting.
      </>,
    ],
  },
]

export function LicensedSetup() {
  const [status, setStatus] = useState<ServerStatus | null>(null)
  const [online, setOnline] = useState<Translation[]>([])
  const [code, setCode] = useState(getAccessCode())
  const [saved, setSaved] = useState('')

  const refresh = () =>
    listOnlineWithStatus().then((r) => {
      setStatus(r.status)
      setOnline(r.list)
      return r.status
    })
  useEffect(() => {
    refresh()
  }, [])

  const has = (abbr: string) => online.some((t) => t.abbr === abbr)

  return (
    <div id="licensed" className="mt-6 scroll-mt-20 rounded-xl border border-stone-200 p-4 dark:border-stone-800">
      <h3 className="text-lg font-semibold">Licensed translations (NKJV, ESV, NLT)</h3>
      <p className="mt-1 text-[0.95rem] leading-relaxed text-stone-700 dark:text-stone-300">
        These are read online, a chapter at a time, under each publisher's free non-commercial terms. A few recent chapters are kept
        on this device for a short time, as the terms allow.
      </p>

      <ul className="mt-3 space-y-1" aria-label="Status">
        {GUIDES.map((g) => (
          <li key={g.abbr} className="flex items-center gap-2">
            <span
              className={`size-2.5 rounded-full ${has(g.abbr) ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-stone-400'}`}
              aria-hidden="true"
            />
            <span className="font-semibold">{g.abbr}</span>
            <span className="text-stone-600 dark:text-stone-400">{has(g.abbr) ? 'ready' : 'not set up yet'}</span>
          </li>
        ))}
      </ul>
      {status === 'unavailable' && (
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
          The app's server part isn't reachable right now (you may be offline, or running a build without it).
        </p>
      )}

      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault()
          setAccessCode(code)
          setSaved('Checking…')
          refresh().then((s) =>
            setSaved(s === 'needs-code' ? 'That code wasn’t accepted. Check APP_ACCESS_CODE on your server.' : s === 'ok' ? 'Saved. You’re connected.' : 'Saved.'),
          )
        }}
      >
        <label htmlFor="access-code" className="block font-semibold">
          Access code
        </label>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          {status === 'needs-code'
            ? 'Your server asks for an access code. Type the APP_ACCESS_CODE you chose.'
            : 'Only needed if you set APP_ACCESS_CODE on your server (recommended once the app is online).'}
        </p>
        <div className="mt-2 flex gap-2">
          <input
            id="access-code"
            type="password"
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="min-h-12 flex-1 rounded-xl border border-stone-300 bg-white px-3 text-base dark:border-stone-700 dark:bg-stone-900"
          />
          <button className={buttonClass('secondary')}>Save</button>
        </div>
        <p role="status" className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">
          {saved}
        </p>
      </form>

      {GUIDES.map((g) => (
        <details key={g.abbr} className="mt-3 rounded-xl bg-stone-100 p-4 dark:bg-stone-800/60">
          <summary className="cursor-pointer font-semibold">{g.title}</summary>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 leading-relaxed">
            {g.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </details>
      ))}
      <details className="mt-3 rounded-xl bg-stone-100 p-4 dark:bg-stone-800/60">
        <summary className="cursor-pointer font-semibold">Where keys go</summary>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 leading-relaxed">
          <li>
            <strong>On your computer:</strong> copy the file <code>.env.example</code> to <code>.env</code> in the project folder and paste
            the keys after the = signs. Restart <code>npm run dev</code>.
          </li>
          <li>
            <strong>On Netlify:</strong> Site configuration → Environment variables → add each name (for example{' '}
            <code>API_BIBLE_KEY</code>) with its key, then redeploy. Also add <code>APP_ACCESS_CODE</code> with a private code and type
            it above.
          </li>
          <li>Keys stay on the server. They are never put into the app itself or sent to GitHub.</li>
        </ul>
      </details>
    </div>
  )
}
