import { useId } from 'react'
import { cx } from '../cx'
import './Switch.css'

type SwitchProps = {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
  className?: string
}

export function Switch({ checked, onChange, label, description, className }: SwitchProps) {
  const id = useId()
  return (
    <div className={cx('cf-switch', className)}>
      <span className="cf-switch__text">
        <label htmlFor={id} className="cf-switch__label">
          {label}
        </label>
        {description && <span className="cf-switch__description">{description}</span>}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        className="cf-switch__track"
        onClick={() => onChange(!checked)}
      >
        <span className="cf-switch__thumb" />
      </button>
    </div>
  )
}
