import { useEffect } from 'react'
import { User } from 'lucide-react'
import { catalog } from '../../../data/catalog'
import { budgetLabels } from '../../format'
import { useSession, type FallbackReason } from '../../session'
import { ScreenFrame } from '../../shell/ScreenFrame'
import './ProfileScreen.css'

const fallbackReason: Record<FallbackReason, string> = {
  skipped: 'Continued with Bucharest.',
  outside: 'You’re outside Bucharest.',
  denied: 'Location not shared.',
  unavailable: 'Couldn’t find your location.',
}

export function ProfileScreen() {
  const session = useSession()
  const { subtitle, detail } = describeLocation(session.location)

  useEffect(() => {
    document.title = 'Club Finder · Profile'
  }, [])

  return (
    <ScreenFrame title="Profile">
      <header className="profile__identity">
        <span className="profile__mark" aria-hidden>
          <User />
        </span>
        <div>
          <p className="profile__name cf-display">Guest</p>
          <p className="profile__subtitle">{subtitle}</p>
        </div>
      </header>

      <section className="profile__section" aria-labelledby="profile-taste">
        <h2 id="profile-taste" className="cf-label">
          Tonight’s taste
        </h2>
        <div className="profile__row">
          <h3 className="cf-label">Genres</h3>
          {session.genres.length === 0 ? (
            <p className="profile__empty">None picked</p>
          ) : (
            <ul className="profile__chips">
              {session.genres.map((genre) => (
                <li key={genre}>{genre}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="profile__row">
          <h3 className="cf-label">Budget</h3>
          <p className="profile__empty">{session.budget ? `${budgetLabels[session.budget]} EUR` : 'None picked'}</p>
        </div>
      </section>

      <section className="profile__section" aria-labelledby="profile-location">
        <h2 id="profile-location" className="cf-label">
          Location
        </h2>
        <p className="profile__detail">{detail}</p>
      </section>

      <p className="profile__later">Accounts come later.</p>
    </ScreenFrame>
  )
}

function describeLocation(location: ReturnType<typeof useSession>['location']): { subtitle: string; detail: string } {
  const center = catalog.city.defaultCenterName
  if (!location) {
    return {
      subtitle: 'Location not chosen',
      detail: 'The home screen asks before measuring distance.',
    }
  }
  if (location.kind === 'user') {
    return {
      subtitle: 'In Bucharest',
      detail: 'Shared. Distances are measured from your location.',
    }
  }
  return {
    subtitle: `Distances are measured from ${center}.`,
    detail: fallbackReason[location.reason],
  }
}
