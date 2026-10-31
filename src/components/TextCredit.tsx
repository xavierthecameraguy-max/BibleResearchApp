import { Link } from 'react-router-dom'
import type { Translation } from '../lib/bible.ts'

/**
 * The copyright line under Bible text. Licensed translations also link to
 * the provider (their terms require it) and to the app's Copyright page.
 */
export function TextCredit({ used, notice, className = '' }: { used: Translation; notice: string; className?: string }) {
  if (used.kind !== 'online') return <span className={className}>{notice}</span>
  const site = used.attributionUrl?.replace(/^https?:\/\/(www\.)?/, '')
  return (
    <span className={className}>
      <span className="font-semibold">{used.abbr}</span> · {notice}{' '}
      {used.attributionUrl && (
        <>
          {used.provider?.startsWith('API.Bible') ? 'Provided by ' : ''}
          <a href={used.attributionUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            {site}
            <span className="sr-only"> (opens another website)</span>
          </a>
          {' · '}
        </>
      )}
      <Link to="/copyright" className="underline underline-offset-2">
        Copyright
      </Link>
    </span>
  )
}
