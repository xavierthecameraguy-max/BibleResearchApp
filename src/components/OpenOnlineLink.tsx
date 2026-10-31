import { externalPassageUrl, formatReference, type Passage } from '../lib/references.ts'
import { useAppState } from '../lib/storage.ts'
import { ExternalIcon } from './Icons.tsx'

/** "Open in NKJV": opens the passage on Bible Gateway or YouVersion. */
export function OpenOnlineLink({ passage, className = '' }: { passage: Passage; className?: string }) {
  const version = useAppState((s) => s.settings.linkVersion)
  const site = useAppState((s) => s.settings.linkSite)
  const siteName = site === 'youversion' ? 'YouVersion' : site === 'blueletterbible' ? 'Blue Letter Bible' : 'Bible Gateway'
  return (
    <a
      href={externalPassageUrl(passage, version, site)}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      Open in {version}
      <span className="sr-only">
        : {formatReference(passage)} on {siteName} (opens another website)
      </span>
      <ExternalIcon className="text-stone-500" width="1.1em" height="1.1em" />
    </a>
  )
}
