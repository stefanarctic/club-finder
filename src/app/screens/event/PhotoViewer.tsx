import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { photoUrl } from '../../../data/photos'
import { IconButton } from '../../../design-system'
import './PhotoViewer.css'

export type ViewerPhoto = {
  seed: string
  image: string
  attribution?: string
}

type PhotoViewerProps = {
  photos: ViewerPhoto[]
  index: number
  alt: string
  onIndex: (index: number) => void
  onClose: () => void
}

/**
 * Full-screen photo. Escape and a click on the scrim close it; arrows move between photos.
 * The key listener is on the capture phase so the event panel does not also dismiss.
 */
export function PhotoViewer({ photos, index, alt, onIndex, onClose }: PhotoViewerProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const onIndexRef = useRef(onIndex)
  onCloseRef.current = onClose
  onIndexRef.current = onIndex

  const count = photos.length
  const photo = photos[Math.min(index, count - 1)]
  const src = photoUrl(photo?.image, 'cover')

  useEffect(() => {
    dialogRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        onCloseRef.current()
        return
      }
      if (event.key === 'Tab') {
        const dialog = dialogRef.current
        if (!dialog) return
        const items = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled])')]
        const first = items[0]
        const last = items[items.length - 1]
        if (!first || !last) return
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
        return
      }
      if (count < 2) return
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        onIndexRef.current((index + 1) % count)
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        onIndexRef.current((index - 1 + count) % count)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [count, index])

  if (!photo || !src) return null

  return createPortal(
    <div
      ref={dialogRef}
      className="photo-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={count > 1 ? `${alt}, photo ${index + 1} of ${count}` : alt}
      tabIndex={-1}
      onClick={() => onCloseRef.current()}
    >
      <IconButton className="photo-viewer__close" label="Close photo" variant="glass" onClick={() => onCloseRef.current()}>
        <X />
      </IconButton>

      <figure className="photo-viewer__frame" onClick={(event) => event.stopPropagation()}>
        <div className="photo-viewer__stage">
          <img className="photo-viewer__img" src={src} alt={alt} />
          {count > 1 && (
            <>
              <IconButton
                className="photo-viewer__nav photo-viewer__nav--prev"
                label="Previous photo"
                variant="glass"
                onClick={(event) => {
                  event.stopPropagation()
                  onIndexRef.current((index - 1 + count) % count)
                }}
              >
                <ChevronLeft />
              </IconButton>
              <IconButton
                className="photo-viewer__nav photo-viewer__nav--next"
                label="Next photo"
                variant="glass"
                onClick={(event) => {
                  event.stopPropagation()
                  onIndexRef.current((index + 1) % count)
                }}
              >
                <ChevronRight />
              </IconButton>
            </>
          )}
        </div>
        <figcaption className="photo-viewer__meta">
          {photo.attribution && <span className="photo-viewer__credit">{photo.attribution}</span>}
          {count > 1 && (
            <span className="cf-mono photo-viewer__count">
              {index + 1} / {count}
            </span>
          )}
        </figcaption>
      </figure>
    </div>,
    document.body,
  )
}
