import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button, Cover } from '../../../design-system'
import { useLiveCatalog } from '../../../data/LiveCatalog'
import { deleteEvent, saveEvent, uploadImage } from '../../../data/records'
import type { Genre, StoredEvent } from '../../../data/types'
import { ScreenFrame } from '../../shell/ScreenFrame'
import { photoCredit, photoUrl } from '../../../data/photos'
import { EditorNotice, Field, fromDatetimeLocal, GenrePicker, toDatetimeLocal } from './editorShared'
import './Editors.css'

type EventForm = {
  venueId: string
  name: string
  startsAt: string
  durationHours: string
  averagePrice: string
  genres: Genre[]
  description: string
  image: string
  imageAttribution: string
}

const emptyForm = (venueId = ''): EventForm => ({
  venueId,
  name: '',
  startsAt: '',
  durationHours: '6',
  averagePrice: '',
  genres: [],
  description: '',
  image: '',
  imageAttribution: '',
})

function toForm(event: StoredEvent): EventForm {
  return {
    venueId: event.venueId,
    name: event.name,
    startsAt: toDatetimeLocal(event.startsAt),
    durationHours: String(event.durationHours),
    averagePrice: String(event.averagePrice),
    genres: event.genres,
    description: event.description,
    image: event.image,
    imageAttribution: event.imageAttribution ?? '',
  }
}

export function EventEditor() {
  const params = useParams()
  const navigate = useNavigate()
  const live = useLiveCatalog()
  const isNew = !params.id
  const [draftId] = useState(() => `event-${crypto.randomUUID().slice(0, 8)}`)
  const id = params.id ?? draftId
  const stored = live.storedEvents.find((item) => item.id === params.id)
  const loadedId = useRef<string | null>(null)
  const [form, setForm] = useState<EventForm | null>(null)
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'save' | 'upload' | 'delete' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    document.title = isNew ? 'Club Finder · New event' : 'Club Finder · Edit event'
  }, [isNew])

  useEffect(() => {
    if (loadedId.current === id) return
    if (isNew) {
      loadedId.current = id
      setMissing(false)
      setForm(emptyForm(live.venues[0]?.id ?? ''))
      return
    }
    if (live.status === 'loading' || live.status === 'unconfigured') return
    if (!stored) {
      setForm(null)
      setMissing(true)
      return
    }
    loadedId.current = id
    setMissing(false)
    setForm(toForm(stored))
    // live.venues is read once for a new event's default club. Later snapshots must not reset the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew, live.status, stored])

  const patch = (partial: Partial<EventForm>) => setForm((current) => (current ? { ...current, ...partial } : current))

  const save = async () => {
    if (!form) return
    const startsAt = fromDatetimeLocal(form.startsAt)
    const durationHours = Number(form.durationHours)
    const averagePrice = Number(form.averagePrice)
    if (!form.name.trim()) {
      setError('Add a name.')
      return
    }
    if (!form.venueId) {
      setError('Choose a club.')
      return
    }
    if (!startsAt) {
      setError('Choose a date and time.')
      return
    }
    if (!Number.isFinite(durationHours) || durationHours <= 0) {
      setError('Duration has to be more than zero hours.')
      return
    }
    if (!Number.isFinite(averagePrice) || averagePrice < 0) {
      setError('Average price is a number in EUR. Use 0 for free entry.')
      return
    }
    setError(null)
    setBusy('save')
    try {
      await saveEvent({
        id,
        venueId: form.venueId,
        name: form.name.trim(),
        startsAt,
        durationHours,
        image: form.image.trim(),
        imageAttribution: form.imageAttribution.trim() || undefined,
        averagePrice,
        currency: 'EUR',
        genres: form.genres,
        description: form.description.trim(),
      })
      if (isNew) navigate(`/profile/events/${id}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the event.')
    } finally {
      setBusy(null)
    }
  }

  const upload = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setBusy('upload')
    try {
      const url = await uploadImage('events', id, file)
      patch({ image: url, imageAttribution: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload the cover.')
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    setBusy('delete')
    setError(null)
    try {
      await deleteEvent(id)
      navigate('/profile')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the event.')
      setBusy(null)
    }
  }

  if (!live.configured) {
    return (
      <EditorNotice title="Event">
        Firebase isn’t configured. Add the web app keys from <code>.env.example</code> to a local <code>.env</code>, then restart the dev server.
      </EditorNotice>
    )
  }
  if (!isNew && live.status === 'loading') return <EditorNotice title="Event">Loading this event…</EditorNotice>
  if (!isNew && live.status === 'error' && !stored) {
    return <EditorNotice title="Event">{live.error ?? 'Couldn’t load events.'}</EditorNotice>
  }
  if (missing) return <EditorNotice title="Event">This event isn’t in the database.</EditorNotice>
  if (!form) return <EditorNotice title="Event">Loading this event…</EditorNotice>

  return (
    <ScreenFrame title={isNew ? 'New event' : form.name || 'Edit event'}>
      <Link to="/profile" className="editor__back">
        Back to profile
      </Link>
      <form
        className="editor__form"
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        <Field label="Club">
          <select value={form.venueId} onChange={(event) => patch({ venueId: event.target.value })}>
            <option value="">Choose a club</option>
            {live.venues.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.name}
              </option>
            ))}
          </select>
        </Field>
        {live.venues.length === 0 && <p className="editor__hint">Add a club before this night can go on the map.</p>}
        <Field label="Name">
          <input value={form.name} onChange={(event) => patch({ name: event.target.value })} required />
        </Field>
        <div className="editor__grid">
          <Field label="Starts">
            <input type="datetime-local" value={form.startsAt} onChange={(event) => patch({ startsAt: event.target.value })} />
          </Field>
          <Field label="Duration (hours)">
            <input
              inputMode="decimal"
              value={form.durationHours}
              onChange={(event) => patch({ durationHours: event.target.value })}
            />
          </Field>
        </div>
        <Field label="Average ticket (EUR)" hint="0 for free entry. This is not the night-out price level.">
          <input inputMode="decimal" value={form.averagePrice} onChange={(event) => patch({ averagePrice: event.target.value })} />
        </Field>
        <GenrePicker genres={form.genres} onChange={(genres) => patch({ genres })} />
        <Field label="Description">
          <textarea value={form.description} onChange={(event) => patch({ description: event.target.value })} />
        </Field>
        <div className="editor__field">
          <span className="cf-label">Cover</span>
          {form.image && (
            <ul className="editor__photos">
              <li>
                <Cover seed={id} src={photoUrl(form.image)} alt="" className="editor__photo" />
                <div>
                  {photoCredit(form.image, form.imageAttribution) && (
                    <p className="editor__hint">{photoCredit(form.image, form.imageAttribution)}</p>
                  )}
                  <button type="button" className="editor__text-btn" onClick={() => patch({ image: '', imageAttribution: '' })}>
                    Remove
                  </button>
                </div>
              </li>
            </ul>
          )}
          <input
            value={form.image}
            placeholder="Image URL or a Places photo name"
            aria-label="Cover image"
            onChange={(event) => patch({ image: event.target.value })}
          />
          <input
            type="file"
            accept="image/*"
            aria-label="Upload a cover"
            disabled={busy != null}
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              void upload(file)
            }}
          />
          {busy === 'upload' && <span className="editor__hint">Uploading…</span>}
        </div>
        {error && <p className="editor__error">{error}</p>}
        <div className="editor__actions">
          <Button type="submit" disabled={busy != null}>
            {busy === 'save' ? 'Saving…' : 'Save event'}
          </Button>
          {!isNew && !confirmDelete && (
            <Button type="button" variant="ghost" disabled={busy != null} onClick={() => setConfirmDelete(true)}>
              Delete event
            </Button>
          )}
          {confirmDelete && (
            <>
              <Button type="button" variant="secondary" disabled={busy != null} onClick={() => void remove()}>
                {busy === 'delete' ? 'Deleting…' : 'Delete this event'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </>
          )}
        </div>
      </form>
    </ScreenFrame>
  )
}
