import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { getIntro, getLesson } from '../lib/content.ts'
import { sectionsAround, type Section } from '../lib/context.ts'
import { getCrossRefs, type CrossRef } from '../lib/data/xrefs.ts'
import { formatReference, parseReference, readerPath, type Passage } from '../lib/references.ts'
import { newId, saveNote, useAppState, type StudyAnswers } from '../lib/storage.ts'
import { useTitle } from '../lib/hooks.ts'
import { PassageText } from '../components/PassageText.tsx'
import { Card, PageTitle, buttonClass } from '../components/ui.tsx'

interface Step {
  key: keyof StudyAnswers
  title: string
  prompt: string
  hint: (p: Passage) => React.ReactNode
  lesson: string
}

function ContextHint({ p }: { p: Passage }) {
  const [ctx, setCtx] = useState<Awaited<ReturnType<typeof sectionsAround>> | null>(null)
  useEffect(() => {
    sectionsAround(p).then(setCtx)
  }, [p])
  if (!ctx) return null
  const link = (s?: Section) =>
    s ? (
      <Link className="underline underline-offset-2" to={readerPath({ book: p.book, startChapter: s.chapter, startVerse: s.verse, endChapter: s.chapter })}>
        {s.heading}
      </Link>
    ) : (
      '—'
    )
  return (
    <span className="mt-2 block rounded-lg bg-white p-3 dark:bg-stone-950">
      <span className="block">
        <strong>Before:</strong> {link(ctx.before)}
      </span>
      <span className="block">
        <strong>This section:</strong> {link(ctx.current)}
      </span>
      <span className="block">
        <strong>After:</strong> {link(ctx.after)}
      </span>
      <span className="mt-1 block text-xs text-stone-600 dark:text-stone-400">Section headings from the Berean Standard Bible.</span>
    </span>
  )
}

function StoryHint({ p }: { p: Passage }) {
  const [refs, setRefs] = useState<CrossRef[]>([])
  useEffect(() => {
    getCrossRefs(p.book, p.startChapter, p.startVerse ?? 1).then((r) => setRefs(r.slice(0, 6)))
  }, [p])
  if (!refs.length) return null
  return (
    <span className="mt-2 block">
      <strong>Connected passages elsewhere in the Bible:</strong>{' '}
      {refs.map((r, i) => (
        <span key={i}>
          {i > 0 && ', '}
          <Link className="underline underline-offset-2" to={readerPath(r.passage)}>
            {formatReference(r.passage)}
          </Link>
        </span>
      ))}
    </span>
  )
}

const STEPS: Step[] = [
  {
    key: 'genre',
    title: 'What kind of writing is this?',
    prompt: 'Story, law, poetry, wisdom, prophecy, gospel, letter or apocalyptic? Each kind is read a little differently.',
    hint: (p) => {
      const i = getIntro(p.book)
      return i ? (
        <>
          The intro card describes {i.name} as: <strong>{i.genre}</strong>. Look at this passage itself too. Is it a story, a song, a
          speech, an argument?
        </>
      ) : null
    },
    lesson: 'reading-bible-05',
  },
  {
    key: 'context',
    title: 'What comes before and after it?',
    prompt: 'Read the paragraph or chapter around it. What is happening, and how does this passage fit the flow?',
    hint: (p) => (
      <>
        Open the{' '}
        <Link className="font-semibold underline underline-offset-2" to={readerPath(p)}>
          whole chapter in the reader
        </Link>{' '}
        and read a little before and after the highlighted verses.
        <ContextHint p={p} />
      </>
    ),
    lesson: 'reading-bible-02',
  },
  {
    key: 'audience',
    title: 'What did it mean to the original audience?',
    prompt: 'Who first heard or read this, and what was their situation? What would they have understood?',
    hint: (p) => {
      const i = getIntro(p.book)
      return i ? (
        <>
          <strong>Original audience of {i.name}:</strong> {i.audience}
          <br />
          <strong>Written:</strong> {i.date}
        </>
      ) : null
    },
    lesson: 'reading-bible-04',
  },
  {
    key: 'story',
    title: "Where does it fit in the Bible's larger story?",
    prompt: 'Creation, fall, Abraham, exodus, kings, exile and return, Jesus, the church, new creation. Where is this, and how does it point to Jesus?',
    hint: (p) => {
      const i = getIntro(p.book)
      return (
        <>
          {i?.storyPlace}
          <StoryHint p={p} />
        </>
      )
    },
    lesson: 'big-story-12',
  },
  {
    key: 'today',
    title: 'What does it mean for me today?',
    prompt: 'What does it show about God? Is there a promise, warning, example or command? How could you respond this week?',
    hint: () => (
      <>
        Start from what it meant then, and look for the principle that carries over. Then ask how it might shape your trust, your
        prayers and how you treat people. Talking it over with someone at church helps.
      </>
    ),
    lesson: 'reading-bible-11',
  },
]

const EMPTY: StudyAnswers = { genre: '', context: '', audience: '', story: '', today: '' }

export function StudyPage() {
  useTitle('Study a passage')
  const [search, setSearch] = useSearchParams()
  const navigate = useNavigate()
  const noteId = search.get('note')
  const existing = useAppState((s) => (noteId ? s.notes.find((n) => n.id === noteId) : undefined))
  const [refInput, setRefInput] = useState(existing?.passageRef ?? search.get('ref') ?? '')
  const [passageRef, setPassageRef] = useState(existing?.passageRef ?? search.get('ref') ?? '')
  const [answers, setAnswers] = useState<StudyAnswers>(existing?.answers ?? EMPTY)
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [savedId, setSavedId] = useState<string | null>(existing?.id ?? null)
  const [status, setStatus] = useState('')
  const stepHeading = useRef<HTMLHeadingElement>(null)

  const passage = useMemo(() => (passageRef ? parseReference(passageRef) : null), [passageRef])

  useEffect(() => {
    if (passage) stepHeading.current?.focus()
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (e: React.FormEvent) => {
    e.preventDefault()
    const p = parseReference(refInput)
    if (!p) {
      setError('Try a reference like "Mark 4:1-20", "Psalm 23" or "Romans 8".')
      return
    }
    setError('')
    const formatted = formatReference(p)
    setPassageRef(formatted)
    setRefInput(formatted)
    setStep(0)
  }

  const save = (finishing = false) => {
    if (!passage) return
    const id = savedId ?? newId()
    saveNote({ id, passageRef: formatReference(passage), answers, createdAt: existing?.createdAt })
    setSavedId(id)
    setStatus('Saved to your notes.')
    if (finishing) navigate('/notes')
    else if (!noteId) setSearch({ note: id }, { replace: true })
  }

  const s = STEPS[step]
  const lesson = getLesson(s.lesson)

  return (
    <div>
      <PageTitle sub="Pick any passage and work through five questions. Your answers are saved as a note on this device.">
        Study a passage
      </PageTitle>

      <form onSubmit={choose} className="mb-2 flex gap-2">
        <label htmlFor="passage" className="sr-only">
          Passage
        </label>
        <input
          id="passage"
          value={refInput}
          onChange={(e) => setRefInput(e.target.value)}
          placeholder="e.g. Luke 15:11-32"
          className="min-h-12 flex-1 rounded-xl border border-stone-300 bg-white px-4 text-base dark:border-stone-700 dark:bg-stone-900"
        />
        <button className={buttonClass('primary')}>{passage ? 'Change' : 'Start'}</button>
      </form>
      {error && (
        <p role="alert" className="mb-4 text-rose-700 dark:text-rose-400">
          {error}
        </p>
      )}

      {!passage ? (
        <Card className="mt-6">
          <h2 className="font-serif text-xl font-semibold">Not sure where to start?</h2>
          <p className="mt-2 text-stone-600 dark:text-stone-400">Try one of these:</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {['Psalm 23', 'Luke 15:11-32', 'Mark 4:1-20', 'Romans 8:28-39', 'Genesis 12:1-9', 'Philippians 4:4-13'].map((r) => (
              <li key={r}>
                <button
                  type="button"
                  className={buttonClass('secondary', 'min-h-11 px-4 py-2 text-[0.95rem]')}
                  onClick={() => {
                    setRefInput(r)
                    setPassageRef(r)
                  }}
                >
                  {r}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-5">
            <Link to="/notes" className="font-semibold text-amber-800 underline underline-offset-2 dark:text-amber-300">
              See your saved notes
            </Link>
          </p>
        </Card>
      ) : (
        <>
          <div className="mt-4">
            <PassageText passage={passage} maxVerses={40} />
          </div>

          <section aria-labelledby="step-title" className="mt-6">
            <p className="text-sm font-semibold text-stone-600 dark:text-stone-400" aria-live="polite">
              Question {step + 1} of {STEPS.length}
            </p>
            <div className="mt-2 flex gap-1.5" aria-hidden="true">
              {STEPS.map((x, i) => (
                <span
                  key={x.key}
                  className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-amber-600 dark:bg-amber-400' : 'bg-stone-200 dark:bg-stone-800'}`}
                />
              ))}
            </div>
            <h2 id="step-title" ref={stepHeading} tabIndex={-1} className="mt-4 font-serif text-2xl font-semibold outline-none">
              {s.title}
            </h2>
            <p className="mt-1 text-stone-600 dark:text-stone-400">{s.prompt}</p>

            <details className="mt-3 rounded-xl bg-stone-100 p-4 dark:bg-stone-900">
              <summary className="cursor-pointer font-semibold">Need a hint?</summary>
              <div className="mt-2 space-y-2 leading-relaxed">
                <p>{s.hint(passage)}</p>
                {lesson && (
                  <p>
                    Lesson:{' '}
                    <Link to={`/lesson/${lesson.id}`} className="underline underline-offset-2">
                      {lesson.title}
                    </Link>
                  </p>
                )}
              </div>
            </details>

            <label htmlFor={`ans-${s.key}`} className="sr-only">
              Your answer: {s.title}
            </label>
            <textarea
              id={`ans-${s.key}`}
              value={answers[s.key]}
              onChange={(e) => {
                setAnswers((a) => ({ ...a, [s.key]: e.target.value }))
                setStatus('')
              }}
              rows={6}
              placeholder="Write your thoughts…"
              className="mt-4 w-full rounded-xl border border-stone-300 bg-white p-4 text-base leading-relaxed dark:border-stone-700 dark:bg-stone-900"
            />

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" className={buttonClass('secondary')} disabled={step === 0} onClick={() => setStep((n) => n - 1)}>
                Back
              </button>
              {step < STEPS.length - 1 ? (
                <button type="button" className={buttonClass('primary')} onClick={() => setStep((n) => n + 1)}>
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  className={buttonClass('primary')}
                  onClick={() => save(true)}
                >
                  Save &amp; finish
                </button>
              )}
            </div>
            <button type="button" className={buttonClass('ghost', 'mt-2 w-full')} onClick={() => save()}>
              Save progress
            </button>
            <p role="status" className="mt-2 text-center text-emerald-700 dark:text-emerald-400">
              {status}
            </p>
          </section>
        </>
      )}
    </div>
  )
}
