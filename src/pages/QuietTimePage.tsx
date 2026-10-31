// A guided daily quiet time: about ten minutes with God, one step at a time.

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { versesOfTheDay } from '../lib/content.ts'
import { PLANS } from '../lib/plans.ts'
import { formatReference, parseReference, type Passage } from '../lib/references.ts'
import { newId, recordActivity, saveNote, todayStr, togglePlanDay, useAppState } from '../lib/storage.ts'
import { useTitle } from '../lib/hooks.ts'
import { PassageText } from '../components/PassageText.tsx'
import { Card, buttonClass } from '../components/ui.tsx'

const QUESTIONS = [
  'What does this passage show you about God?',
  'What stands out to you most, and why?',
  'Is there a promise to trust, a command to follow, or an example to learn from?',
  'How could this shape one thing you do today?',
  'What would you like to say to God in response?',
]

function dayOfYear(d = new Date()) {
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 86_400_000)
}

export function QuietTimePage() {
  useTitle('Quiet time')
  const plans = useAppState((s) => s.plans)
  const prayers = useAppState((s) => s.prayers)
  const memory = useAppState((s) => s.memory)
  const [step, setStep] = useState(0)
  const [answer, setAnswer] = useState('')
  const [saved, setSaved] = useState(false)

  // Today's passage: the next unread day of an active plan, otherwise the
  // chapter around the verse of the day (read the paragraph, not just the verse).
  const today = useMemo(() => {
    const plan = PLANS.find((p) => plans[p.id])
    if (plan) {
      const day = plan.days.findIndex((_, i) => !plans[plan.id].done.includes(i + 1)) + 1
      if (day > 0) return { passages: plan.days[day - 1], label: `${plan.title}, day ${day}`, planId: plan.id, day }
    }
    const v = parseReference(versesOfTheDay[dayOfYear() % versesOfTheDay.length])!
    const around: Passage = { ...v, startVerse: Math.max(1, (v.startVerse ?? 1) - 3), endVerse: (v.endVerse ?? v.startVerse ?? 1) + 3 }
    return { passages: [around], label: 'Around the verse of the day', planId: undefined, day: 0 }
  }, [plans])

  const question = QUESTIONS[dayOfYear() % QUESTIONS.length]
  const openPrayers = prayers.filter((p) => !p.answeredAt).slice(0, 5)
  const due = Object.values(memory).filter((c) => c.due <= todayStr()).length
  const steps = ['Quiet your heart', 'Read', 'Reflect', 'Pray', 'Remember']

  return (
    <div className="mx-auto max-w-xl">
      <p className="text-sm font-semibold uppercase tracking-wide text-stone-600 dark:text-stone-400">Quiet time · about 10 minutes</p>
      <ol className="mt-2 flex gap-1.5" aria-label="Steps">
        {steps.map((s, i) => (
          <li key={s} className="flex-1">
            <span className={`block h-1.5 rounded-full ${i <= step ? 'bg-amber-600 dark:bg-amber-400' : 'bg-stone-200 dark:bg-stone-800'}`} aria-hidden="true" />
            <span className="sr-only">
              {s}
              {i === step ? ' (current step)' : ''}
            </span>
          </li>
        ))}
      </ol>
      <h1 className="mt-4 font-serif text-3xl font-semibold">{steps[step]}</h1>

      {step === 0 && (
        <div className="mt-4 space-y-4 text-lg leading-relaxed">
          <p>Find a quiet spot. Take a slow breath. You don’t need special words; God is glad you’re here.</p>
          <Card>
            <p className="font-serif italic">
              “Lord, thank you for this new day. Quiet my mind, open my heart, and help me hear you as I read. Amen.”
            </p>
          </Card>
          <p className="text-base text-stone-600 dark:text-stone-400">Pray this, or in your own words.</p>
        </div>
      )}

      {step === 1 && (
        <div className="mt-4 space-y-4">
          <p className="text-stone-600 dark:text-stone-400">{today.label}. Read it slowly, maybe twice.</p>
          {today.passages.map((p) => (
            <div key={formatReference(p)}>
              <PassageText passage={p} maxVerses={150} label="Today’s reading" />
            </div>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="mt-4 space-y-3">
          <p className="text-lg font-semibold">{question}</p>
          <label htmlFor="reflect" className="sr-only">
            Your reflection
          </label>
          <textarea
            id="reflect"
            value={answer}
            onChange={(e) => {
              setAnswer(e.target.value)
              setSaved(false)
            }}
            rows={6}
            placeholder="Write a few honest sentences…"
            className="w-full rounded-xl border border-stone-300 bg-white p-4 text-base leading-relaxed dark:border-stone-700 dark:bg-stone-900"
          />
          <p className="text-sm text-stone-600 dark:text-stone-400">This is saved to your study notes when you continue.</p>
        </div>
      )}

      {step === 3 && (
        <div className="mt-4 space-y-4 leading-relaxed">
          <p className="text-lg">A simple way to pray (ACTS):</p>
          <ul className="space-y-2">
            <li>
              <strong>Adore:</strong> praise God for who he is.
            </li>
            <li>
              <strong>Confess:</strong> be honest about where you’ve fallen short, and receive his forgiveness (1 John 1:9).
            </li>
            <li>
              <strong>Thank:</strong> name a few good gifts from today or yesterday.
            </li>
            <li>
              <strong>Ask:</strong> bring your needs and other people’s to him.
            </li>
          </ul>
          {openPrayers.length > 0 && (
            <Card>
              <h2 className="font-semibold">From your prayer journal</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {openPrayers.map((p) => (
                  <li key={p.id}>{p.title}</li>
                ))}
              </ul>
            </Card>
          )}
          <Link to="/prayer" className="inline-block underline">
            Open the prayer journal
          </Link>
        </div>
      )}

      {step === 4 && (
        <div className="mt-4 space-y-4">
          {due > 0 ? (
            <Card>
              <p className="text-lg">
                You have <strong>{due}</strong> memory verse{due === 1 ? '' : 's'} to review today.
              </p>
              <Link to="/memory" className={buttonClass('primary', 'mt-3 w-full')}>
                Review memory verses
              </Link>
            </Card>
          ) : (
            <Card>
              <p className="text-lg">No memory verses due today. Want to start one? Tap a verse you loved and choose “Memorize”.</p>
            </Card>
          )}
          <Card className="border-2 border-emerald-300 dark:border-emerald-800">
            <p className="text-lg font-semibold">Well done. 🌱</p>
            <p className="mt-1">Carry one thought from today’s reading with you. See you tomorrow!</p>
          </Card>
          <Link to="/" className={buttonClass('secondary', 'w-full')}>
            Back to home
          </Link>
        </div>
      )}

      <div className="mt-8 grid grid-cols-2 gap-2">
        <button type="button" className={buttonClass('ghost')} disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          Back
        </button>
        {step < steps.length - 1 && (
          <button
            type="button"
            className={buttonClass('primary')}
            onClick={() => {
              if (step === 1) {
                recordActivity()
                if (today.planId && today.day && !plans[today.planId].done.includes(today.day)) togglePlanDay(today.planId, today.day)
              }
              if (step === 2 && answer.trim() && !saved) {
                saveNote({
                  id: newId(),
                  passageRef: today.passages.map(formatReference).join('; '),
                  answers: { genre: '', context: '', audience: '', story: '', today: `${question}\n${answer.trim()}` },
                })
                setSaved(true)
              }
              setStep((s) => s + 1)
            }}
          >
            {step === 1 ? 'I’ve read it' : 'Next'}
          </button>
        )}
      </div>
    </div>
  )
}
