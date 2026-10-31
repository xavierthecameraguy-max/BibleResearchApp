// A simple prayer journal: things you're praying for, and how God answered.

import { useState } from 'react'
import { deletePrayer, savePrayer, useAppState, type PrayerItem } from '../lib/storage.ts'
import { useTitle } from '../lib/hooks.ts'
import { Card, PageTitle, Sheet, buttonClass } from '../components/ui.tsx'

function Editor({ item, onClose }: { item: Partial<PrayerItem> | null; onClose: () => void }) {
  const [title, setTitle] = useState(item?.title ?? '')
  const [details, setDetails] = useState(item?.details ?? '')
  const [answered, setAnswered] = useState(!!item?.answeredAt)
  const [answerNote, setAnswerNote] = useState(item?.answerNote ?? '')
  return (
    <Sheet open={!!item} onClose={onClose} title={item?.id ? 'Edit prayer' : 'New prayer'}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!title.trim()) return
          savePrayer({
            id: item?.id,
            createdAt: item?.createdAt,
            title: title.trim(),
            details,
            answeredAt: answered ? (item?.answeredAt ?? new Date().toISOString()) : undefined,
            answerNote: answered ? answerNote : undefined,
          })
          onClose()
        }}
      >
        <label className="block">
          <span className="font-semibold">What are you praying for?</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="mt-1 min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base dark:border-stone-700 dark:bg-stone-950"
          />
        </label>
        <label className="block">
          <span className="font-semibold">Details (optional)</span>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-xl border border-stone-300 bg-white p-3 text-base dark:border-stone-700 dark:bg-stone-950"
          />
        </label>
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" className="size-5 accent-amber-700" checked={answered} onChange={(e) => setAnswered(e.target.checked)} />
          <span className="font-semibold">Answered</span>
        </label>
        {answered && (
          <label className="block">
            <span className="font-semibold">How was it answered?</span>
            <textarea
              value={answerNote}
              onChange={(e) => setAnswerNote(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-stone-300 bg-white p-3 text-base dark:border-stone-700 dark:bg-stone-950"
            />
          </label>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button className={buttonClass('primary')}>Save</button>
          <button type="button" className={buttonClass('ghost')} onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Sheet>
  )
}

export function PrayerPage() {
  useTitle('Prayer journal')
  const prayers = useAppState((s) => s.prayers)
  const [editing, setEditing] = useState<Partial<PrayerItem> | null>(null)
  const [tab, setTab] = useState<'open' | 'answered'>('open')
  const shown = prayers.filter((p) => (tab === 'answered' ? p.answeredAt : !p.answeredAt))

  return (
    <div className="space-y-5">
      <PageTitle sub="Keep track of what you're praying for, and remember how God has answered (Philippians 4:6–7).">Prayer journal</PageTitle>
      <button type="button" className={buttonClass('primary', 'w-full')} onClick={() => setEditing({})}>
        Add a prayer
      </button>
      <div role="tablist" aria-label="Prayers" className="flex gap-2">
        {(
          [
            ['open', 'Praying'],
            ['answered', 'Answered'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`min-h-11 flex-1 rounded-full border font-semibold ${
              tab === id
                ? 'border-amber-700 bg-amber-700 text-white dark:border-amber-300 dark:bg-amber-300 dark:text-stone-950'
                : 'border-stone-300 dark:border-stone-700'
            }`}
          >
            {label} ({prayers.filter((p) => (id === 'answered' ? p.answeredAt : !p.answeredAt)).length})
          </button>
        ))}
      </div>
      <div role="tabpanel">
        <ul className="space-y-3">
          {!shown.length && (
            <li>
              <Card>{tab === 'open' ? 'Nothing here yet. What would you like to bring to God?' : 'Answered prayers will appear here.'}</Card>
            </li>
          )}
          {shown.map((p) => (
            <li key={p.id}>
              <Card>
                <h2 className="text-lg font-semibold">{p.title}</h2>
                {p.details && <p className="mt-1 whitespace-pre-line text-stone-700 dark:text-stone-300">{p.details}</p>}
                {p.answeredAt && (
                  <p className="mt-2 rounded-xl bg-emerald-50 p-3 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
                    <strong>Answered {new Date(p.answeredAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}.</strong>{' '}
                    {p.answerNote}
                  </p>
                )}
                <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
                  Started {new Date(p.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                </p>
                <div className="mt-3 flex gap-2">
                  <button type="button" className={buttonClass('secondary', 'flex-1')} onClick={() => setEditing(p)}>
                    {p.answeredAt ? 'Edit' : 'Edit or mark answered'}
                  </button>
                  <button
                    type="button"
                    className={buttonClass('ghost')}
                    onClick={() => confirm('Delete this prayer?') && deletePrayer(p.id)}
                  >
                    Delete
                  </button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </div>
      {editing && <Editor key={editing.id ?? 'new'} item={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
