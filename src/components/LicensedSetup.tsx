// Settings → Licensed translations: status, keys saved on this phone, the
// server's access code, and step-by-step setup for the NKJV (API.Bible), ESV and NLT.

import { useEffect, useState } from 'react'
import {
  NLT_OPEN,
  checkOnlineTranslation,
  getAccessCode,
  getDeviceKeys,
  listOnlineWithStatus,
  pruneOnlineCache,
  setAccessCode,
  setDeviceKeys,
  usingDeviceKeys,
  type DeviceKeys,
  type ServerStatus,
} from '../lib/online.ts'
import { STATIC_HOST } from '../lib/paths.ts'
import type { Translation } from '../lib/bible.ts'
import { ExternalA, buttonClass } from './ui.tsx'

const inputClass = 'min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base dark:border-stone-700 dark:bg-stone-900'

/** Settings for typing a key: no auto-capitals or corrections on the phone keyboard. */
const keyInput = { autoComplete: 'off', autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false } as const

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
        Copy your API key and paste it under <strong>Keys on this phone</strong>. (On a Netlify copy you can use the{' '}
        <code>API_BIBLE_KEY</code> setting instead.)
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
        Copy the key and paste it under <strong>Keys on this phone</strong> (or use the <code>ESV_API_KEY</code> setting on Netlify).
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
        for a free key (higher limits) and paste it under <strong>Keys on this phone</strong>.
      </>,
    ],
  },
]

type ListResult = { list: Translation[]; status: ServerStatus }

/** Keys saved on this phone: used instead of a server (needed on GitHub Pages). */
function DeviceKeysForm({ onChange }: { onChange: () => Promise<ListResult> }) {
  const [keys, setKeys] = useState<DeviceKeys>(getDeviceKeys)
  const [haveSaved, setHaveSaved] = useState(() => usingDeviceKeys())
  // Open at first if it's in use; after that it opens and closes only when tapped.
  const [biblesOpen] = useState(() => !!getDeviceKeys().API_BIBLE_BIBLES)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [checks, setChecks] = useState<{ abbr: string; problem: string | null }[]>([])
  const field = (name: keyof DeviceKeys) => ({
    value: keys[name] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setKeys((k) => ({ ...k, [name]: e.target.value })),
  })

  /** Save keys, then remove any chapters loaded with a key that's no longer there (the publishers' terms). */
  const apply = async (next: DeviceKeys) => {
    setDeviceKeys(next)
    const result = await onChange()
    await pruneOnlineCache(result.list.map((t) => t.id))
    return result
  }
  const removed = 'Keys removed from this phone, along with the chapters they loaded.'

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const hadKeys = haveSaved
    setBusy(true)
    setChecks([])
    setMessage('Saving…')
    const { list } = await apply(keys)
    const now = usingDeviceKeys()
    setHaveSaved(now)
    if (!now) {
      setBusy(false)
      setMessage(hadKeys ? removed : 'Paste at least one key, then tap Save and check.')
      return
    }
    setMessage('Saved. Checking each key…')
    const results = await Promise.all(
      list.filter((t) => t.id !== NLT_OPEN.id).map(async (t) => ({ abbr: t.abbr, problem: await checkOnlineTranslation(t) })),
    )
    setChecks(results)
    setBusy(false)
    setMessage(results.every((r) => !r.problem) ? 'Saved. Everything works.' : 'Saved, but something needs fixing:')
  }

  const remove = async () => {
    setBusy(true)
    setKeys({})
    setChecks([])
    await apply({})
    setHaveSaved(false)
    setBusy(false)
    setMessage(removed)
  }

  return (
    <form className="mt-4" onSubmit={save} aria-labelledby="device-keys-title">
      <h4 id="device-keys-title" className="font-semibold">
        Keys on this phone
      </h4>
      <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-400">
        Saved only in this app on this phone (not in backups), and sent only to API.Bible, Crossway or Tyndale. The steps below show
        how to get each free key.
      </p>
      <label htmlFor="key-apibible" className="mt-3 block font-semibold">
        API.Bible key <span className="font-normal text-stone-600 dark:text-stone-400">(for the NKJV)</span>
      </label>
      <input id="key-apibible" type="password" className={inputClass} {...keyInput} {...field('API_BIBLE_KEY')} />
      <label htmlFor="key-esv" className="mt-3 block font-semibold">
        ESV API key
      </label>
      <input id="key-esv" type="password" className={inputClass} {...keyInput} {...field('ESV_API_KEY')} />
      <label htmlFor="key-nlt" className="mt-3 block font-semibold">
        NLT API key <span className="font-normal text-stone-600 dark:text-stone-400">(optional)</span>
      </label>
      <input id="key-nlt" type="password" className={inputClass} {...keyInput} {...field('NLT_API_KEY')} />
      <details className="mt-3" open={biblesOpen}>
        <summary className="min-h-11 cursor-pointer py-2 font-semibold">More Bibles from API.Bible (advanced)</summary>
        <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-400">
          Leave this empty for just the NKJV. The free plan allows up to 3 licensed Bibles. List each one as ABBR=Bible ID|Full name,
          with commas between them. Each Bible’s ID is shown on its page in your API.Bible dashboard. For example:{' '}
          <code className="break-all">NKJV=63097d2a0a2f7db3-01|New King James Version, CSB=…|Christian Standard Bible</code>
        </p>
        <label htmlFor="key-bibles" className="mt-2 block font-semibold">
          API.Bible Bibles
        </label>
        <input id="key-bibles" type="text" className={inputClass} {...keyInput} {...field('API_BIBLE_BIBLES')} />
      </details>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className={buttonClass('primary')} disabled={busy}>
          Save and check
        </button>
        {haveSaved && (
          <button type="button" className={buttonClass('secondary')} onClick={remove} disabled={busy}>
            Remove keys
          </button>
        )}
      </div>
      <div role="status" className="mt-2 text-sm">
        {message && <p>{message}</p>}
        {checks.length > 0 && (
          <ul className="mt-1 space-y-1">
            {checks.map((c) => (
              <li key={c.abbr} className={c.problem ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}>
                <strong>{c.abbr}:</strong> {c.problem ?? 'working'}
              </li>
            ))}
          </ul>
        )}
      </div>
    </form>
  )
}

export function LicensedSetup() {
  const [status, setStatus] = useState<ServerStatus | null>(null)
  const [online, setOnline] = useState<Translation[]>([])
  const [code, setCode] = useState(getAccessCode())
  const [saved, setSaved] = useState('')

  const refresh = () =>
    listOnlineWithStatus().then((r) => {
      setStatus(r.status)
      setOnline(r.list)
      return r
    })
  useEffect(() => {
    refresh()
  }, [])

  const has = (abbr: string) => online.some((t) => t.abbr === abbr)
  // With no server (GitHub Pages) or keys already saved, keys on the phone come first; otherwise
  // they're an alternative. Decided once, so the form doesn't jump (and lose its messages) on Save.
  const [phoneFirst] = useState(() => STATIC_HOST || usingDeviceKeys())
  const keysForm = <DeviceKeysForm onChange={refresh} />

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
          {usingDeviceKeys()
            ? 'The Bible services can’t be reached right now. You may be offline.'
            : 'The app’s server part isn’t reachable right now (you may be offline, or running a copy without it).'}
        </p>
      )}
      {status === 'no-server' && (
        <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
          This copy runs on GitHub Pages, which has no server part, so the NKJV and ESV use keys saved on this phone. The NLT works
          without one.
        </p>
      )}

      {phoneFirst && keysForm}

      {!STATIC_HOST && status !== 'device' && (
        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault()
            setAccessCode(code)
            setSaved('Checking…')
            refresh().then(({ status: s }) =>
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
              {...keyInput}
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
      )}

      {!phoneFirst && (
        <details className="mt-3 rounded-xl bg-stone-100 p-4 dark:bg-stone-800/60">
          <summary className="cursor-pointer font-semibold">Or save keys on this phone instead</summary>
          {keysForm}
        </details>
      )}

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
            <strong>On this phone</strong> (the only way on GitHub Pages): paste them under <strong>Keys on this phone</strong>. They stay
            in this app on this phone and go only to the Bible services. Each phone or computer needs them typed in once.
          </li>
          <li>
            <strong>On your computer:</strong> copy the file <code>.env.example</code> to <code>.env</code> in the project folder and paste
            the keys after the = signs. Restart <code>npm run dev</code>.
          </li>
          <li>
            <strong>On Netlify:</strong> Site configuration → Environment variables → add each name (for example{' '}
            <code>API_BIBLE_KEY</code>) with its key, then redeploy. Also add <code>APP_ACCESS_CODE</code> with a private code and type
            it above.
          </li>
          <li>Keys are never put into the app’s files or sent to GitHub.</li>
        </ul>
      </details>
    </div>
  )
}
