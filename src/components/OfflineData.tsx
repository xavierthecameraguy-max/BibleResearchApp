// Settings → "Save study data for offline": downloads every study-data file
// (cross-references, word studies, dictionaries…) so they work without a signal.

import { useState } from 'react'
import { buttonClass } from './ui.tsx'

interface FileInfo {
  path: string
  bytes: number
}

export function OfflineData() {
  const [state, setState] = useState<{ done: number; total: number; bytes: number; error?: string; finished?: boolean } | null>(null)

  const run = async () => {
    try {
      const r = await fetch('/data-manifest.json')
      if (!r.ok) throw new Error('The list of study data could not be loaded.')
      const files = (await r.json()) as FileInfo[]
      const bytes = files.reduce((n, f) => n + f.bytes, 0)
      setState({ done: 0, total: files.length, bytes })
      let done = 0
      // A few at a time; each response is stored on the device by the app's offline cache.
      const queue = [...files]
      const worker = async () => {
        while (queue.length) {
          const f = queue.shift()!
          try {
            await fetch(f.path)
          } catch {
            // keep going; a later tap can fill gaps
          }
          done++
          setState((s) => (s ? { ...s, done } : s))
        }
      }
      await Promise.all(Array.from({ length: 4 }, worker))
      setState((s) => (s ? { ...s, finished: true } : s))
    } catch (e) {
      setState({ done: 0, total: 0, bytes: 0, error: (e as Error).message })
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
              ? `Done: ${state.total} files (${(state.bytes / 1_048_576).toFixed(0)} MB) saved on this device.`
              : `Saving… ${state.done} of ${state.total} (${(state.bytes / 1_048_576).toFixed(0)} MB in total)`))}
      </p>
    </div>
  )
}
