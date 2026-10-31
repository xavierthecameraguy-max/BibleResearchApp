import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteNote, exportBackup, importBackup, useAppState, type StudyAnswers } from '../lib/storage.ts'
import { useTitle } from '../lib/hooks.ts'
import { Card, PageTitle, buttonClass } from '../components/ui.tsx'

const LABELS: Record<keyof StudyAnswers, string> = {
  genre: 'What kind of writing is this?',
  context: 'What comes before and after it?',
  audience: 'What did it mean to the original audience?',
  story: "Where does it fit in the Bible's larger story?",
  today: 'What does it mean for me today?',
}

export function NotesPage() {
  useTitle('Notes')
  const notes = useAppState((s) => s.notes)
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')

  const download = () => {
    const blob = new Blob([exportBackup()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `foundations-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div>
      <PageTitle sub="Your passage studies. They're stored only in this browser, so make a backup now and then.">Notes</PageTitle>

      <Link to="/study" className={buttonClass('primary', 'mb-6 w-full')}>
        Study a new passage
      </Link>

      {notes.length === 0 ? (
        <Card>
          <p>No notes yet. When you study a passage, your answers will appear here.</p>
        </Card>
      ) : (
        <ul className="space-y-4">
          {notes.map((n) => (
            <li key={n.id}>
              <Card>
                <h2 className="font-serif text-2xl font-semibold">{n.passageRef}</h2>
                <p className="text-sm text-stone-600 dark:text-stone-400">
                  Updated {new Date(n.updatedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                </p>
                <dl className="mt-3 space-y-3">
                  {(Object.keys(LABELS) as (keyof StudyAnswers)[])
                    .filter((k) => n.answers[k]?.trim())
                    .map((k) => (
                      <div key={k}>
                        <dt className="text-sm font-semibold text-stone-600 dark:text-stone-400">{LABELS[k]}</dt>
                        <dd className="mt-0.5 whitespace-pre-line leading-relaxed">{n.answers[k]}</dd>
                      </div>
                    ))}
                </dl>
                <div className="mt-4 flex gap-2">
                  <Link to={`/study?note=${n.id}`} className={buttonClass('secondary', 'flex-1')}>
                    Edit
                  </Link>
                  <button
                    type="button"
                    className={buttonClass('ghost', 'flex-1')}
                    onClick={() => {
                      if (confirm(`Delete your note on ${n.passageRef}? This can't be undone.`)) deleteNote(n.id)
                    }}
                  >
                    Delete
                  </button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <section aria-labelledby="backup" className="mt-8">
        <h2 id="backup" className="font-serif text-xl font-semibold">
          Backup
        </h2>
        <p className="mt-1 text-stone-600 dark:text-stone-400">
          Save your notes and progress to a file, or restore them on another phone or browser.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" className={buttonClass('secondary')} onClick={download}>
            Save backup
          </button>
          <button type="button" className={buttonClass('secondary')} onClick={() => fileRef.current?.click()}>
            Restore
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="Choose a backup file"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f) return
            try {
              const r = importBackup(await f.text())
              setMessage(`Restored ${r.notes} note(s) and ${r.lessons} lesson record(s).`)
            } catch (err) {
              setMessage((err as Error).message || 'That file could not be read.')
            }
            e.target.value = ''
          }}
        />
        <p role="status" className="mt-2">
          {message}
        </p>
      </section>
    </div>
  )
}
