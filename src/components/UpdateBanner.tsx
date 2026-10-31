// "A new version is ready": shown when the app has been updated in the background.

import { useEffect, useState } from 'react'

export function UpdateBanner() {
  const [apply, setApply] = useState<null | (() => void)>(null)
  useEffect(() => {
    const on = (e: Event) => setApply(() => (e as CustomEvent<() => void>).detail)
    window.addEventListener('foundations:update-ready', on)
    return () => window.removeEventListener('foundations:update-ready', on)
  }, [])
  if (!apply) return null
  return (
    <div role="status" className="fixed inset-x-3 top-3 z-50 mx-auto flex max-w-lg items-center gap-3 rounded-2xl bg-stone-900 p-3 pl-4 text-white shadow-lg dark:bg-stone-100 dark:text-stone-950">
      <span className="flex-1 text-[0.95rem]">A new version of Foundations is ready.</span>
      <button type="button" onClick={apply} className="min-h-11 rounded-xl bg-amber-500 px-4 font-semibold text-stone-950">
        Update
      </button>
      <button type="button" onClick={() => setApply(null)} className="min-h-11 rounded-xl px-3 text-sm underline">
        Later
      </button>
    </div>
  )
}
