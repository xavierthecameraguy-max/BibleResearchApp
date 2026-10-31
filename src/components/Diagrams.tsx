// Simple, accessible diagrams that lessons can include with a line like
//   {{diagram:big-story}}
// They use currentColor and theme-aware classes so they work in every theme.

import type { ReactNode } from 'react'

function Figure({ title, caption, children }: { title: string; caption: string; children: ReactNode }) {
  return (
    <figure className="not-prose my-6 rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
      <figcaption className="mb-3">
        <span className="block font-serif text-lg font-semibold">{title}</span>
        <span className="block text-sm text-stone-600 dark:text-stone-400">{caption}</span>
      </figcaption>
      {children}
    </figure>
  )
}

function BigStory() {
  const acts = [
    ['1', 'Creation', 'God makes a good world', 'Gen 1–2'],
    ['2', 'Fall', 'Humanity turns away', 'Gen 3–11'],
    ['3', 'Israel', 'God chooses a people to bless the world', 'Gen 12 – Malachi'],
    ['4', 'Jesus', 'The King arrives, dies and rises', 'Gospels'],
    ['5', 'Church', 'The good news goes to all nations', 'Acts – Jude'],
    ['6', 'New creation', 'God makes all things new', 'Revelation'],
  ]
  return (
    <Figure title="The Bible's big story in six acts" caption="One story, from the first page to the last.">
      <ol className="relative space-y-3 border-l-4 border-amber-500 pl-5">
        {acts.map(([n, name, what, where]) => (
          <li key={n} className="relative">
            <span
              aria-hidden="true"
              className="absolute -left-[2.15rem] top-0.5 flex size-7 items-center justify-center rounded-full bg-amber-600 text-sm font-bold text-white dark:bg-amber-400 dark:text-stone-950"
            >
              {n}
            </span>
            <span className="block font-semibold">{name}</span>
            <span className="block text-[0.95rem]">{what}</span>
            <span className="block text-xs text-stone-600 dark:text-stone-400">{where}</span>
          </li>
        ))}
      </ol>
    </Figure>
  )
}

function Library() {
  const shelves: [string, string, number, string][] = [
    ['Old Testament', 'Law (Torah)', 5, 'Genesis – Deuteronomy'],
    ['Old Testament', 'History', 12, 'Joshua – Esther'],
    ['Old Testament', 'Poetry & Wisdom', 5, 'Job – Song of Songs'],
    ['Old Testament', 'Major Prophets', 5, 'Isaiah – Daniel'],
    ['Old Testament', 'Minor Prophets', 12, 'Hosea – Malachi'],
    ['New Testament', 'Gospels', 4, 'Matthew – John'],
    ['New Testament', 'Church history', 1, 'Acts'],
    ['New Testament', "Paul's letters", 13, 'Romans – Philemon'],
    ['New Testament', 'Other letters', 8, 'Hebrews – Jude'],
    ['New Testament', 'Prophecy', 1, 'Revelation'],
  ]
  return (
    <Figure title="A library of 66 books" caption="Protestant order. Each block is one book.">
      <div className="space-y-2">
        {shelves.map(([t, name, n, range]) => (
          <div key={name}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-semibold">{name}</span>
              <span className="text-right text-stone-600 dark:text-stone-400">
                {n} · {range}
              </span>
            </div>
            <div className="mt-1 flex gap-0.5" aria-hidden="true">
              {Array.from({ length: n }, (_, i) => (
                <span key={i} className={`h-4 flex-1 rounded-sm ${t === 'Old Testament' ? 'bg-amber-500/80' : 'bg-sky-500/80'}`} style={{ maxWidth: '1.4rem' }} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 flex gap-4 text-xs text-stone-600 dark:text-stone-400">
        <span className="flex items-center gap-1">
          <span className="size-3 rounded-sm bg-amber-500/80" aria-hidden="true" /> Old Testament (39)
        </span>
        <span className="flex items-center gap-1">
          <span className="size-3 rounded-sm bg-sky-500/80" aria-hidden="true" /> New Testament (27)
        </span>
      </p>
    </Figure>
  )
}

function Canons() {
  const rows: [string, number, number, string][] = [
    ['Protestant', 39, 0, '66 books'],
    ['Catholic', 39, 7, '73 books'],
    ['Orthodox', 39, 10, 'about 76–81 books (varies by church)'],
  ]
  return (
    <Figure title="Three Bibles, one New Testament" caption="All three share the same 27 New Testament books; the Old Testament lists differ.">
      <div className="space-y-3">
        {rows.map(([name, ot, extra, total]) => (
          <div key={name}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="shrink-0 font-semibold">{name}</span>
              <span className="text-right text-stone-600 dark:text-stone-400">{total}</span>
            </div>
            <div className="mt-1 flex h-5 overflow-hidden rounded-md text-[0.65rem] font-semibold" aria-hidden="true">
              <span className="flex items-center justify-center bg-amber-500/80 text-stone-950" style={{ width: `${(ot / 76) * 100}%` }}>
                OT 39
              </span>
              {extra > 0 && (
                <span className="flex items-center justify-center bg-rose-400/80 text-stone-950" style={{ width: `${(extra / 76) * 100}%` }}>
                  +{extra}
                </span>
              )}
              <span className="flex flex-1 items-center justify-center bg-sky-500/80 text-stone-950">NT 27</span>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-stone-600 dark:text-stone-400">
        Pink: the deuterocanonical books (called the Apocrypha by Protestants), such as Tobit, Judith, Wisdom, Sirach, Baruch and 1–2
        Maccabees.
      </p>
    </Figure>
  )
}

function EnglishBible() {
  const items: [string, string, string][] = [
    ['1380s', 'Wycliffe Bible', 'First complete English Bible, translated from Latin'],
    ['1526', 'Tyndale New Testament', 'First printed English NT, from the Greek'],
    ['1560', 'Geneva Bible', 'The Bible of Shakespeare and the Pilgrims'],
    ['1582–1610', 'Douay–Rheims', 'Catholic English translation'],
    ['1611', 'King James Version', 'Standard text revised in 1769'],
    ['1885–1901', 'Revised & American Standard', 'Drew on older manuscripts'],
    ['1952', 'RSV', 'A major modern revision'],
    ['1970s–80s', 'NASB, NIV, NKJV', 'Modern translations multiply'],
    ['1996–2017', 'NLT, ESV, CSB…', 'Newer translations and revisions'],
  ]
  return (
    <Figure title="How the Bible came into English" caption="Some milestones (dates approximate where marked).">
      <ol className="space-y-2">
        {items.map(([when, name, what]) => (
          <li key={name} className="grid grid-cols-[5.5rem_1fr] gap-3">
            <span className="text-sm font-semibold tabular-nums text-amber-800 dark:text-amber-300">{when}</span>
            <span>
              <span className="block font-semibold">{name}</span>
              <span className="block text-sm text-stone-600 dark:text-stone-400">{what}</span>
            </span>
          </li>
        ))}
      </ol>
    </Figure>
  )
}

function Genres() {
  const g: [string, string, string][] = [
    ['Narrative', 'Stories of what happened', 'Genesis, Samuel, Acts'],
    ['Law', "Instructions for Israel's covenant life", 'Exodus – Deuteronomy'],
    ['Poetry', 'Songs, prayers and laments', 'Psalms, Song of Songs'],
    ['Wisdom', 'How to live well; hard questions', 'Proverbs, Job, Ecclesiastes'],
    ['Prophecy', 'God’s messages to his people', 'Isaiah – Malachi'],
    ['Gospel', 'The life and teaching of Jesus', 'Matthew – John'],
    ['Letter', 'Teaching for churches and people', 'Romans – Jude'],
    ['Apocalyptic', 'Visions full of symbols and hope', 'Daniel 7–12, Revelation'],
  ]
  return (
    <Figure title="Eight kinds of writing" caption="Each genre is read in its own way.">
      <dl className="grid grid-cols-2 gap-2">
        {g.map(([name, what, ex]) => (
          <div key={name} className="rounded-xl bg-stone-100 p-3 dark:bg-stone-800/60">
            <dt className="font-semibold">{name}</dt>
            <dd className="text-sm">{what}</dd>
            <dd className="mt-1 text-xs text-stone-600 dark:text-stone-400">{ex}</dd>
          </div>
        ))}
      </dl>
    </Figure>
  )
}

export const DIAGRAMS: Record<string, () => React.JSX.Element> = {
  'big-story': BigStory,
  library: Library,
  canons: Canons,
  'english-bible': EnglishBible,
  genres: Genres,
}
