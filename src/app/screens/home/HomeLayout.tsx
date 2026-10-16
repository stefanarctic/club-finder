import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { MapPin } from 'lucide-react'
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
import type { TimeRange } from '../../../data/schedule'
import { startLabel } from '../../format'
import { EventMap } from '../../map/EventMap'
import { useSession, type FallbackReason } from '../../session'
import { useNow } from '../../useNow'
import { EventPanel } from '../event/EventPanel'
import { ListControls } from './ListControls'
import { VenueStack } from './VenueStack'
import './HomeLayout.css'

const today = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

type SplitMetrics = {
  min: number
  max: number
  compact: number
  mid: number
  large: number
  expanded: number
}

/** Pixel stops for the phone map/list split. Desktop ignores these. */
function splitMetrics(total: number, peek = 48): SplitMetrics {
  const overlap = 24
  const min = 240
  // Tallest map still leaves the resize bar on screen.
  const max = Math.max(min, Math.round(total - peek + overlap))
  const clamp = (n: number) => Math.round(Math.min(max, Math.max(min, n)))
  return {
    min,
    max,
    compact: clamp(total * 0.3),
    mid: clamp(total * 0.42),
    large: clamp(total * 0.72),
    expanded: max,
  }
}

let peekCache = { width: -1, height: -1, peek: 48 }

function readPeek(home: HTMLElement | null) {
  if (!home) return 48
  if (home.clientWidth === peekCache.width && home.clientHeight === peekCache.height) return peekCache.peek
  const probe = document.createElement('div')
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;height:var(--home-sheet-peek)'
  home.appendChild(probe)
  const peek = probe.getBoundingClientRect().height || 48
  probe.remove()
  peekCache = { width: home.clientWidth, height: home.clientHeight, peek }
  return peek
}

function nearestSplit(height: number, metrics: SplitMetrics) {
  return [metrics.compact, metrics.mid, metrics.large, metrics.expanded].reduce((best, stop) =>
    Math.abs(stop - height) < Math.abs(best - height) ? stop : best,
  )
}

const fallbackCopy: Record<FallbackReason, { tone: 'info' | 'warning'; title: string; body: string }> = {
  skipped: {
    tone: 'info',
    title: 'Showing Bucharest',
    body: `This demo only maps Bucharest. Distances are measured from ${catalog.city.defaultCenterName}.`,
  },
  outside: {
    tone: 'warning',
    title: 'You’re outside Bucharest',
    body: `This demo only maps Bucharest, so distances are measured from ${catalog.city.defaultCenterName}.`,
  },
  denied: {
    tone: 'warning',
    title: 'Location not shared',
    body: `This demo only maps Bucharest. Distances are measured from ${catalog.city.defaultCenterName}.`,
  },
  unavailable: {
    tone: 'warning',
    title: 'Couldn’t find your location',
    body: `This demo only maps Bucharest. Distances are measured from ${catalog.city.defaultCenterName}.`,
  },
}

export function HomeLayout() {
  const session = useSession()
  const navigate = useNavigate()
  const now = useNow()
  const activeEventId = useParams().id ?? null
  const homeRef = useRef<HTMLDivElement>(null)
  const [mapHeight, setMapHeight] = useState<number | null>(null)
  const [resizing, setResizing] = useState(false)
  const dragRef = useRef<{ pointerId: number; startY: number; startHeight: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)

  const metrics = () => {
    const home = homeRef.current
    const total = home?.clientHeight ?? window.innerHeight
    return splitMetrics(total, readPeek(home))
  }
  const readMapHeight = () => homeRef.current?.querySelector<HTMLElement>('.home__map')?.clientHeight ?? metrics().mid
  const mapExpanded = mapHeight != null && mapHeight >= metrics().max - 24

  const toggleMapSize = () => {
    const box = metrics()
    const nowHeight = readMapHeight()
    const next = Math.abs(nowHeight - box.expanded) < 36 ? box.mid : box.expanded
    if (mapHeight == null) {
      setResizing(true)
      setMapHeight(nowHeight)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setResizing(false)
          setMapHeight(next)
        })
      })
      return
    }
    setMapHeight(next)
  }

  const onResizePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    dragRef.current = { pointerId: event.pointerId, startY: event.clientY, startHeight: readMapHeight(), moved: false }
    setResizing(true)
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Capture needs an active pointer. The move listeners still track this gesture.
    }
  }

  const onResizePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || event.pointerId !== drag.pointerId) return
    const delta = event.clientY - drag.startY
    if (Math.abs(delta) > 6) drag.moved = true
    const box = metrics()
    setMapHeight(Math.min(box.max, Math.max(box.min, drag.startHeight + delta)))
  }

  const onResizePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || event.pointerId !== drag.pointerId) return
    dragRef.current = null
    setResizing(false)
    if (!drag.moved) return
    suppressClick.current = true
    const box = metrics()
    const next = nearestSplit(drag.startHeight + (event.clientY - drag.startY), box)
    setMapHeight(Math.min(box.max, Math.max(box.min, next)))
  }

  const onResizeClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    toggleMapSize()
  }

  const onResizeKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const box = metrics()
    const delta = event.key === 'ArrowDown' ? 56 : -56
    setMapHeight(Math.min(box.max, Math.max(box.min, readMapHeight() + delta)))
  }

  const [timeRange, setTimeRange] = useState<TimeRange>('all')
  const [sort, setSort] = useState<SortKey>('forYou')
  const [filterMapToo, setFilterMapToo] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null)
  const [stackVenueId, setStackVenueId] = useState<string | null>(null)
  const [scrollTarget, setScrollTarget] = useState<{ eventId: string } | null>(null)

  const { origin, genres, budget } = session

  const listings = useMemo(
    () => buildListings({ ...catalog, origin, preferences: { genres, budget }, now }),
    [origin, genres, budget, now],
  )

  const visible = useMemo(
    () => listings.filter((l) => matchesFilters(l, { timeRange, genres }, now)),
    [listings, timeRange, genres, now],
  )

  const pins = useMemo(() => buildPins(listings, new Set(visible.map((l) => l.event.id))), [listings, visible])
  const mapPins = useMemo(() => (filterMapToo ? pins.filter((p) => p.matched) : pins), [pins, filterMapToo])
  const pinsByVenue = useMemo(() => new Map(pins.map((p) => [p.venue.id, p])), [pins])

  const groups = useMemo(() => groupListings(sortListings(visible, sort)), [visible, sort])

  const activeListing = activeEventId ? listings.find((l) => l.event.id === activeEventId) : undefined

  useEffect(() => {
    if (!activeEventId) document.title = 'Club Finder · Bucharest'
  }, [activeEventId])

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
    <div
      ref={homeRef}
      className={resizing ? 'home is-resizing' : 'home'}
      style={mapHeight != null ? ({ '--home-map-height': `${mapHeight}px` } as CSSProperties) : undefined}
    >
      <EventMap
        className="home__map"
        city={catalog.city}
        pins={mapPins}
        origin={origin}
        userPosition={session.userPosition}
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
        mapExpanded={mapExpanded}
        onToggleMapSize={toggleMapSize}
        topBar={
          <span className="home__city">
            <MapPin aria-hidden /> {catalog.city.name}
          </span>
        }
      />

      <section className="home__sheet" aria-label="Events" inert={activeEventId ? true : undefined}>
        <button
          type="button"
          className="home__resize"
          aria-label="Resize map"
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          onPointerCancel={onResizePointerUp}
          onClick={onResizeClick}
          onKeyDown={onResizeKeyDown}
        >
          <span className="home__grabber" />
        </button>

        <header className="home__head">
          <p className="cf-label">
            {catalog.city.name} · {today.format(now)}
          </p>
          <p className="home__summary">
            <span className="cf-mono">{listings.length}</span> upcoming at{' '}
            <span className="cf-mono">{pins.length}</span> venues
          </p>
        </header>

        {fallback && !session.bannerDismissed && (
          <Banner tone={fallback.tone} title={fallback.title} onDismiss={session.dismissBanner}>
            {fallback.body}
          </Banner>
        )}

        <ListControls
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
          expanded={filtersOpen}
          onExpandedChange={setFiltersOpen}
        />

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
