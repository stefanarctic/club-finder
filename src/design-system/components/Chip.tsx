import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cx } from '../cx'
import './Chip.css'

type ChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> & {
  selected?: boolean
  onSelectedChange?: (selected: boolean) => void
  icon?: ReactNode
}

/** Toggleable filter chip — genre picks, budget bands. */
export function Chip({ selected = false, onSelectedChange, icon, className, children, disabled, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      className={cx('cf-chip', selected && 'cf-chip--selected', className)}
      onClick={() => onSelectedChange?.(!selected)}
      {...rest}
    >
      <span className="cf-chip__check" aria-hidden>
        {selected ? <Check strokeWidth={3} /> : icon}
      </span>
      {children}
    </button>
  )
}

type TagProps = {
  children: ReactNode
  tone?: 'neutral' | 'accent' | 'tonight' | 'live'
  className?: string
}

/** Static, non-interactive label — genres on a card, status badges. */
export function Tag({ children, tone = 'neutral', className }: TagProps) {
  return <span className={cx('cf-tag', `cf-tag--${tone}`, className)}>{children}</span>
}
