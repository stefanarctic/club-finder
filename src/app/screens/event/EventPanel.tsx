import { useEffect, useRef, useState, type RefObject } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { ArrowLeft, ChevronRight, Clock, ExternalLink, Globe, MapPin, Navigation, Phone, Share2, Star, Ticket, Wallet } from 'lucide-react'
import {
  Button,
  Cover,
  EmptyState,
  IconButton,
  InfoRow,
  PriceLevel,
  Rating,
  Tag,
  cx,
} from '../../../design-system'
import { catalog } from '../../../data/catalog'
import type { Listing } from '../../../data/discovery'
import { photoCredit, photoUrl } from '../../../data/photos'
import { formatDistance } from '../../../data/ranking'
import { externalMapUrl, startLabel, timeSpanLabel } from '../../format'
import { useSession } from '../../session'
import './EventPanel.css'

type EventPanelProps = {
  eventId: string
  /** Undefined when the id is unknown or the event has ended. */
  listing: Listing | undefined
  /** Every remaining event at the same venue, soonest first. */
  siblings: Listing[]
  now: Date
  /** True while the live catalog is still opening. */
  pending: boolean
  /** The id exists in the database, including when the night has already ended. */
  known: boolean
  onOpenEvent: (eventId: string) => void
}

export function EventPanel({ eventId, listing, siblings, now, pending, known, onOpenEvent }: EventPanelProps) {
  const navigate = useNavigate()
  const fromList = Boolean((useLocation().state as { fromList?: boolean } | null)?.fromList)
  const scrollRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  const back = () => {
    if (fromList) navigate(-1)
    else navigate('/', { replace: true })
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
    headingRef.current?.focus({ preventScroll: true })
  }, [eventId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (fromList) navigate(-1)
      else navigate('/', { replace: true })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fromList, navigate])

  return (
    <article className="event-panel" ref={scrollRef} aria-labelledby="event-title">
      {listing ? (
        <EventDetail listing={listing} siblings={siblings} now={now} onBack={back} onOpenEvent={onOpenEvent} headingRef={headingRef} />
      ) : (
        <MissingEvent pending={pending} ended={known} onBack={back} headingRef={headingRef} />
      )}
    </article>
  )
}

type HeadingRef = RefObject<HTMLHeadingElement | null>

function EventDetail({
  listing,
  siblings,
  now,
  onBack,
  onOpenEvent,
  headingRef,
}: {
  listing: Listing
  siblings: Listing[]
  now: Date
  onBack: () => void
  onOpenEvent: (eventId: string) => void
  headingRef: HeadingRef
}) {
  const { event, venue } = listing
  const { userPosition } = useSession()
  const [shared, setShared] = useState(false)

  const photos = [
    { seed: event.id, src: photoUrl(event.image), attribution: photoCredit(event.image, event.imageAttribution) },
    ...(venue.images.length > 0
      ? venue.images.map((src, i) => ({
          seed: `${venue.id}-${i}`,
          src: photoUrl(src),
          attribution: photoCredit(src, venue.imageAttributions?.[i]),
        }))
      : [1, 2, 3].map((i) => ({ seed: `${venue.id}-${i}`, src: undefined, attribution: undefined }))),
  ]
  const [photoIndex, setPhotoIndex] = useState(0)
  const photo = photos[Math.min(photoIndex, photos.length - 1)]
  const others = siblings.filter((s) => s.event.id !== event.id)

  useEffect(() => {
    document.title = `${event.name} · ${venue.name} · Club Finder`
    setPhotoIndex(0)
  }, [event.id, event.name, venue.name])

  const share = async () => {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title: event.name, text: `${event.name} at ${venue.name}`, url })
      } else {
        await navigator.clipboard.writeText(url)
        setShared(true)
        window.setTimeout(() => setShared(false), 2000)
      }
    } catch {
      // Share sheet dismissed.
    }
  }

  return (
    <>
      <div className="event-panel__hero">
        <Cover key={photo.seed} seed={photo.seed} src={photo.src} alt="" className="event-panel__cover" />
        <div className="event-panel__bar">
          <IconButton label="Back to the list" variant="glass" onClick={onBack}>
            <ArrowLeft />
          </IconButton>
          <IconButton label={shared ? 'Link copied' : 'Share'} variant="glass" onClick={share}>
            <Share2 />
          </IconButton>
        </div>
        <div className="event-panel__strip" role="group" aria-label="Photos">
          {photos.map((p, i) => (
            <button
              key={p.seed}
              type="button"
              className={cx('event-panel__thumb', i === photoIndex && 'is-active')}
              aria-label={i === 0 ? 'Event image' : `Venue photo ${i}`}
              aria-pressed={i === photoIndex}
              onClick={() => setPhotoIndex(i)}
            >
              <Cover seed={p.seed} src={p.src} />
            </button>
          ))}
        </div>
      </div>

      <div className="event-panel__body">
        {photo.attribution && <p className="event-panel__credit">{photo.attribution}</p>}

        <div className="event-panel__tags">
          {listing.live ? <Tag tone="live">On now</Tag> : listing.sameDay && <Tag tone="tonight">Tonight</Tag>}
          {event.genres.map((g) => (
            <Tag key={g} tone={listing.matchedGenres.includes(g) ? 'accent' : 'neutral'}>
              {g}
            </Tag>
          ))}
        </div>

        <h1 id="event-title" ref={headingRef} tabIndex={-1} className="cf-display event-panel__title">
          {event.name}
        </h1>
        <p className="event-panel__venue">
          {venue.name}
          <span className={cx('cf-mono event-panel__time', listing.sameDay && 'is-tonight')}>
            {timeSpanLabel(event, now)}
          </span>
        </p>

        <div className="event-panel__price">
          <span className="cf-label">Average ticket</span>
          <span className="cf-display event-panel__price-value">
            {event.averagePrice} {event.currency}
          </span>
        </div>

        <div className="event-panel__facts">
          <InfoRow icon={<Navigation />} label="Distance">
            <span className="cf-mono">{formatDistance(listing.distanceKm)}</span>{' '}
            {userPosition ? 'from you' : `from ${catalog.defaultCity.defaultCenterName}`}
          </InfoRow>
          <InfoRow icon={<MapPin />} label="Address">
            {venue.address}
          </InfoRow>
          <InfoRow icon={<Clock />} label="Hours">
            <span className="event-panel__hours">{venue.hours}</span>
          </InfoRow>
          <InfoRow icon={<Star />} label="Rating">
            {venue.rating > 0 ? (
              <>
                <Rating value={venue.rating} />{' '}
                <span className="event-panel__aside">{venue.googlePlaceId ? 'Google' : 'placeholder'}</span>
              </>
            ) : (
              <span className="event-panel__aside">Not listed</span>
            )}
          </InfoRow>
          {venue.phone && (
            <InfoRow icon={<Phone />} label="Phone">
              <a href={`tel:${venue.phone}`}>{venue.phone}</a>
            </InfoRow>
          )}
          {venue.website && (
            <InfoRow icon={<Globe />} label="Website">
              <a href={venue.website} target="_blank" rel="noreferrer">
                {venue.website.replace(/^https?:\/\//, '')}
              </a>
            </InfoRow>
          )}
          <InfoRow icon={<Wallet />} label="Price level">
            <PriceLevel level={venue.priceLevel} />
          </InfoRow>
        </div>

        <section className="event-panel__section">
          <h2 className="cf-label">The night</h2>
          <p>{event.description}</p>
        </section>
        <section className="event-panel__section">
          <h2 className="cf-label">About {venue.name}</h2>
          <p>{venue.description}</p>
        </section>

        {others.length > 0 && (
          <section className="event-panel__section">
            <h2 className="cf-label">Also at {venue.name}</h2>
            <ul className="event-panel__others">
              {others.map((o) => (
                <li key={o.event.id}>
                  <button type="button" className="event-panel__other" onClick={() => onOpenEvent(o.event.id)}>
                    <span className={cx('cf-mono event-panel__other-time', o.sameDay && 'is-tonight')}>
                      {startLabel(o.event, now)}
                    </span>
                    <span className="event-panel__other-name">{o.event.name}</span>
                    <ChevronRight aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <a
          className="cf-btn cf-btn--secondary cf-btn--md cf-btn--block"
          href={externalMapUrl(venue.latitude, venue.longitude)}
          target="_blank"
          rel="noreferrer"
        >
          <span>Open in maps</span>
          <span className="cf-btn__icon">
            <ExternalLink />
          </span>
        </a>
        <p className="event-panel__ticket-note">
          <Ticket aria-hidden /> Ticketing is coming later.
        </p>
      </div>
    </>
  )
}

function MissingEvent({
  pending,
  ended,
  onBack,
  headingRef,
}: {
  pending: boolean
  ended: boolean
  onBack: () => void
  headingRef: HeadingRef
}) {
  useEffect(() => {
    document.title = `${pending ? 'Loading the event' : ended ? 'Event ended' : 'Event not found'} · Club Finder`
  }, [pending, ended])
  return (
    <div className="event-panel__missing">
      <IconButton label="Back to the list" variant="secondary" onClick={onBack}>
        <ArrowLeft />
      </IconButton>
      <h1 id="event-title" ref={headingRef} tabIndex={-1} className="cf-visually-hidden">
        {pending ? 'Loading the event' : ended ? 'Event ended' : 'Event not found'}
      </h1>
      <EmptyState
        title={pending ? 'Loading the event' : ended ? 'This event has ended' : 'We couldn’t find that event'}
        action={
          <Button size="sm" variant="secondary" onClick={onBack}>
            Back to the list
          </Button>
        }
      >
        {pending ? 'Fetching it from the database.' : ended ? 'It’s no longer on the map.' : 'The link may be wrong, or the event was removed.'}
      </EmptyState>
    </div>
  )
}
