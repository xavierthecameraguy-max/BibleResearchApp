import { Link } from 'react-router-dom'
import { useTranslations } from '../lib/hooks.ts'
import { updateSettings, useAppState } from '../lib/storage.ts'

export function TranslationPicker() {
  const all = useTranslations()
  const current = useAppState((s) => s.settings.translation)
  const hasImported = all.some((t) => t.kind === 'imported')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="translation" className="text-sm font-medium text-stone-600 dark:text-stone-400">
        Translation
      </label>
      <select
        id="translation"
        value={all.some((t) => t.id === current) ? current : 'kjv'}
        onChange={(e) => updateSettings({ translation: e.target.value })}
        className="min-h-11 rounded-xl border border-stone-300 bg-white px-3 text-base dark:border-stone-700 dark:bg-stone-900"
      >
        {all.map((t) => (
          <option key={t.id} value={t.id}>
            {t.abbr}: {t.name}
          </option>
        ))}
      </select>
      {!hasImported && (
        <Link to="/settings#translations" className="text-sm text-amber-800 underline underline-offset-2 dark:text-amber-300">
          Add your NKJV
        </Link>
      )}
    </div>
  )
}
