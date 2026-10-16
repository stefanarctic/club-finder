import { Fragment } from 'react'
import { Layers } from 'lucide-react'
import { cx } from '../cx'
import { Cover } from './Cover'
import { Tag } from './Chip'
import './EventCard.css'

export type EventCardProps = {
  id: string
  name: string
  venueName: string
  /** Pre-formatted start in the guest's timezone, e.g. "Fri 23:00". */
  startLabel: string
  /** Facts that make up the "why it ranked here" line, in order. Joined with a dot. */
  reasons: string[]
  genres: string[]
  /** Genres matching the guest's picks get the accent treatment. */
  matchedGenres?: string[]
  tonight?: boolean
  /** Started but not ended. Stays visible, sinks in the list. */
  live?: boolean
  selected?: boolean
  /** More upcoming events at this venue (pin stack). */
  moreAtVenue?: number
  image?: string
  onSelect?: (id: string) => void
  className?: string
}

export function EventCard({
  id,
  name,
  venueName,
  startLabel,
  reasons,
  genres,
  matchedGenres = [],
  tonight,
  live,
  selected,
  moreAtVenue,
  image,
  onSelect,
  className,
}: EventCardProps) {
  return (
    <article
      className={cx(
        'cf-event-card',
        tonight && 'cf-event-card--tonight',
        live && 'cf-event-card--live',
        selected && 'cf-event-card--selected',
        className,
      )}
      aria-current={selected || undefined}
    >
      <Cover seed={id} src={image} alt="" className="cf-event-card__cover">
        {tonight && !live && <Tag tone="tonight" className="cf-event-card__flag">Tonight</Tag>}
        {live && <Tag tone="live" className="cf-event-card__flag">On now</Tag>}
      </Cover>

      <div className="cf-event-card__body">
        <p className="cf-event-card__time cf-mono">{startLabel}</p>
        <h3 className="cf-event-card__name cf-heading">
          <button type="button" className="cf-event-card__link" onClick={() => onSelect?.(id)}>
            {name}
          </button>
        </h3>
        <p className="cf-event-card__venue">
          {venueName}
          {moreAtVenue ? (
            <span className="cf-event-card__more">
              <Layers aria-hidden /> +{moreAtVenue} more here
            </span>
          ) : null}
        </p>

        <p className="cf-event-card__reason cf-mono">
          {reasons.map((reason, i) => (
            <Fragment key={reason}>
              {i > 0 && <span className="cf-event-card__sep" aria-hidden>·</span>}
              <span>{reason}</span>
            </Fragment>
          ))}
        </p>

        <div className="cf-event-card__tags">
          {genres.map((genre) => (
            <Tag key={genre} tone={matchedGenres.includes(genre) ? 'accent' : 'neutral'}>
              {genre}
            </Tag>
          ))}
        </div>
      </div>
    </article>
  )
}

export function EventCardSkeleton() {
  return (
    <div className="cf-event-card cf-event-card--skeleton" aria-hidden>
      <div className="cf-event-card__cover cf-skeleton" />
      <div className="cf-event-card__body">
        <span className="cf-skeleton" style={{ width: '30%', height: 10 }} />
        <span className="cf-skeleton" style={{ width: '75%', height: 18 }} />
        <span className="cf-skeleton" style={{ width: '45%', height: 12 }} />
        <span className="cf-skeleton" style={{ width: '85%', height: 10, marginTop: 6 }} />
      </div>
    </div>
  )
}
