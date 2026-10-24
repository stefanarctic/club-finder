import { useRef, useState } from 'react'
import { LocateFixed } from 'lucide-react'
import { Button } from '../../../design-system'
import { catalog } from '../../../data/catalog'
import { useSession } from '../../session'
import './LocationPrompt.css'

export function LocationPrompt() {
  const { location, setLocation } = useSession()
  const [locating, setLocating] = useState(false)
  // A late geolocation answer must not override "Show Bucharest".
  const settled = useRef(false)

  if (location) return null

  const finish = (
    position: { latitude: number; longitude: number } | null,
    reason?: 'skipped' | 'denied' | 'unavailable',
  ) => {
    if (settled.current) return
    settled.current = true
    setLocation(position, reason)
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
    <div className="loc-prompt">
      <div
        className="loc-prompt__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="loc-prompt-title"
        aria-describedby="loc-prompt-body"
      >
        <p className="cf-label loc-prompt__eyebrow">{catalog.defaultCity.name} · tonight</p>
        <h2 id="loc-prompt-title" className="cf-display loc-prompt__title">
          Use your location?
        </h2>
        <p id="loc-prompt-body" className="loc-prompt__body">
          Allow it and the map centers on you, wherever you are. Otherwise it opens on {catalog.defaultCity.name}.
        </p>
        <div className="loc-prompt__actions">
          <Button block size="lg" leadingIcon={<LocateFixed />} onClick={allow} disabled={locating} autoFocus>
            {locating ? 'Finding you…' : 'Allow location'}
          </Button>
          <Button block size="lg" variant="ghost" onClick={() => finish(null, 'skipped')}>
            Show {catalog.defaultCity.name}
          </Button>
        </div>
      </div>
    </div>
  )
}
