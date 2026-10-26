import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Chip, Cover } from '../../../design-system'
import { photoUrl } from '../../../data/photos'
import { GENRES, type Genre } from '../../../data/types'
import { ScreenFrame } from '../../shell/ScreenFrame'

export function EditorNotice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <ScreenFrame title={title}>
      <p className="editor__notice">{children}</p>
      <Link to="/profile" className="editor__back">
        Back to profile
      </Link>
    </ScreenFrame>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="editor__field">
      <span className="cf-label">{label}</span>
      {children}
      {hint && <span className="editor__hint">{hint}</span>}
    </label>
  )
}

export function GenrePicker({ genres, onChange }: { genres: Genre[]; onChange: (genres: Genre[]) => void }) {
  return (
    <div className="editor__field">
      <span className="cf-label">Genres</span>
      <div className="editor__chips">
        {GENRES.map((genre) => (
          <Chip
            key={genre}
            selected={genres.includes(genre)}
            onSelectedChange={(selected) =>
              onChange(selected ? [...genres, genre] : genres.filter((item) => item !== genre))
            }
          >
            {genre}
          </Chip>
        ))}
      </div>
    </div>
  )
}

export function ImageList({
  images,
  attributions,
  onRemove,
}: {
  images: string[]
  attributions: string[]
  onRemove: (index: number) => void
}) {
  if (images.length === 0) return <p className="editor__hint">No photos yet.</p>
  return (
    <ul className="editor__photos">
      {images.map((src, index) => (
        <li key={`${src}-${index}`}>
          <Cover seed={`${src}-${index}`} src={photoUrl(src)} alt="" className="editor__photo" />
          <div>
            {attributions[index] && <p className="editor__hint">{attributions[index]}</p>}
            <button type="button" className="editor__text-btn" onClick={() => onRemove(index)}>
              Remove
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}

export function toDatetimeLocal(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function fromDatetimeLocal(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString()
}
