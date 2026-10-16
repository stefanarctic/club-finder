import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from '../cx'
import './Button.css'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  block?: boolean
  leadingIcon?: ReactNode
  trailingIcon?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  block,
  leadingIcon,
  trailingIcon,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx('cf-btn', `cf-btn--${variant}`, `cf-btn--${size}`, block && 'cf-btn--block', className)}
      {...rest}
    >
      {leadingIcon && <span className="cf-btn__icon">{leadingIcon}</span>}
      <span>{children}</span>
      {trailingIcon && <span className="cf-btn__icon">{trailingIcon}</span>}
    </button>
  )
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  variant?: 'secondary' | 'ghost' | 'glass'
  children: ReactNode
}

export function IconButton({ label, variant = 'secondary', className, children, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx('cf-icon-btn', `cf-icon-btn--${variant}`, className)}
      {...rest}
    >
      {children}
    </button>
  )
}
