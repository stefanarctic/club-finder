import { useEffect } from 'react'
import { Link } from 'react-router'
import { User } from 'lucide-react'
import { catalog } from '../../../data/catalog'
import { useLiveCatalog } from '../../../data/LiveCatalog'
import { cityContaining } from '../../../data/geo'
import { budgetLabels } from '../../format'
import { useSession, type FallbackReason } from '../../session'
import { ScreenFrame } from '../../shell/ScreenFrame'
import './ProfileScreen.css'

const fallbackReason: Record<FallbackReason, string> = {
  skipped: `Continued with ${catalog.defaultCity.name}.`,
  denied: 'Location not shared.',
  unavailable: 'Couldn’t find your location.',
}

export function ProfileScreen() {
  const session = useSession()
  const live = useLiveCatalog()
  const venuesById = new Map(live.venues.map((venue) => [venue.id, venue]))
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

      <section className="profile__section" aria-labelledby="profile-clubs">
        <div className="profile__section-head">
          <h2 id="profile-clubs" className="cf-label">
            My clubs
          </h2>
          <Link to="/profile/clubs/new">Add</Link>
        </div>
        <CatalogNote live={live} empty="No clubs yet." ready={live.venues.length > 0} />
        {live.venues.length > 0 && (
          <ul className="profile__list">
            {live.venues.map((venue) => (
              <li key={venue.id}>
                <Link to={`/profile/clubs/${venue.id}`} className="profile__item">
                  <span>{venue.name}</span>
                  <small>{venue.neighbourhood || venue.address}</small>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="profile__section" aria-labelledby="profile-events">
        <div className="profile__section-head">
          <h2 id="profile-events" className="cf-label">
            My events
          </h2>
          <Link to="/profile/events/new">Add</Link>
        </div>
        <CatalogNote live={live} empty="No events yet." ready={live.storedEvents.length > 0} />
        {live.storedEvents.length > 0 && (
          <ul className="profile__list">
            {live.storedEvents.map((event) => (
              <li key={event.id}>
                <Link to={`/profile/events/${event.id}`} className="profile__item">
                  <span>{event.name}</span>
                  <small>
                    {venuesById.get(event.venueId)?.name ?? 'No club'} · {when(event.startsAt)}
                  </small>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="profile__later">Editing is open until accounts exist. A club appears on the map once it has an upcoming event.</p>
    </ScreenFrame>
  )
}

function CatalogNote({
  live,
  empty,
  ready,
}: {
  live: ReturnType<typeof useLiveCatalog>
  empty: string
  ready: boolean
}) {
  if (ready) return null
  if (live.status === 'loading') return <p className="profile__empty">Loading…</p>
  if (live.status === 'unconfigured') return <p className="profile__empty">Firebase isn’t configured.</p>
  if (live.status === 'error') return <p className="profile__empty">{live.error ?? 'Couldn’t load the database.'}</p>
  return <p className="profile__empty">{empty}</p>
}

const whenFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

function when(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : whenFormat.format(date)
}

function describeLocation(location: ReturnType<typeof useSession>['location']): { subtitle: string; detail: string } {
  const center = catalog.defaultCity.defaultCenterName
  if (!location) {
    return {
      subtitle: 'Location not chosen',
      detail: 'The home screen asks before measuring distance.',
    }
  }
  if (location.kind === 'user') {
    const city = cityContaining(location.position, catalog.cities)
    return {
      subtitle: city ? `In ${city.name}` : 'Location shared',
      detail: 'Shared. Distances are measured from your location.',
    }
  }
  return {
    subtitle: `Distances are measured from ${center}.`,
    detail: fallbackReason[location.reason],
  }
}
