import { useLayoutEffect, useRef, useState } from 'react'
import { cx } from '../cx'
import './SegmentedControl.css'

type Option<T extends string> = { value: T; label: string }

type SegmentedControlProps<T extends string> = {
  label: string
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  size?: 'sm' | 'md'
  className?: string
}

/** Single-choice control — time range, sort. The thumb slides between options. */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  size = 'md',
  className,
}: SegmentedControlProps<T>) {
  const listRef = useRef<HTMLDivElement>(null)
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null)

  useLayoutEffect(() => {
    const list = listRef.current
    const active = list?.querySelector<HTMLButtonElement>('[aria-checked="true"]')
    if (!list || !active) return
    const measure = () => setThumb({ left: active.offsetLeft, width: active.offsetWidth })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    return () => observer.disconnect()
  }, [value, options])

  return (
    <div
      ref={listRef}
      role="radiogroup"
      aria-label={label}
      className={cx('cf-segmented', `cf-segmented--${size}`, className)}
    >
      {thumb && (
        <span className="cf-segmented__thumb" style={{ transform: `translateX(${thumb.left}px)`, width: thumb.width }} />
      )}
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          className="cf-segmented__option"
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
