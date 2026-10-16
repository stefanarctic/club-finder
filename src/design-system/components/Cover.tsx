import type { CSSProperties, ReactNode } from 'react'
import { cx } from '../cx'
import './Cover.css'

type CoverProps = {
  /** Local image path. When missing, a generated placeholder poster is drawn from `seed`. */
  src?: string
  alt?: string
  seed: string
  className?: string
  children?: ReactNode
}

const patterns = ['rings', 'stripes', 'grid', 'beam'] as const

function hash(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * Event / venue imagery. Placeholders stay inside the UV hue band (245°–310°) so a list of
 * them reads as one palette, and are explicitly labelled so nobody mistakes them for real photos.
 */
export function Cover({ src, alt = '', seed, className, children }: CoverProps) {
  const h = hash(seed)
  const hue = 245 + (h % 66)
  const pattern = patterns[(h >> 8) % patterns.length]
  const angle = (h >> 4) % 360

  const style = {
    '--cover-hue': hue,
    '--cover-angle': `${angle}deg`,
  } as CSSProperties

  return (
    <div className={cx('cf-cover', !src && `cf-cover--${pattern}`, className)} style={style}>
      {src ? <img src={src} alt={alt} loading="lazy" /> : <span className="cf-cover__placeholder">placeholder</span>}
      {children}
    </div>
  )
}
