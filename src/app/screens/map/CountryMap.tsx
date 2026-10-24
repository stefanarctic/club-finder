import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { catalog } from '../../../data/catalog'
import { buildListings, buildPins } from '../../../data/discovery'
import { boundsAround, countryContaining, toLngLatBounds } from '../../../data/geo'
import { romaniaOutline } from '../../../data/romaniaOutline'
import { EventMap } from '../../map/EventMap'
import { useSession } from '../../session'
import { useNow } from '../../useNow'
import './CountryMap.css'

export function CountryMap() {
  const now = useNow()
  const navigate = useNavigate()
  const session = useSession()

  const point = session.userPosition ?? catalog.defaultCity.defaultCenter
  const country = countryContaining(point, catalog.countries)
  const viewName = country?.name ?? 'Nearby'
  const bounds = useMemo(
    () => toLngLatBounds(country ? country.boundingBox : boundsAround(point)),
    [country, point],
  )

  const listings = useMemo(
    () =>
      buildListings({
        venues: catalog.venues,
        events: catalog.events,
        origin: session.origin,
        preferences: { genres: [], budget: null },
        now,
      }),
    [session.origin, now],
  )
  const pins = useMemo(
    () => buildPins(listings, new Set(listings.map((listing) => listing.event.id))),
    [listings],
  )

  useEffect(() => {
    document.title = `Club Finder · ${viewName}`
  }, [viewName])

  const openPin = (venueId: string) => {
    const eventId = pins.find((pin) => pin.venue.id === venueId)?.listings[0]?.event.id
    if (eventId) navigate(`/events/${eventId}`)
  }

  return (
    <div className="country">
      <EventMap
        className="country__map"
        bounds={bounds}
        boundsKey={country?.id ?? 'nearby'}
        placeName={viewName}
        resetBounds={bounds}
        resetLabel={`Show ${viewName}`}
        outline={country?.id === 'romania' ? romaniaOutline : undefined}
        pins={pins}
        origin={session.origin}
        userPosition={session.userPosition}
        followUser={false}
        selectedVenueId={null}
        stackVenueId={null}
        onPinClick={openPin}
        onBackgroundClick={() => {}}
      />
    </div>
  )
}
