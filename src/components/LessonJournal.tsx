// "My reflections": a private journal box on each lesson.

import { useEffect, useRef, useState } from 'react'
import { setLessonNote, useAppState } from '../lib/storage.ts'

export function LessonJournal({ lessonId }: { lessonId: string }) {
  const saved = useAppState((s) => s.lessonNotes[lessonId]?.text ?? '')
  const [text, setText] = useState(saved)
  const [status, setStatus] = useState('')
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => setText(saved), [lessonId]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mt-5">
      <label htmlFor="journal" className="font-semibold">
        My reflections
      </label>
      <p className="text-sm text-stone-600 dark:text-stone-400">Private to this device. Saved as you type.</p>
      <textarea
        id="journal"
        value={text}
        rows={4}
        placeholder="Your thoughts on the questions above, or anything this lesson raised…"
        onChange={(e) => {
          const v = e.target.value
          setText(v)
          setStatus('')
          window.clearTimeout(timer.current)
          timer.current = window.setTimeout(() => {
            setLessonNote(lessonId, v)
            setStatus('Saved')
          }, 600)
        }}
        className="mt-2 w-full rounded-xl border border-stone-300 bg-white p-3 text-base leading-relaxed dark:border-stone-700 dark:bg-stone-950"
      />
      <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
        {status}
      </p>
    </div>
  )
}
