// Settings → "Save study data for offline": downloads every study-data file
// (cross-references, word studies, dictionaries…) so they work without a signal.

import { useState } from 'react'
import { buttonClass } from './ui.tsx'
import { publicUrl } from '../lib/paths.ts'

interface FileInfo {
  path: string
  bytes: number
}

export function OfflineData() {
  const [state, setState] = useState<{
    done: number
    total: number
    bytes: number
    failed?: number
    stored?: number
    error?: string
    finished?: boolean
  } | null>(null)

  const run = async () => {
    try {
      if (!navigator.onLine) throw new Error('You’re offline. Connect to Wi-Fi and try again.')
      if (!navigator.serviceWorker?.controller) {
        throw new Error('The app needs to be reloaded once before it can save data for offline. Close and reopen it, then try again.')
      }
      const r = await fetch(publicUrl('data-manifest.json'))
      if (!r.ok) throw new Error('The list of study data could not be loaded.')
      const files = (await r.json()) as FileInfo[]
      const bytes = files.reduce((n, f) => n + f.bytes, 0)
      setState({ done: 0, total: files.length, bytes })
      let done = 0
      let failed = 0
      // A few at a time; each response is stored on the device by the app's offline cache.
      const queue = [...files]
      const worker = async () => {
        while (queue.length) {
          const f = queue.shift()!
          try {
            const res = await fetch(publicUrl(f.path))
            if (!res.ok) failed++
          } catch {
            failed++ // keep going; tapping again later fills the gaps
          }
          done++
          setState((s) => (s ? { ...s, done } : s))
        }
      }
      await Promise.all(Array.from({ length: 4 }, worker))
      // Check what the offline cache really holds.
      let stored: number | undefined
      try {
        stored = (await (await caches.open('study-data')).keys()).length
      } catch {
        stored = undefined
      }
      setState((s) => (s ? { ...s, failed, stored, finished: true } : s))
    } catch (e) {
      const msg = (e as Error).message
      setState({ done: 0, total: 0, bytes: 0, error: msg === 'Failed to fetch' ? 'The download failed. Check your connection and try again.' : msg })
    }
  }

  return (
    <div>
      <h3 className="font-semibold">Study data for offline</h3>
      <p className="mt-1 text-[0.95rem] text-stone-700 dark:text-stone-300">
        Bibles and lessons always work offline. Study tools (cross-references, Hebrew and Greek words, dictionary, topics, people and
        places) are saved as you use them. Tap below to save them all now, ideally on Wi-Fi.
      </p>
      <button type="button" className={buttonClass('secondary', 'mt-3 w-full')} onClick={run} disabled={!!state && !state.finished && !state.error}>
        Save study data for offline
      </button>
      <p role="status" className="mt-2 text-sm">
        {state?.error ??
          (state &&
            (state.finished
              ? state.stored !== undefined && state.stored < state.total - (state.failed ?? 0)
                ? `Only ${state.stored} of ${state.total} files could be saved. Please try again on Wi-Fi.`
                : state.failed
                  ? `Saved ${state.total - state.failed} of ${state.total} files. ${state.failed} couldn’t be downloaded; tap again to retry.`
                  : `Done: all ${state.total} files (${(state.bytes / 1_048_576).toFixed(0)} MB) are saved on this device.`
              : `Saving… ${state.done} of ${state.total} (${(state.bytes / 1_048_576).toFixed(0)} MB in total)`))}
      </p>
    </div>
  )
}
