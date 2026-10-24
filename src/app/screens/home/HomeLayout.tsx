import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Banner, Button, EmptyState, EventCard, SectionHeader } from '../../../design-system'
import { catalog } from '../../../data/catalog'
import {
  buildListings,
  buildPins,
  groupListings,
  matchesFilters,
  sortListings,
  type Listing,
  type SortKey,
} from '../../../data/discovery'
import { boundsAroundPoints, cityContaining, isInsideCity, toLngLatBounds } from '../../../data/geo'
import type { TimeRange } from '../../../data/schedule'
import { startLabel } from '../../format'
import { EventMap } from '../../map/EventMap'
import { useSession, type FallbackReason } from '../../session'
import { useNow } from '../../useNow'
import { EventPanel } from '../event/EventPanel'
import { CityMenu } from './CityMenu'
import { LocationPrompt } from './LocationPrompt'
import { VenueStack } from './VenueStack'
import './HomeLayout.css'

const today = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

const fallbackPlace = catalog.defaultCity.defaultCenterName

const fallbackCopy: Record<FallbackReason, { tone: 'info' | 'warning'; title: string; body: string }> = {
  skipped: {
    tone: 'info',
    title: `Showing ${catalog.defaultCity.name}`,
    body: `Distances are measured from ${fallbackPlace}. Pick a city in filters to move the map, or zoom out to see everywhere.`,
  },
  denied: {
    tone: 'warning',
    title: 'Location not shared',
    body: `Distances are measured from ${fallbackPlace}. The map still covers everywhere.`,
  },
  unavailable: {
    tone: 'warning',
    title: 'Couldn’t find your location',
    body: `Distances are measured from ${fallbackPlace}. The map still covers everywhere.`,
  },
}

export function HomeLayout() {
  const session = useSession()
  const navigate = useNavigate()
  const now = useNow()
  const activeEventId = useParams().id ?? null

  const [pickedCityId, setPickedCityId] = useState<string | null>(null)
  const [cityFocus, setCityFocus] = useState(0)
  const [timeRange, setTimeRange] = useState<TimeRange>('all')
  const [sort, setSort] = useState<SortKey>('forYou')
  const [filterMapToo, setFilterMapToo] = useState(false)
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null)
  const [stackVenueId, setStackVenueId] = useState<string | null>(null)
  const [scrollTarget, setScrollTarget] = useState<{ eventId: string } | null>(null)

  const { origin, genres, budget } = session

  const selectedCity = useMemo(() => {
    const picked = catalog.cities.find((city) => city.id === pickedCityId)
    return picked ?? cityContaining(origin, catalog.cities) ?? catalog.defaultCity
  }, [pickedCityId, origin])

  const chooseCity = (id: string) => {
    setPickedCityId(id)
    setCityFocus((n) => n + 1)
  }

  const listings = useMemo(
    () =>
      buildListings({
        venues: catalog.venues,
        events: catalog.events,
        origin,
        preferences: { genres, budget },
        now,
      }),
    [origin, genres, budget, now],
  )

  const visible = useMemo(
    () => listings.filter((l) => matchesFilters(l, { timeRange, genres }, now)),
    [listings, timeRange, genres, now],
  )

  const pins = useMemo(() => buildPins(listings, new Set(visible.map((l) => l.event.id))), [listings, visible])
  const mapPins = useMemo(() => (filterMapToo ? pins.filter((p) => p.matched) : pins), [pins, filterMapToo])
  const cityBounds = useMemo(() => {
    const points = pins.map((pin) => pin.venue).filter((venue) => isInsideCity(venue, selectedCity))
    if (points.length === 0) return toLngLatBounds(selectedCity.boundingBox, 0.02)
    return boundsAroundPoints(selectedCity.defaultCenter, points, 0.008)
  }, [pins, selectedCity])
  const pinsByVenue = useMemo(() => new Map(pins.map((p) => [p.venue.id, p])), [pins])

  const groups = useMemo(() => groupListings(sortListings(visible, sort)), [visible, sort])

  const activeListing = activeEventId ? listings.find((l) => l.event.id === activeEventId) : undefined

  useEffect(() => {
    if (!activeEventId) document.title = `Club Finder · ${selectedCity.name}`
  }, [activeEventId, selectedCity.name])

  useEffect(() => {
    if (!scrollTarget || activeEventId) return
    document
      .getElementById(cardDomId(scrollTarget.eventId))
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [scrollTarget, activeEventId])

  const openEvent = (eventId: string) => {
    const listing = listings.find((l) => l.event.id === eventId)
    if (listing) setSelectedVenueId(listing.venue.id)
    setStackVenueId(null)
    navigate(`/events/${eventId}`, { state: { fromList: true } })
  }

  const handlePinClick = (venueId: string) => {
    const pin = pinsByVenue.get(venueId)
    if (!pin) return
    setSelectedVenueId(venueId)
    const visibleIds = new Set(visible.map((l) => l.event.id))
    const target = pin.listings.find((l) => visibleIds.has(l.event.id))
    setStackVenueId(pin.listings.length > 1 || !target ? venueId : null)
    if (target) setScrollTarget({ eventId: target.event.id })
    if (activeEventId) navigate('/')
  }

  const clearSelection = () => {
    setStackVenueId(null)
    setSelectedVenueId(null)
  }

  const clearFilters = () => {
    setTimeRange('all')
    session.setGenres([])
  }

  const fallback = session.location?.kind === 'fallback' ? fallbackCopy[session.location.reason] : null
  const stackPin = stackVenueId ? pinsByVenue.get(stackVenueId) : undefined
  const focusVenueId = activeListing?.venue.id ?? null

  const renderCard = (listing: Listing) => {
    const atVenue = pinsByVenue.get(listing.venue.id)?.listings.length ?? 1
    return (
      <li key={listing.event.id} id={cardDomId(listing.event.id)} className="home-list__item">
        <EventCard
          id={listing.event.id}
          name={listing.event.name}
          venueName={listing.venue.name}
          startLabel={startLabel(listing.event, now)}
          reasons={listing.reasons}
          genres={listing.event.genres}
          matchedGenres={listing.matchedGenres}
          tonight={listing.sameDay}
          live={listing.live}
          selected={listing.venue.id === (focusVenueId ?? selectedVenueId)}
          moreAtVenue={atVenue > 1 ? atVenue - 1 : undefined}
          image={listing.event.image}
          onSelect={openEvent}
        />
      </li>
    )
  }

  return (
    <div className="home">
      <EventMap
        className="home__map"
        bounds={cityBounds}
        boundsKey={`${selectedCity.id}:${cityFocus}`}
        fitMinZoom={12}
        placeName={selectedCity.defaultCenterName}
        pins={mapPins}
        origin={origin}
        userPosition={session.userPosition}
        followUser={session.userPosition != null && isInsideCity(session.userPosition, selectedCity)}
        selectedVenueId={focusVenueId ?? selectedVenueId}
        stackVenueId={stackPin ? stackVenueId : null}
        stackContent={
          stackPin && (
            <VenueStack pin={stackPin} now={now} onOpen={openEvent} onClose={() => setStackVenueId(null)} />
          )
        }
        focusVenueId={focusVenueId}
        onPinClick={handlePinClick}
        onBackgroundClick={clearSelection}
        inert={!session.location}
        topBar={
          <CityMenu
            cities={catalog.cities}
            cityId={selectedCity.id}
            onCityChange={chooseCity}
            cityName={selectedCity.name}
            dateLabel={today.format(now)}
            eventCount={listings.length}
            venueCount={pins.length}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
            sort={sort}
            onSortChange={setSort}
            genres={genres}
            onGenresChange={session.setGenres}
            budget={budget}
            onBudgetChange={session.setBudget}
            filterMapToo={filterMapToo}
            onFilterMapTooChange={setFilterMapToo}
          />
        }
      />

      <section className="home__sheet" aria-label="Events" inert={activeEventId || !session.location ? true : undefined}>
        {fallback && !session.bannerDismissed && (
          <Banner tone={fallback.tone} title={fallback.title} onDismiss={session.dismissBanner}>
            {fallback.body}
          </Banner>
        )}

        {visible.length === 0 ? (
          <EmptyState
            title="Nothing matches"
            action={
              <Button size="sm" variant="secondary" onClick={clearFilters}>
                Clear time range & genres
              </Button>
            }
          >
            No events fit this time range and these genres. The map hasn’t changed.
          </EmptyState>
        ) : (
          <>
            {groups.tonight.length > 0 && (
              <section className="home-list" aria-label="Tonight">
                <SectionHeader title="Tonight" count={groups.tonight.length} tonight />
                <ul className="home-list__items">{groups.tonight.map(renderCard)}</ul>
              </section>
            )}
            {groups.comingUp.length > 0 && (
              <section className="home-list" aria-label="Coming up">
                <SectionHeader title="Coming up" count={groups.comingUp.length} />
                <ul className="home-list__items">{groups.comingUp.map(renderCard)}</ul>
              </section>
            )}
          </>
        )}

        <footer className="home__footer">
          <p>Placeholder venues and events. Ticketing is coming later.</p>
        </footer>
      </section>

      {!session.location && <LocationPrompt />}

      {activeEventId && (
        <EventPanel
          eventId={activeEventId}
          listing={activeListing}
          siblings={activeListing ? (pinsByVenue.get(activeListing.venue.id)?.listings ?? []) : []}
          now={now}
          onOpenEvent={openEvent}
        />
      )}
    </div>
  )
}

const cardDomId = (eventId: string) => `card-${eventId}`
