import { ChevronRight, X } from 'lucide-react'
import { cx } from '../../../design-system'
import type { VenuePinData } from '../../../data/discovery'
import { startLabel } from '../../format'
import './VenueStack.css'

type VenueStackProps = {
  pin: VenuePinData
  now: Date
  onOpen: (eventId: string) => void
  onClose: () => void
}

/** Opens from a pin: every remaining event at the venue, soonest first. */
export function VenueStack({ pin, now, onOpen, onClose }: VenueStackProps) {
  const count = pin.listings.length
  return (
    <div className="venue-stack" role="dialog" aria-label={`Events at ${pin.venue.name}`}>
      <div className="venue-stack__head">
        <div>
          <p className="venue-stack__name cf-heading">{pin.venue.name}</p>
          <p className="cf-label">
            {count} upcoming {count === 1 ? 'event' : 'events'}
          </p>
        </div>
        <button type="button" className="venue-stack__close" aria-label="Close" onClick={onClose}>
          <X />
        </button>
      </div>
      <ul className="venue-stack__list">
        {pin.listings.map((listing) => (
          <li key={listing.event.id}>
            <button
              type="button"
              className={cx('venue-stack__item', listing.sameDay && 'is-tonight')}
              onClick={() => onOpen(listing.event.id)}
            >
              <span className="venue-stack__time cf-mono">{startLabel(listing.event, now)}</span>
              <span className="venue-stack__event">{listing.event.name}</span>
              <ChevronRight className="venue-stack__chevron" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
