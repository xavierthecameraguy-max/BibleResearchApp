import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteNote, exportBackup, exportNotesText, importBackup, useAppState, type Note, type StudyAnswers } from '../lib/storage.ts'
import { useTitle } from '../lib/hooks.ts'
import { Card, PageTitle, buttonClass } from '../components/ui.tsx'
import { getLesson } from '../lib/content.ts'

const LABELS: Record<keyof StudyAnswers, string> = {
  genre: 'What kind of writing is this?',
  context: 'What comes before and after it?',
  audience: 'What did it mean to the original audience?',
  story: "Where does it fit in the Bible's larger story?",
  today: 'What does it mean for me today?',
}

/** Share a study note (e.g. with a pastor or mentor) as plain text. */
async function shareNote(n: Note) {
  const text = [
    `My study of ${n.passageRef}`,
    '',
    ...(Object.keys(LABELS) as (keyof StudyAnswers)[])
      .filter((k) => n.answers[k]?.trim())
      .flatMap((k) => [LABELS[k], n.answers[k].trim(), '']),
  ].join('\n')
  try {
    if (navigator.share) await navigator.share({ title: `Study: ${n.passageRef}`, text })
    else {
      await navigator.clipboard.writeText(text)
      alert('Copied. You can paste it into a message or email.')
    }
  } catch {
    // the person cancelled sharing
  }
}

export function NotesPage() {
  useTitle('Notes')
  const allNotes = useAppState((s) => s.notes)
  const lessonNotes = useAppState((s) => s.lessonNotes)
  const [q, setQ] = useState('')
  const ql = q.trim().toLowerCase()
  const matches = (t: string) => !ql || t.toLowerCase().includes(ql)
  const notes = allNotes.filter((n) => matches(n.passageRef + ' ' + Object.values(n.answers).join(' ')))
  const reflections = Object.entries(lessonNotes)
    .map(([id, v]) => ({ id, ...v, lesson: getLesson(id) }))
    .filter((r) => r.lesson && matches(r.lesson.title + ' ' + r.text))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')

  const saveFile = (text: string, type: string, name: string) => {
    const blob = new Blob([text], { type })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = name
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const download = () => saveFile(exportBackup(), 'application/json', `foundations-backup-${new Date().toISOString().slice(0, 10)}.json`)

  return (
    <div>
      <PageTitle sub="Your passage studies. They're stored only in this browser, so make a backup now and then.">Notes</PageTitle>

      <Link to="/study/passage" className={buttonClass('primary', 'mb-6 w-full')}>
        Study a new passage
      </Link>

      {(allNotes.length > 0 || reflections.length > 0) && (
        <div className="mb-4">
          <label htmlFor="nq" className="sr-only">
            Search your notes
          </label>
          <input
            id="nq"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search your notes"
            className="min-h-12 w-full rounded-xl border border-stone-300 bg-white px-4 text-base dark:border-stone-700 dark:bg-stone-900"
          />
        </div>
      )}

      {notes.length === 0 ? (
        <Card>
          <p>{ql ? `No study notes match "${q}".` : "No notes yet. When you study a passage, your answers will appear here."}</p>
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
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" className={buttonClass('secondary', 'flex-1')} onClick={() => shareNote(n)}>
                    Share
                  </button>
                  <Link to={`/study/passage?note=${n.id}`} className={buttonClass('secondary', 'flex-1')}>
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

      {reflections.length > 0 && (
        <section aria-labelledby="refl" className="mt-8">
          <h2 id="refl" className="mb-3 font-serif text-2xl font-semibold">
            Lesson reflections
          </h2>
          <ul className="space-y-3">
            {reflections.map((r) => (
              <li key={r.id}>
                <Card>
                  <Link to={`/lesson/${r.id}`} className="font-semibold text-amber-800 underline underline-offset-2 dark:text-amber-300">
                    {r.lesson!.title}
                  </Link>
                  <p className="mt-2 whitespace-pre-line leading-relaxed">{r.text}</p>
                </Card>
              </li>
            ))}
          </ul>
        </section>
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
        <button
          type="button"
          className={buttonClass('ghost', 'mt-2 w-full')}
          onClick={() => saveFile(exportNotesText(), 'text/markdown', `foundations-notes-${new Date().toISOString().slice(0, 10)}.md`)}
        >
          Export notes as a text file
        </button>
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
