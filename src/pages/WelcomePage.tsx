// First-run welcome: a short, friendly start.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { finishOnboarding, setLastLesson, updateSettings, useAppState, type TextSize } from '../lib/storage.ts'
import { useTitle } from '../lib/hooks.ts'
import { MentorNote, buttonClass } from '../components/ui.tsx'

const STARTS = [
  {
    id: 'first-steps-01',
    title: 'I’m new to following Jesus',
    desc: 'Start with First Steps: who God is, grace, prayer, reading the Bible and church.',
  },
  {
    id: 'big-story-01',
    title: 'I want the big picture',
    desc: 'Start with The Big Story: the whole Bible from creation to new creation.',
  },
  {
    id: 'plans',
    title: 'I want to start reading the Bible',
    desc: 'Pick a reading plan, like the Gospels in 30 days.',
  },
  {
    id: 'home',
    title: 'I’ll look around first',
    desc: 'Go to the home screen.',
  },
]

export function WelcomePage() {
  useTitle('Welcome')
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const textSize = useAppState((s) => s.settings.textSize)

  const finish = (choice: string) => {
    finishOnboarding()
    if (choice === 'plans') navigate('/plans')
    else if (choice === 'home') navigate('/')
    else {
      setLastLesson(choice)
      navigate(`/lesson/${choice}`)
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      {step === 0 && (
        <div className="space-y-5">
          <h1 className="font-serif text-4xl font-semibold leading-tight">Welcome to Foundations</h1>
          <p className="text-lg leading-relaxed">A calm place to get to know the Bible, one step at a time.</p>
          <ul className="space-y-3 text-[1.05rem] leading-relaxed">
            <li>
              <strong>Learn:</strong> short lessons on the Bible’s big story, how we got it, church history and how to read it well.
            </li>
            <li>
              <strong>Read:</strong> the Bible with highlights, notes, cross-references and the original Hebrew and Greek.
            </li>
            <li>
              <strong>Study:</strong> guided passage study, word studies, a Bible dictionary, people and places, and memory verses.
            </li>
            <li>
              <strong>Private:</strong> no account. Everything stays on this phone and works offline.
            </li>
          </ul>
          <button type="button" className={buttonClass('primary', 'w-full')} onClick={() => setStep(1)}>
            Get started
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <h1 className="font-serif text-3xl font-semibold">Make it comfortable to read</h1>
          <fieldset>
            <legend className="mb-2 font-semibold">Text size</legend>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ['md', 'Large'],
                  ['lg', 'Larger'],
                  ['xl', 'Largest'],
                ] as [TextSize, string][]
              ).map(([v, label]) => (
                <label
                  key={v}
                  className={`flex min-h-14 cursor-pointer items-center justify-center rounded-xl border-2 font-semibold ${
                    textSize === v ? 'border-amber-700 bg-amber-50 dark:border-amber-300 dark:bg-amber-950/40' : 'border-stone-300 dark:border-stone-700'
                  }`}
                >
                  <input type="radio" className="sr-only" name="ts" checked={textSize === v} onChange={() => updateSettings({ textSize: v })} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <p className="leading-relaxed text-stone-700 dark:text-stone-300">
            Your Bible starts in the <strong>Berean Standard Bible</strong>, a modern, accurate translation that works offline. The KJV
            and WEB are built in too, and the NLT works online. You can set up the <strong>NKJV</strong> or ESV later in Settings.
          </p>
          <button type="button" className={buttonClass('primary', 'w-full')} onClick={() => setStep(2)}>
            Next
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h1 className="font-serif text-3xl font-semibold">Where would you like to start?</h1>
          <ul className="space-y-3">
            {STARTS.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => finish(s.id)}
                  className="block w-full rounded-2xl border border-stone-200 bg-white p-4 text-left hover:bg-stone-50 dark:border-stone-800 dark:bg-stone-900 dark:hover:bg-stone-800"
                >
                  <span className="block text-lg font-semibold">{s.title}</span>
                  <span className="mt-1 block text-stone-600 dark:text-stone-400">{s.desc}</span>
                </button>
              </li>
            ))}
          </ul>
          <MentorNote compact />
        </div>
      )}
    </div>
  )
}
