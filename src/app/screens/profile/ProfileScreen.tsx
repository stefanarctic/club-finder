import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { User } from 'lucide-react'
import { Button, Chip } from '../../../design-system'
import { catalog } from '../../../data/catalog'
import { useLiveCatalog } from '../../../data/LiveCatalog'
import { cityContaining } from '../../../data/geo'
import { uploadImage } from '../../../data/records'
import { BUDGETS, GENRES, MAX_GENRE_PICKS, type Genre } from '../../../data/types'
import { authError, canManage, useAccount } from '../../auth'
import { budgetLabels, roleLabels } from '../../format'
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
  const auth = useAccount()
  const { subtitle, detail } = describeLocation(session.location)

  useEffect(() => {
    document.title = 'Club Finder · Profile'
  }, [])

  return (
    <ScreenFrame title="Profile">
      {!auth.ready ? (
        <p className="profile__empty">Loading account…</p>
      ) : !auth.user || !auth.account ? (
        <AccountGate />
      ) : (
        <SignedIn subtitle={subtitle} detail={detail} />
      )}
      {auth.account && live.status === 'error' && <p className="profile__empty">{live.error}</p>}
    </ScreenFrame>
  )
}

function AccountGate() {
  const session = useSession()
  const { user, signIn, signUp } = useAccount()
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setError(null)
    setBusy(true)
    try {
      if (mode === 'sign-in') await signIn(email, password)
      else {
        if (!name.trim()) {
          setError('Add your name.')
          return
        }
        await signUp({ name, email, password, genres: session.genres, budget: session.budget })
      }
    } catch (err) {
      setError(authError(err))
    } finally {
      setBusy(false)
    }
  }

  if (user) return <p className="profile__empty">Opening your profile…</p>

  return (
    <form
      className="profile__form"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <p className="profile__detail">Sign in to save your taste. Event tools appear after an admin promotes the account.</p>
      {mode === 'sign-up' && (
        <label className="profile__field">
          <span className="cf-label">Name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
        </label>
      )}
      <label className="profile__field">
        <span className="cf-label">Email</span>
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
      </label>
      <label className="profile__field">
        <span className="cf-label">Password</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
          required
          minLength={6}
        />
      </label>
      {error && <p className="profile__error">{error}</p>}
      <Button type="submit" disabled={busy}>
        {busy ? 'Working…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
      </Button>
      <button type="button" className="profile__switch" onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}>
        {mode === 'sign-in' ? 'Need an account? Create one' : 'Already have an account? Sign in'}
      </button>
    </form>
  )
}

function SignedIn({ subtitle, detail }: { subtitle: string; detail: string }) {
  const session = useSession()
  const live = useLiveCatalog()
  const { account, people, signOut, saveProfile, setRole } = useAccount()
  const profile = account!
  const [name, setName] = useState(profile.displayName)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'save' | 'photo' | 'role' | null>(null)
  const manager = canManage(profile)
  const events = live.storedEvents.filter((event) => profile.role === 'admin' || event.createdBy === profile.id)

  useEffect(() => {
    setName(profile.displayName)
  }, [profile.id, profile.displayName])

  const save = async () => {
    if (!name.trim()) {
      setError('Add your name.')
      return
    }
    setError(null)
    setBusy('save')
    try {
      await saveProfile({ displayName: name.trim(), photoURL: profile.photoURL })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile.')
    } finally {
      setBusy(null)
    }
  }

  const upload = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setBusy('photo')
    try {
      const photoURL = await uploadImage('profiles', profile.id, file)
      await saveProfile({ displayName: name.trim() || profile.displayName, photoURL })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload the photo.')
    } finally {
      setBusy(null)
    }
  }

  const promote = async (uid: string, role: 'user' | 'organizer') => {
    setError(null)
    setBusy('role')
    try {
      await setRole(uid, role)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change that role.')
    } finally {
      setBusy(null)
    }
  }

  const toggleGenre = (genre: Genre, on: boolean) => {
    session.setGenres((current) =>
      on ? [...new Set([...current, genre])].slice(0, MAX_GENRE_PICKS) : current.filter((item) => item !== genre),
    )
  }

  return (
    <>
      <header className="profile__identity">
        {profile.photoURL ? (
          <img className="profile__photo" src={profile.photoURL} alt="" />
        ) : (
          <span className="profile__mark" aria-hidden>
            <User />
          </span>
        )}
        <div>
          <p className="profile__name cf-display">{profile.displayName}</p>
          <p className="profile__subtitle">
            {roleLabels[profile.role]} · {subtitle}
          </p>
        </div>
      </header>

      <form
        className="profile__form"
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        <label className="profile__field">
          <span className="cf-label">Name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="profile__field">
          <span className="cf-label">Email</span>
          <input value={profile.email} readOnly />
        </label>
        <label className="profile__field">
          <span className="cf-label">Photo</span>
          <input
            type="file"
            accept="image/*"
            aria-label="Upload a profile photo"
            disabled={busy != null}
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              void upload(file)
            }}
          />
          {busy === 'photo' && <span className="profile__empty">Uploading…</span>}
        </label>
        {error && <p className="profile__error">{error}</p>}
        <div className="profile__actions">
          <Button type="submit" disabled={busy != null}>
            {busy === 'save' ? 'Saving…' : 'Save profile'}
          </Button>
          <Button type="button" variant="ghost" disabled={busy != null} onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </form>

      <section className="profile__section" aria-labelledby="profile-taste">
        <h2 id="profile-taste" className="cf-label">
          Taste
        </h2>
        <p className="profile__detail">Saved on this account. The same picks filter the home list.</p>
        <div className="profile__chips">
          {GENRES.map((genre) => (
            <Chip
              key={genre}
              selected={session.genres.includes(genre)}
              disabled={!session.genres.includes(genre) && session.genres.length >= MAX_GENRE_PICKS}
              onSelectedChange={(on) => toggleGenre(genre, on)}
            >
              {genre}
            </Chip>
          ))}
        </div>
        <div className="profile__chips">
          {BUDGETS.map((budget) => (
            <Chip
              key={budget}
              selected={session.budget === budget}
              onSelectedChange={(on) => session.setBudget(on ? budget : null)}
            >
              {budgetLabels[budget]} EUR
            </Chip>
          ))}
        </div>
      </section>

      <section className="profile__section" aria-labelledby="profile-location">
        <h2 id="profile-location" className="cf-label">
          Location
        </h2>
        <p className="profile__detail">{detail}</p>
      </section>

      {manager && (
        <section className="profile__section" aria-labelledby="profile-events">
          <div className="profile__section-head">
            <h2 id="profile-events" className="cf-label">
              {profile.role === 'admin' ? 'All events' : 'My events'}
            </h2>
            <Link to="/profile/events/new">Add</Link>
          </div>
          {live.status === 'loading' ? (
            <p className="profile__empty">Loading…</p>
          ) : events.length === 0 ? (
            <p className="profile__empty">No events yet.</p>
          ) : (
            <ul className="profile__list">
              {events.map((event) => (
                <li key={event.id}>
                  <Link to={`/profile/events/${event.id}`} className="profile__item">
                    <span>{event.name}</span>
                    <small>
                      {event.venue.name} · {when(event.startsAt)}
                    </small>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {!manager && (
        <p className="profile__later">Event tools appear here after an admin promotes this account to event manager.</p>
      )}

      {profile.role === 'admin' && (
        <section className="profile__section" aria-labelledby="profile-people">
          <h2 id="profile-people" className="cf-label">
            People
          </h2>
          <ul className="profile__list">
            {people.map((person) => (
              <li key={person.id} className="profile__person">
                <div>
                  <span>{person.displayName}</span>
                  <small>
                    {person.email} · {roleLabels[person.role]}
                  </small>
                </div>
                {person.id !== profile.id && person.role !== 'admin' && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy != null}
                    onClick={() => void promote(person.id, person.role === 'organizer' ? 'user' : 'organizer')}
                  >
                    {person.role === 'organizer' ? 'Make user' : 'Make event manager'}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
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
      detail: 'The home screen asks before measuring distance. Location stays on this device.',
    }
  }
  if (location.kind === 'user') {
    const city = cityContaining(location.position, catalog.cities)
    return {
      subtitle: city ? `In ${city.name}` : 'Location shared',
      detail: 'Shared on this device. Distances are measured from your location.',
    }
  }
  return {
    subtitle: `Distances are measured from ${center}.`,
    detail: fallbackReason[location.reason],
  }
}
