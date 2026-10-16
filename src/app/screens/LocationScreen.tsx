import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { LocateFixed } from 'lucide-react'
import { Button, VenuePin } from '../../design-system'
import { catalog } from '../../data/catalog'
import { useSession } from '../session'
import './Onboarding.css'

export type RedirectState = { from?: string } | null

export function LocationScreen() {
  const { setLocation } = useSession()
  const navigate = useNavigate()
  const from = (useLocation().state as RedirectState)?.from
  const [locating, setLocating] = useState(false)
  // A late geolocation answer must not override "Continue with Bucharest".
  const settled = useRef(false)

  useEffect(() => {
    document.title = 'Club Finder'
  }, [])

  const finish = (position: { latitude: number; longitude: number } | null, reason?: 'skipped' | 'denied' | 'unavailable') => {
    if (settled.current) return
    settled.current = true
    setLocation(position, reason)
    navigate('/interests', { replace: true, state: { from } })
  }

  const allow = () => {
    if (!('geolocation' in navigator)) return finish(null, 'unavailable')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => finish({ latitude: coords.latitude, longitude: coords.longitude }),
      (error) => finish(null, error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 5 * 60_000 },
    )
  }

  return (
    <main className="onb onb--location cf-atmosphere">
      <div className="onb__art" aria-hidden inert>
        <span className="onb__ring" />
        <span className="onb__ring" />
        <span className="onb__ring" />
        <VenuePin tonight />
      </div>

      <div className="onb__copy">
        <p className="cf-label onb__eyebrow">{catalog.city.name} · tonight</p>
        <h1 className="cf-display onb__title">Where’s the night?</h1>
        <p className="onb__body">
          We use your location to center the map on your city and show how far each club is from you. It stays on this
          device.
        </p>
      </div>

      <div className="onb__actions">
        <Button block size="lg" leadingIcon={<LocateFixed />} onClick={allow} disabled={locating}>
          {locating ? 'Finding you…' : 'Allow location'}
        </Button>
        <Button block size="lg" variant="ghost" onClick={() => finish(null, 'skipped')}>
          Continue with {catalog.city.name}
        </Button>
      </div>
    </main>
  )
}
