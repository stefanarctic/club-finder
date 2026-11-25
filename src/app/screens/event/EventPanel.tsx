import { useEffect, useRef, useState, type RefObject } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { ArrowLeft, ChevronRight, ExternalLink, Globe, MapPin, Navigation, Pencil, Phone, Share2, Star, Wallet } from 'lucide-react'
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
import { useLiveCatalog } from '../../../data/LiveCatalog'
import type { Listing } from '../../../data/discovery'
import { photoCredit, photoUrl } from '../../../data/photos'
import { formatDistance } from '../../../data/ranking'
import { REFUND_RULE, formatPrice } from '../../../data/tickets'
import { canEditEvent, useAccount } from '../../auth'
import { externalMapUrl, startLabel, timeSpanLabel } from '../../format'
import { useSession } from '../../session'
import { useTickets } from '../../tickets'
import { OpeningHours } from './OpeningHours'
import { PhotoViewer, type ViewerPhoto } from './PhotoViewer'
import { TicketSheet } from './TicketSheet'
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

  const live = useLiveCatalog()
  const { account } = useAccount()
  const stored = live.storedEvents.find((item) => item.id === eventId)
  const editable = canEditEvent(account, listing?.event.createdBy ?? stored?.createdBy)

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
    <article className="event-panel" aria-labelledby="event-title">
      {listing ? (
        <EventDetail
          listing={listing}
          siblings={siblings}
          now={now}
          canEdit={editable}
          scrollRef={scrollRef}
          onBack={back}
          onOpenEvent={onOpenEvent}
          headingRef={headingRef}
        />
      ) : (
        <div className="event-panel__scroll" ref={scrollRef}>
          <MissingEvent
            eventId={eventId}
            pending={pending}
            ended={known}
            canEdit={editable}
            onBack={back}
            headingRef={headingRef}
          />
        </div>
      )}
    </article>
  )
}

type HeadingRef = RefObject<HTMLHeadingElement | null>

function EventDetail({
  listing,
  siblings,
  now,
  canEdit,
  scrollRef,
  onBack,
  onOpenEvent,
  headingRef,
}: {
  listing: Listing
  siblings: Listing[]
  now: Date
  canEdit: boolean
  scrollRef: RefObject<HTMLDivElement | null>
  onBack: () => void
  onOpenEvent: (eventId: string) => void
  headingRef: HeadingRef
}) {
  const { event, venue } = listing
  const { userPosition } = useSession()
  const { account } = useAccount()
  const tickets = useTickets()
  const buyRef = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef(false)
  const [shared, setShared] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const tiers = tickets.tiersFor({ id: event.id, averagePrice: event.averagePrice, currency: event.currency })
  const held = tickets.passes.filter((pass) => pass.eventId === event.id)
  const openTiers = tiers.filter((tier) => tier.remaining > 0)
  const soldOut = openTiers.length === 0
  const lowest = soldOut ? null : Math.min(...openTiers.map((tier) => tier.price))
  const heldTo = held.length === 1 ? `/tickets/${held[0].id}` : '/tickets'

  const eventImages = [...new Set([event.image, ...(event.images ?? [])].map((src) => src.trim()).filter(Boolean))]
  const photos = [
    ...eventImages.map((src, i) => ({
      seed: `${event.id}-poster-${i}`,
      image: src,
      attribution: photoCredit(src, event.imageAttribution),
    })),
    ...venue.images.map((src, i) => ({
      seed: `${venue.id}-${i}`,
      image: src,
      attribution: photoCredit(src, venue.imageAttributions?.[i]),
    })),
  ]
  if (photos.length === 0) {
    photos.push({ seed: event.id, image: '', attribution: undefined })
  }
  const [photoIndex, setPhotoIndex] = useState(0)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const photo = photos[Math.min(photoIndex, photos.length - 1)]
  const viewable: ViewerPhoto[] = photos.filter((item) => item.image.trim())
  const others = siblings.filter((s) => s.event.id !== event.id)

  useEffect(() => {
    document.title = `${event.name} · ${venue.name} · Club Finder`
    setPhotoIndex(0)
    setViewerIndex(null)
    setSheetOpen(false)
  }, [event.id, event.name, venue.name])

  const closeSheet = () => {
    returnFocus.current = true
    setSheetOpen(false)
  }

  useEffect(() => {
    if (sheetOpen || !returnFocus.current) return
    returnFocus.current = false
    buyRef.current?.focus()
  }, [sheetOpen])

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
      <div className="event-panel__scroll" ref={scrollRef} inert={sheetOpen ? true : undefined}>
      <div className="event-panel__hero">
        <button
          type="button"
          className="event-panel__enlarge"
          disabled={!photo.image.trim()}
          aria-label={`View ${event.name} photo full screen`}
          onClick={() => {
            const at = viewable.findIndex((item) => item.seed === photo.seed)
            if (at >= 0) setViewerIndex(at)
          }}
        >
          <Cover key={photo.seed} seed={photo.seed} src={photoUrl(photo.image, 'cover')} alt="" className="event-panel__cover" />
        </button>
        {viewerIndex !== null && (
          <PhotoViewer
            photos={viewable}
            index={viewerIndex}
            alt={event.name}
            onIndex={setViewerIndex}
            onClose={() => {
              const chosen = viewable[viewerIndex]
              const at = chosen ? photos.findIndex((item) => item.seed === chosen.seed) : -1
              if (at >= 0) setPhotoIndex(at)
              setViewerIndex(null)
            }}
          />
        )}
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
              aria-label={
                i < eventImages.length
                  ? i === 0
                    ? 'Event image'
                    : `Event poster ${i + 1}`
                  : `Club photo ${i - eventImages.length + 1}`
              }
              aria-pressed={i === photoIndex}
              onClick={() => setPhotoIndex(i)}
            >
              <Cover seed={p.seed} src={photoUrl(p.image, 'thumb')} />
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

        <section className="event-panel__section" aria-labelledby="event-tickets">
          <h2 id="event-tickets" className="cf-label">Tickets</h2>
          <ul className="event-panel__tiers">
            {tiers.map((tier) => (
              <li key={tier.id} className={cx('event-panel__tier', tier.remaining === 0 && 'is-out')}>
                <span className="event-panel__tier-name">{tier.name}</span>
                <span className="event-panel__tier-price cf-mono">{formatPrice(tier.price, tier.currency)}</span>
                <span className="event-panel__tier-note">{tier.note}</span>
                <span className="event-panel__tier-left">{tier.remaining === 0 ? 'Sold out' : `${tier.remaining} left`}</span>
              </li>
            ))}
          </ul>
          <p className="event-panel__refund">{REFUND_RULE}</p>
        </section>

        <div className="event-panel__facts">
          <InfoRow icon={<Navigation />} label="Distance">
            <span className="cf-mono">{formatDistance(listing.distanceKm)}</span>{' '}
            {userPosition ? 'from you' : `from ${catalog.defaultCity.defaultCenterName}`}
          </InfoRow>
          <InfoRow icon={<MapPin />} label="Address">
            {venue.address}
          </InfoRow>
          <OpeningHours hours={venue.hours} now={now} />
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
          <p className="event-panel__copy">{event.description}</p>
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

        <div className="event-panel__actions">
          {canEdit && (
            <Link className="cf-btn cf-btn--secondary cf-btn--md cf-btn--block" to={`/profile/events/${event.id}`}>
              <span className="cf-btn__icon">
                <Pencil />
              </span>
              <span>Edit event</span>
            </Link>
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
        </div>
        </div>
      </div>
      <div className="event-panel__buy" inert={sheetOpen ? true : undefined}>
        <div className="event-panel__buy-inner">
          <div className="event-panel__buy-copy">
            <p className="event-panel__buy-price cf-display">
              {lowest === null ? 'Sold out' : lowest === 0 ? 'Free' : `From ${lowest} EUR`}
            </p>
            {held.length > 0 && (
              <Link className="event-panel__buy-hold" to={heldTo}>
                You hold {held.length} {held.length === 1 ? 'pass' : 'passes'}
              </Link>
            )}
          </div>
          <Button ref={buyRef} disabled={soldOut} onClick={() => setSheetOpen(true)}>
            {soldOut ? 'Sold out' : 'Get tickets'}
          </Button>
        </div>
      </div>
      {sheetOpen && (
        <TicketSheet
          night={event}
          venue={venue}
          tiers={tiers}
          initialBuyer={{ name: account?.displayName ?? '', email: account?.email ?? '' }}
          onClose={closeSheet}
        />
      )}
    </>
  )
}

function MissingEvent({
  eventId,
  pending,
  ended,
  canEdit,
  onBack,
  headingRef,
}: {
  eventId: string
  pending: boolean
  ended: boolean
  canEdit: boolean
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
          <>
            {ended && canEdit && (
              <Link className="cf-btn cf-btn--secondary cf-btn--sm" to={`/profile/events/${eventId}`}>
                <span className="cf-btn__icon">
                  <Pencil />
                </span>
                <span>Edit event</span>
              </Link>
            )}
            <Button size="sm" variant="secondary" onClick={onBack}>
              Back to the list
            </Button>
          </>
        }
      >
        {pending ? 'Fetching it from the database.' : ended ? 'It’s no longer on the map.' : 'The link may be wrong, or the event was removed.'}
      </EmptyState>
    </div>
  )
}
