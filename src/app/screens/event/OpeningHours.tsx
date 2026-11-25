import { Clock } from 'lucide-react'
import { openingStatus, parseOpeningHours } from '../../../data/openingHours'
import { cx } from '../../../design-system'
import './OpeningHours.css'

/** Maps-style hours: one status line, then a block per day. */
export function OpeningHours({ hours, now }: { hours: string; now: Date }) {
  const days = parseOpeningHours(hours)
  const status = days ? openingStatus(days, now) : null
  const today = now.getDay()
  const todayHours = days?.find((day) => day.day === today)?.hours ?? days?.[0]?.hours

  return (
    <div className="cf-info-row opening-hours-row">
      <span className="cf-info-row__icon" aria-hidden>
        <Clock />
      </span>
      <span className="cf-info-row__label cf-label">Hours</span>
      <div className="opening-hours">
        <p className="opening-hours__summary">
          {status ? (
            <>
              <span className={cx('opening-hours__state', status.open ? 'is-open' : 'is-closed')}>{status.label}</span>
              {status.detail && (
                <>
                  <span className="opening-hours__sep" aria-hidden>
                    ·
                  </span>
                  <span className="opening-hours__detail">{status.detail}</span>
                </>
              )}
            </>
          ) : (
            <span className={cx('opening-hours__plain', !hours.trim() && 'is-empty')}>
              {days ? todayHours : hours.trim() || 'Not listed'}
            </span>
          )}
        </p>
        {days && (
          <ul className="opening-hours__days" aria-label="Weekly hours">
            {days.map((day) => (
              <li
                key={day.day}
                className={cx('opening-hours__day', day.day === today && 'is-today', day.closed && 'is-closed')}
                aria-current={day.day === today ? 'date' : undefined}
              >
                <span className="opening-hours__name">{day.name}</span>
                <span className="opening-hours__time cf-mono">{day.hours}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
