import type { ReactNode } from 'react'
import { SearchX, Star } from 'lucide-react'
import { cx } from '../cx'
import './Details.css'

/** Venue price level for a night out (1–4). Never the ticket price — the label says so. */
export function PriceLevel({ level, showLabel = true }: { level: 1 | 2 | 3 | 4; showLabel?: boolean }) {
  return (
    <span className="cf-price-level" aria-label={`Night-out price level ${level} of 4`}>
      <span className="cf-price-level__marks" aria-hidden>
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className={cx(n <= level && 'is-on')}>
            €
          </span>
        ))}
      </span>
      {showLabel && <span className="cf-price-level__label">night out</span>}
    </span>
  )
}

export function Rating({ value }: { value: number }) {
  return (
    <span className="cf-rating" aria-label={`Rated ${value.toFixed(1)} out of 5`}>
      <Star aria-hidden />
      <span className="cf-mono">{value.toFixed(1)}</span>
    </span>
  )
}

type SectionHeaderProps = {
  title: string
  count?: number
  tonight?: boolean
  className?: string
}

/** List group header — "Tonight" sits above "Coming up". */
export function SectionHeader({ title, count, tonight, className }: SectionHeaderProps) {
  return (
    <div className={cx('cf-section-header', tonight && 'cf-section-header--tonight', className)}>
      {tonight && <span className="cf-section-header__dot" aria-hidden />}
      <h2 className="cf-section-header__title cf-display">{title}</h2>
      {count !== undefined && <span className="cf-section-header__count cf-mono">{String(count).padStart(2, '0')}</span>}
      <span className="cf-section-header__rule" aria-hidden />
    </div>
  )
}

type InfoRowProps = {
  icon: ReactNode
  label: string
  children: ReactNode
}

/** Maps-style fact row on the event detail page. */
export function InfoRow({ icon, label, children }: InfoRowProps) {
  return (
    <div className="cf-info-row">
      <span className="cf-info-row__icon" aria-hidden>
        {icon}
      </span>
      <span className="cf-info-row__label cf-label">{label}</span>
      <span className="cf-info-row__value">{children}</span>
    </div>
  )
}

type EmptyStateProps = {
  title: string
  children?: ReactNode
  action?: ReactNode
}

export function EmptyState({ title, children, action }: EmptyStateProps) {
  return (
    <div className="cf-empty">
      <span className="cf-empty__icon" aria-hidden>
        <SearchX />
      </span>
      <p className="cf-empty__title cf-heading">{title}</p>
      {children && <p className="cf-empty__body">{children}</p>}
      {action}
    </div>
  )
}
