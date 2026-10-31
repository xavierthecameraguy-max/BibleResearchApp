import { Link } from 'react-router-dom'
import { useTitle } from '../lib/hooks.ts'
import { BUNDLED } from '../lib/bible.ts'
import { Card, MentorNote, PageTitle } from '../components/ui.tsx'

export function AboutPage() {
  useTitle('About')
  return (
    <div className="space-y-5">
      <PageTitle>About Foundations</PageTitle>
      <MentorNote />
      <Card>
        <h2 className="font-serif text-xl font-semibold">What this is</h2>
        <p className="mt-2 leading-relaxed">
          Foundations is a gentle introduction to the Bible for people who are new to the Christian faith: its big story, how it came to
          us, how the church got from the first Christians to today, and how to read Scripture in its context.
        </p>
        <p className="mt-2 leading-relaxed">
          The lessons aim to follow mainstream historical scholarship. Dates are approximate, and where scholars disagree, or where
          Protestant, Catholic and Orthodox Christians see things differently, the lessons try to say so fairly.
        </p>
      </Card>
      <Card>
        <h2 className="font-serif text-xl font-semibold">Your privacy</h2>
        <p className="mt-2 leading-relaxed">
          There are no accounts and nothing is sent anywhere. Your progress, notes and any translation you import are stored only in this
          browser on this device. Use <Link to="/notes" className="underline underline-offset-2">Notes → Save backup</Link> to keep a copy.
        </p>
      </Card>
      <Card>
        <h2 className="font-serif text-xl font-semibold">Bible text</h2>
        <ul className="mt-2 list-disc space-y-2 pl-5 leading-relaxed">
          {BUNDLED.map((t) => (
            <li key={t.id}>{t.notice}</li>
          ))}
          <li>
            Other translations such as the NKJV are copyrighted by their publishers. Foundations links to them online, and you can import
            a copy you have for your own personal study (see <Link to="/settings#translations" className="underline underline-offset-2">Settings</Link>).
            Imported text stays on your device.
          </li>
        </ul>
      </Card>
      <Card>
        <h2 className="font-serif text-xl font-semibold">Credits</h2>
        <p className="mt-2 leading-relaxed">
          Lesson text written for Foundations. Recommended websites and books are listed on the{' '}
          <Link to="/resources" className="underline underline-offset-2">Further Resources</Link> page; their content belongs to their
          authors.
        </p>
      </Card>
    </div>
  )
}
