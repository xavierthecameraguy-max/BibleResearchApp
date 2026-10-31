import { Link } from 'react-router-dom'
import { useCurrentTranslation, useTranslations } from '../lib/hooks.ts'
import { updateSettings } from '../lib/storage.ts'

export function TranslationPicker() {
  const all = useTranslations()
  const current = useCurrentTranslation().id
  const hasNkjv = all.some((t) => t.abbr === 'NKJV')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="translation" className="text-sm font-medium text-stone-600 dark:text-stone-400">
        Translation
      </label>
      <select
        id="translation"
        value={current}
        onChange={(e) => updateSettings({ translation: e.target.value })}
        className="min-h-11 rounded-xl border border-stone-300 bg-white px-3 text-base dark:border-stone-700 dark:bg-stone-900"
      >
        {all.map((t) => (
          <option key={t.id} value={t.id}>
            {t.abbr}: {t.name}
          </option>
        ))}
      </select>
      {!hasNkjv && (
        <Link to="/settings#licensed" className="text-sm text-amber-800 underline underline-offset-2 dark:text-amber-300">
          Set up the NKJV
        </Link>
      )}
    </div>
  )
}
