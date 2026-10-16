import { cx } from '../cx'
import './MapMarkers.css'

type VenuePinProps = {
  /** Any still-upcoming event at this venue starts today. */
  tonight?: boolean
  selected?: boolean
  /** Doesn't match the active filters. Pin stays in place so clusters stay honest. */
  dimmed?: boolean
  /** Upcoming events at this venue; >1 shows a stack badge. */
  eventCount?: number
  label?: string
  onClick?: () => void
}

/** One pin per venue. Sized for HTML markers on MapLibre; anchor at bottom-center. */
export function VenuePin({ tonight, selected, dimmed, eventCount = 1, label, onClick }: VenuePinProps) {
  const className = cx(
    'cf-pin',
    tonight ? 'cf-pin--tonight' : 'cf-pin--quiet',
    selected && 'cf-pin--selected',
    dimmed && 'cf-pin--dimmed',
  )
  const inner = (
    <>
      {tonight && !dimmed && <span className="cf-pin__halo" aria-hidden />}
      <span className="cf-pin__head" aria-hidden>
        <span className="cf-pin__core" />
      </span>
      <span className="cf-pin__tail" aria-hidden />
      {eventCount > 1 && (
        <span className="cf-pin__stack" aria-hidden>
          {eventCount}
        </span>
      )}
      {selected && label && (
        <span className="cf-pin__label" aria-hidden>
          {label}
        </span>
      )}
    </>
  )

  if (!onClick) {
    return <span className={className}>{inner}</span>
  }

  return (
    <button
      type="button"
      className={className}
      aria-label={[label, tonight && 'event tonight', eventCount > 1 && `${eventCount} events`].filter(Boolean).join(', ')}
      onClick={onClick}
    >
      {inner}
    </button>
  )
}

type ClusterPinProps = {
  count: number
  /** Same-day events inside this cluster. >0 lights the cluster like a tonight pin. */
  tonightCount?: number
  dimmed?: boolean
  onClick?: () => void
}

export function ClusterPin({ count, tonightCount = 0, dimmed, onClick }: ClusterPinProps) {
  const size = count < 5 ? 'sm' : count < 12 ? 'md' : 'lg'
  return (
    <button
      type="button"
      className={cx('cf-cluster', `cf-cluster--${size}`, tonightCount > 0 && 'cf-cluster--tonight', dimmed && 'cf-pin--dimmed')}
      aria-label={`${count} events${tonightCount ? `, ${tonightCount} tonight` : ''}. Zoom in`}
      onClick={onClick}
    >
      <span className="cf-cluster__count">{count}</span>
      {tonightCount > 0 && <span className="cf-cluster__tonight">{tonightCount} tonight</span>}
    </button>
  )
}

/** The guest's real position. Never drawn at the fallback center. */
export function UserDot() {
  return (
    <span className="cf-user-dot" role="img" aria-label="Your location">
      <span className="cf-user-dot__pulse" />
    </span>
  )
}
