import { Link } from 'react-router-dom'
import { PageTitle, buttonClass } from '../components/ui.tsx'

export function NotFoundPage() {
  return (
    <div>
      <PageTitle sub="That page doesn't exist. It may have moved.">Page not found</PageTitle>
      <Link to="/" className={buttonClass('primary')}>
        Go home
      </Link>
    </div>
  )
}
