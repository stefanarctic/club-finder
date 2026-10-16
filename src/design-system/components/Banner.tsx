import type { ReactNode } from 'react'
import { Info, MapPinOff, X } from 'lucide-react'
import { cx } from '../cx'
import './Banner.css'

type BannerProps = {
  tone?: 'info' | 'warning'
  title?: string
  children: ReactNode
  onDismiss?: () => void
  className?: string
}

export function Banner({ tone = 'info', title, children, onDismiss, className }: BannerProps) {
  const Icon = tone === 'warning' ? MapPinOff : Info
  return (
    <div role="status" className={cx('cf-banner', `cf-banner--${tone}`, className)}>
      <Icon className="cf-banner__icon" aria-hidden />
      <div className="cf-banner__body">
        {title && <strong className="cf-banner__title">{title}</strong>}
        <span>{children}</span>
      </div>
      {onDismiss && (
        <button type="button" className="cf-banner__dismiss" aria-label="Dismiss" onClick={onDismiss}>
          <X />
        </button>
      )}
    </div>
  )
}
