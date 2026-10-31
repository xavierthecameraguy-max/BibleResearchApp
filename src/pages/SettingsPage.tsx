import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { updateSettings, useAppState, type LineSpacing, type ReaderFont, type TextSize, type Theme } from '../lib/storage.ts'
import { useCurrentTranslation, useTitle, useTranslations } from '../lib/hooks.ts'
import { removeImported, saveImported } from '../lib/bible.ts'
import { countVerses, parseBibleFiles } from '../lib/bibleImport.ts'
import { Card, PageTitle, buttonClass } from '../components/ui.tsx'
import { LicensedSetup } from '../components/LicensedSetup.tsx'
import { OfflineData } from '../components/OfflineData.tsx'

function Choice<T extends string>({ legend, value, options, onChange }: { legend: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 font-semibold">{legend}</legend>
      <div className="flex gap-2">
        {options.map(([v, label]) => (
          <label
            key={v}
            className={`flex min-h-12 flex-1 cursor-pointer items-center justify-center rounded-xl border-2 px-3 text-center font-medium ${
              value === v ? 'border-amber-700 bg-amber-50 dark:border-amber-300 dark:bg-amber-950/40' : 'border-stone-300 dark:border-stone-700'
            }`}
          >
            <input type="radio" className="sr-only" name={legend} checked={value === v} onChange={() => onChange(v)} />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function ImportTranslation() {
  const [abbr, setAbbr] = useState('NKJV')
  const [name, setName] = useState('New King James Version')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const run = async (files: File[]) => {
    if (!files.length) return
    if (!abbr.trim()) {
      setMessage({ ok: false, text: 'Please enter a short name, like NKJV.' })
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      const books = await parseBibleFiles(files)
      if (!books.size) throw new Error('No Bible books were found in that file. See the README for the formats that work.')
      const t = await saveImported(abbr.trim(), name.trim(), books)
      updateSettings({ translation: t.id })
      setMessage({
        ok: true,
        text: `Imported ${books.size} book${books.size === 1 ? '' : 's'} (${countVerses(books).toLocaleString()} verses). ${t.abbr} is now your reading translation.`,
      })
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message || 'That file could not be read.' })
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="mt-4 rounded-xl bg-stone-100 p-4 dark:bg-stone-800/60">
      <h3 className="font-semibold">Add a translation you have</h3>
      <p className="mt-1 text-[0.95rem] leading-relaxed text-stone-700 dark:text-stone-300">
        For personal study you can load a Bible file you already have, such as the NKJV. It is read on this device and stored only in this
        browser. It is never uploaded or shared. Works with USFM (.usfm, .sfm or a .zip of them), OSIS or Zefania XML, JSON, or text
        lines like "Genesis 1:1 In the beginning…".
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <label className="col-span-1 block">
          <span className="text-sm font-medium">Short name</span>
          <input
            value={abbr}
            onChange={(e) => setAbbr(e.target.value.slice(0, 8))}
            className="mt-1 min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base dark:border-stone-700 dark:bg-stone-900"
          />
        </label>
        <label className="col-span-2 block">
          <span className="text-sm font-medium">Full name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base dark:border-stone-700 dark:bg-stone-900"
          />
        </label>
      </div>
      <button type="button" disabled={busy} className={buttonClass('primary', 'mt-3 w-full')} onClick={() => fileRef.current?.click()}>
        {busy ? 'Importing…' : 'Choose file(s)'}
      </button>
      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".usfm,.sfm,.zip,.xml,.osis,.json,.txt,.tsv,.csv"
        className="hidden"
        aria-label="Choose Bible file(s) to import"
        onChange={(e) => run(Array.from(e.target.files ?? []))}
      />
      <p role="status" className={`mt-3 ${message?.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
        {message?.text}
      </p>
    </div>
  )
}

export function SettingsPage() {
  useTitle('Settings')
  const settings = useAppState((s) => s.settings)
  const translations = useTranslations()
  const current = useCurrentTranslation().id
  const { hash } = useLocation()

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
  }, [hash])

  return (
    <div className="space-y-6">
      <PageTitle>Settings</PageTitle>

      <Card>
        <h2 className="mb-4 font-serif text-xl font-semibold">Reading</h2>
        <div className="space-y-5">
          <Choice<TextSize>
            legend="Text size"
            value={settings.textSize}
            options={[
              ['md', 'Large'],
              ['lg', 'Larger'],
              ['xl', 'Largest'],
            ]}
            onChange={(textSize) => updateSettings({ textSize })}
          />
          <Choice<ReaderFont>
            legend="Bible text font"
            value={settings.readerFont}
            options={[
              ['serif', 'Classic'],
              ['sans', 'Modern'],
            ]}
            onChange={(readerFont) => updateSettings({ readerFont })}
          />
          <Choice<LineSpacing>
            legend="Line spacing"
            value={settings.lineSpacing}
            options={[
              ['normal', 'Snug'],
              ['relaxed', 'Comfy'],
              ['loose', 'Airy'],
            ]}
            onChange={(lineSpacing) => updateSettings({ lineSpacing })}
          />
          <Choice<'on' | 'off'>
            legend="Verse numbers"
            value={settings.showVerseNumbers ? 'on' : 'off'}
            options={[
              ['on', 'Show'],
              ['off', 'Hide'],
            ]}
            onChange={(v) => updateSettings({ showVerseNumbers: v === 'on' })}
          />
          <Choice<'on' | 'off'>
            legend="Section headings"
            value={settings.showHeadings ? 'on' : 'off'}
            options={[
              ['on', 'Show'],
              ['off', 'Hide'],
            ]}
            onChange={(v) => updateSettings({ showHeadings: v === 'on' })}
          />
          <Choice<Theme>
            legend="Appearance"
            value={settings.theme}
            options={[
              ['system', 'Auto'],
              ['light', 'Light'],
              ['dark', 'Dark'],
            ]}
            onChange={(theme) => updateSettings({ theme })}
          />
        </div>
      </Card>

      <Card>
        <OfflineData />
      </Card>

      <Card>
        <h2 id="translations" className="scroll-mt-20 font-serif text-xl font-semibold">
          Bible translations
        </h2>
        <ul className="mt-3 space-y-2">
          {translations.map((t) => (
            <li key={t.id} className="flex items-center gap-3 rounded-xl border border-stone-200 p-3 dark:border-stone-800">
              <label className="flex flex-1 cursor-pointer items-center gap-3">
                <input
                  type="radio"
                  name="translation"
                  className="size-5 accent-amber-700"
                  checked={current === t.id}
                  onChange={() => updateSettings({ translation: t.id })}
                />
                <span>
                  <span className="block font-semibold">
                    {t.abbr}: {t.name}
                  </span>
                  <span className="block text-sm text-stone-600 dark:text-stone-400">
                    {t.kind === 'bundled'
                      ? 'Built in · works offline'
                      : t.kind === 'private'
                        ? 'Built in from your own file · works offline'
                        : t.kind === 'online'
                          ? `Licensed · via ${t.provider} · needs internet`
                        : `Imported · ${t.books?.length ?? 0} books · on this device only`}
                  </span>
                </span>
              </label>
              {t.kind === 'imported' && (
                <button
                  type="button"
                  className={buttonClass('ghost', 'min-h-11 px-3 py-2 text-sm')}
                  onClick={async () => {
                    if (!confirm(`Remove ${t.abbr} from this device?`)) return
                    await removeImported(t.id)
                    if (settings.translation === t.id) updateSettings({ translation: 'auto' })
                  }}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
        <LicensedSetup />
        <ImportTranslation />

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="linkVersion" className="block font-semibold">
              "Open in…" button translation
            </label>
            <p className="text-sm text-stone-600 dark:text-stone-400">Passages open online in this translation.</p>
            <select
              id="linkVersion"
              value={settings.linkVersion}
              onChange={(e) => updateSettings({ linkVersion: e.target.value })}
              className="mt-2 min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base dark:border-stone-700 dark:bg-stone-900"
            >
              {['NKJV', 'KJV', 'ESV', 'NLT', 'CSB', 'NIV', 'NASB'].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <Choice
            legend="Open passages on"
            value={settings.linkSite}
            options={[
              ['biblegateway', 'Bible Gateway'],
              ['youversion', 'YouVersion'],
            ]}
            onChange={(linkSite) => updateSettings({ linkSite })}
          />
        </div>
      </Card>
    </div>
  )
}
