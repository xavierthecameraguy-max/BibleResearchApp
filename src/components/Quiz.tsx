import { useState } from 'react'
import type { QuizQuestion } from '../lib/content.ts'
import { CheckIcon, CloseIcon } from './Icons.tsx'
import { buttonClass } from './ui.tsx'

export function Quiz({ questions, onFinish }: { questions: QuizQuestion[]; onFinish: (score: number) => void }) {
  const [answers, setAnswers] = useState<(number | undefined)[]>(() => questions.map(() => undefined))
  const [submitted, setSubmitted] = useState(false)
  const allAnswered = answers.every((a) => a !== undefined)
  const score = answers.filter((a, i) => a === questions[i].answer).length

  return (
    <section aria-labelledby="quiz-title" className="mt-10">
      <h2 id="quiz-title" className="font-serif text-2xl font-semibold">
        Check your understanding
      </h2>
      <p className="mt-1 text-stone-600 dark:text-stone-400">
        {questions.length} quick questions. This isn't a test you can fail; it's a way to help it stick.
      </p>

      <ol className="mt-6 space-y-8">
        {questions.map((q, qi) => {
          const chosen = answers[qi]
          return (
            <li key={qi}>
              <fieldset>
                <legend className="text-lg font-semibold">
                  <span className="mr-2 text-stone-600 dark:text-stone-400">{qi + 1}.</span>
                  {q.q}
                </legend>
                <div className="mt-3 space-y-2">
                  {q.options.map((opt, oi) => {
                    const isChosen = chosen === oi
                    const isRight = q.answer === oi
                    let style = 'border-stone-300 dark:border-stone-700'
                    if (submitted && isRight) style = 'border-emerald-600 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-950/50'
                    else if (submitted && isChosen) style = 'border-rose-600 bg-rose-50 dark:border-rose-500 dark:bg-rose-950/50'
                    else if (isChosen) style = 'border-amber-600 bg-amber-50 dark:border-amber-400 dark:bg-amber-950/40'
                    return (
                      <label
                        key={oi}
                        className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 ${style} ${submitted ? 'cursor-default' : ''}`}
                      >
                        <input
                          type="radio"
                          name={`q${qi}`}
                          className="size-5 shrink-0 accent-amber-700"
                          checked={isChosen}
                          disabled={submitted}
                          onChange={() => setAnswers((a) => a.map((x, i) => (i === qi ? oi : x)))}
                        />
                        <span className="flex-1">{opt}</span>
                        {submitted && isRight && (
                          <>
                            <CheckIcon className="shrink-0 text-emerald-700 dark:text-emerald-400" />
                            <span className="sr-only">Correct answer</span>
                          </>
                        )}
                        {submitted && isChosen && !isRight && (
                          <>
                            <CloseIcon className="shrink-0 text-rose-700 dark:text-rose-400" />
                            <span className="sr-only">Your answer</span>
                          </>
                        )}
                      </label>
                    )
                  })}
                </div>
                {submitted && q.explain && (
                  <p className="mt-3 rounded-xl bg-stone-100 p-4 text-[0.95rem] dark:bg-stone-800">
                    <strong>{chosen === q.answer ? 'Yes! ' : 'Not quite. '}</strong>
                    {q.explain}
                  </p>
                )}
              </fieldset>
            </li>
          )
        })}
      </ol>

      <div className="mt-8" aria-live="polite">
        {!submitted ? (
          <button type="button" className={buttonClass('primary', 'w-full')} disabled={!allAnswered} onClick={() => setSubmitted(true)}>
            {allAnswered ? 'Check my answers' : 'Answer every question to check'}
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-center text-lg font-semibold">
              You got {score} of {questions.length}
              {score === questions.length ? '. Well done!' : '. Have a look at the notes above.'}
            </p>
            <button type="button" className={buttonClass('primary', 'w-full')} onClick={() => onFinish(score)}>
              Mark lesson complete
            </button>
            <button
              type="button"
              className={buttonClass('ghost', 'w-full')}
              onClick={() => {
                setAnswers(questions.map(() => undefined))
                setSubmitted(false)
              }}
            >
              Try the questions again
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
