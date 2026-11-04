import { useState, type CSSProperties, type ReactNode } from 'react'
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

type LoadState = { src?: string; ready: boolean; failed: boolean }

/**
 * Event / venue imagery. Placeholders stay inside the UV hue band (245°–310°) so a list of
 * them reads as one palette, and are explicitly labelled so nobody mistakes them for real photos.
 */

export function Cover({ src, alt = '', seed, className, children }: CoverProps) {
  const [load, setLoad] = useState<LoadState>({ src, ready: false, failed: false })
  if (load.src !== src) setLoad({ src, ready: false, failed: false })

  const failed = load.failed
  const ready = load.ready
  const visible = Boolean(src) && !failed
  const loading = visible && !ready
  const h = hash(seed)
  const hue = 245 + (h % 66)
  const pattern = patterns[(h >> 8) % patterns.length]
  const angle = (h >> 4) % 360

  const style = {
    '--cover-hue': hue,
    '--cover-angle': `${angle}deg`,
  } as CSSProperties

  const markReady = (img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth > 0) {
      setLoad((current) => (current.src === src && !current.ready ? { ...current, ready: true } : current))
    }
  }

  return (
    <div
      className={cx(
        'cf-cover',
        visible && 'cf-cover--photo',
        loading && 'cf-cover--loading',
        !visible && `cf-cover--${pattern}`,
        className,
      )}
      style={style}
      aria-busy={loading || undefined}
    >
      {loading && <span className="cf-cover__shimmer" aria-hidden />}
      {visible ? (
        <img
          ref={markReady}
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={ready ? 'is-ready' : undefined}
          onLoad={() =>
            setLoad((current) => (current.src === src && !current.ready ? { ...current, ready: true } : current))
          }
          onError={() => setLoad((current) => (current.src === src ? { ...current, failed: true } : current))}
        />
      ) : (
        <span className="cf-cover__placeholder">placeholder</span>
      )}
      {children}
    </div>
  )
}
