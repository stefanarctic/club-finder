import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button } from '../../../design-system'
import { useLiveCatalog } from '../../../data/LiveCatalog'
import { lookupPlace } from '../../../data/places'
import { deleteVenue, saveVenue, uploadImage } from '../../../data/records'
import type { Genre, Venue } from '../../../data/types'
import { ScreenFrame } from '../../shell/ScreenFrame'
import { EditorNotice, Field, GenrePicker, ImageList } from './editorShared'
import './Editors.css'

type VenueForm = {
  name: string
  neighbourhood: string
  address: string
  latitude: string
  longitude: string
  hours: string
  rating: string
  priceLevel: '1' | '2' | '3' | '4'
  genres: Genre[]
  description: string
  phone: string
  website: string
  mapsUrl: string
  googlePlaceId: string
  images: string[]
  imageAttributions: string[]
}

const emptyForm = (): VenueForm => ({
  name: '',
  neighbourhood: '',
  address: '',
  latitude: '',
  longitude: '',
  hours: '',
  rating: '',
  priceLevel: '2',
  genres: [],
  description: '',
  phone: '',
  website: '',
  mapsUrl: '',
  googlePlaceId: '',
  images: [],
  imageAttributions: [],
})

function toForm(venue: Venue): VenueForm {
  return {
    name: venue.name,
    neighbourhood: venue.neighbourhood,
    address: venue.address,
    latitude: String(venue.latitude),
    longitude: String(venue.longitude),
    hours: venue.hours,
    rating: String(venue.rating),
    priceLevel: String(venue.priceLevel) as VenueForm['priceLevel'],
    genres: venue.genres,
    description: venue.description,
    phone: venue.phone ?? '',
    website: venue.website ?? '',
    mapsUrl: venue.mapsUrl ?? '',
    googlePlaceId: venue.googlePlaceId ?? '',
    images: venue.images,
    imageAttributions: venue.images.map((_, index) => venue.imageAttributions?.[index] ?? ''),
  }
}

export function VenueEditor() {
  const params = useParams()
  const navigate = useNavigate()
  const live = useLiveCatalog()
  const isNew = !params.id
  const [draftId] = useState(() => `venue-${crypto.randomUUID().slice(0, 8)}`)
  const id = params.id ?? draftId
  const venue = live.venues.find((item) => item.id === params.id)
  const loadedId = useRef<string | null>(null)
  const [form, setForm] = useState<VenueForm | null>(null)
  const [missing, setMissing] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'save' | 'upload' | 'maps' | 'delete' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    document.title = isNew ? 'Club Finder · New club' : 'Club Finder · Edit club'
  }, [isNew])

  useEffect(() => {
    if (loadedId.current === id) return
    if (isNew) {
      loadedId.current = id
      setMissing(false)
      setForm(emptyForm())
      return
    }
    if (live.status === 'loading' || live.status === 'unconfigured') return
    if (!venue) {
      setForm(null)
      setMissing(true)
      return
    }
    loadedId.current = id
    setMissing(false)
    setForm(toForm(venue))
  }, [id, isNew, live.status, venue])

  const patch = (partial: Partial<VenueForm>) => setForm((current) => (current ? { ...current, ...partial } : current))

  const refresh = async () => {
    if (!form) return
    setError(null)
    setBusy('maps')
    try {
      const place = form.googlePlaceId.trim()
        ? await lookupPlace({ placeId: form.googlePlaceId.trim() })
        : await lookupPlace({ text: `${form.name} Bucharest` })
      patch({
        name: place.name || form.name,
        address: place.address || form.address,
        latitude: String(place.latitude),
        longitude: String(place.longitude),
        rating: place.rating == null ? form.rating : String(place.rating),
        priceLevel: place.priceLevel == null ? form.priceLevel : (String(place.priceLevel) as VenueForm['priceLevel']),
        hours: place.hours || form.hours,
        phone: place.phone || form.phone,
        website: place.website || form.website,
        mapsUrl: place.mapsUrl || form.mapsUrl,
        googlePlaceId: place.googlePlaceId || form.googlePlaceId,
        description: place.description || form.description,
        images: place.images.length > 0 ? place.images : form.images,
        imageAttributions: place.images.length > 0 ? place.imageAttributions : form.imageAttributions,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh from Maps.')
    } finally {
      setBusy(null)
    }
  }

  const save = async () => {
    if (!form) return
    const latitude = Number(form.latitude)
    const longitude = Number(form.longitude)
    const rating = form.rating.trim() === '' ? 0 : Number(form.rating)
    const priceLevel = Number(form.priceLevel)
    if (!form.name.trim()) {
      setError('Add a name.')
      return
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setError('Latitude and longitude need to be numbers.')
      return
    }
    if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
      setError('Rating is a number from 0 to 5.')
      return
    }
    if (priceLevel !== 1 && priceLevel !== 2 && priceLevel !== 3 && priceLevel !== 4) return
    setError(null)
    setBusy('save')
    try {
      await saveVenue({
        id,
        name: form.name.trim(),
        neighbourhood: form.neighbourhood.trim(),
        address: form.address.trim(),
        latitude,
        longitude,
        images: form.images,
        imageAttributions: form.imageAttributions,
        rating,
        priceLevel,
        hours: form.hours.trim(),
        genres: form.genres,
        description: form.description.trim(),
        phone: form.phone.trim() || undefined,
        website: form.website.trim() || undefined,
        mapsUrl: form.mapsUrl.trim() || undefined,
        googlePlaceId: form.googlePlaceId.trim() || undefined,
      })
      if (isNew) navigate(`/profile/clubs/${id}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the club.')
    } finally {
      setBusy(null)
    }
  }

  const upload = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setBusy('upload')
    try {
      const url = await uploadImage('venues', id, file)
      setForm((current) =>
        current
          ? { ...current, images: [...current.images, url], imageAttributions: [...current.imageAttributions, ''] }
          : current,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload the photo.')
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    setBusy('delete')
    setError(null)
    try {
      await deleteVenue(id)
      navigate('/profile')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the club.')
      setBusy(null)
    }
  }

  if (!live.configured) {
    return (
      <EditorNotice title="Club">
        Firebase isn’t configured. Add the web app keys from <code>.env.example</code> to a local <code>.env</code>, then restart the dev server.
      </EditorNotice>
    )
  }
  if (!isNew && live.status === 'loading') return <EditorNotice title="Club">Loading this club…</EditorNotice>
  if (!isNew && live.status === 'error' && !venue) {
    return <EditorNotice title="Club">{live.error ?? 'Couldn’t load clubs.'}</EditorNotice>
  }
  if (missing) return <EditorNotice title="Club">This club isn’t in the database.</EditorNotice>
  if (!form) return <EditorNotice title="Club">Loading this club…</EditorNotice>

  return (
    <ScreenFrame title={isNew ? 'New club' : form.name || 'Edit club'}>
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
        <Field label="Name">
          <input value={form.name} onChange={(event) => patch({ name: event.target.value })} required />
        </Field>
        <Field label="Neighbourhood">
          <input value={form.neighbourhood} onChange={(event) => patch({ neighbourhood: event.target.value })} />
        </Field>
        <Field label="Address">
          <input value={form.address} onChange={(event) => patch({ address: event.target.value })} />
        </Field>
        <div className="editor__grid">
          <Field label="Latitude">
            <input inputMode="decimal" value={form.latitude} onChange={(event) => patch({ latitude: event.target.value })} />
          </Field>
          <Field label="Longitude">
            <input inputMode="decimal" value={form.longitude} onChange={(event) => patch({ longitude: event.target.value })} />
          </Field>
        </div>
        <Field label="Hours">
          <textarea value={form.hours} onChange={(event) => patch({ hours: event.target.value })} />
        </Field>
        <div className="editor__grid">
          <Field label="Rating" hint="0 if Maps has no rating.">
            <input inputMode="decimal" value={form.rating} onChange={(event) => patch({ rating: event.target.value })} />
          </Field>
          <Field label="Night-out price" hint="1–4, not the ticket.">
            <select
              value={form.priceLevel}
              onChange={(event) => patch({ priceLevel: event.target.value as VenueForm['priceLevel'] })}
            >
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
            </select>
          </Field>
        </div>
        <GenrePicker genres={form.genres} onChange={(genres) => patch({ genres })} />
        <Field label="Description">
          <textarea value={form.description} onChange={(event) => patch({ description: event.target.value })} />
        </Field>
        <Field label="Phone">
          <input value={form.phone} onChange={(event) => patch({ phone: event.target.value })} />
        </Field>
        <Field label="Website">
          <input value={form.website} onChange={(event) => patch({ website: event.target.value })} />
        </Field>
        <Field label="Maps link">
          <input value={form.mapsUrl} onChange={(event) => patch({ mapsUrl: event.target.value })} />
        </Field>
        <Field label="Google place id" hint="Refresh fills address, hours, rating and photos. Save to keep them.">
          <input value={form.googlePlaceId} onChange={(event) => patch({ googlePlaceId: event.target.value })} />
        </Field>
        <div className="editor__actions">
          <Button type="button" variant="secondary" disabled={busy != null} onClick={() => void refresh()}>
            {busy === 'maps' ? 'Reading Maps…' : 'Refresh from Maps'}
          </Button>
        </div>
        <div className="editor__field">
          <span className="cf-label">Photos</span>
          <ImageList
            images={form.images}
            attributions={form.imageAttributions}
            onRemove={(index) =>
              patch({
                images: form.images.filter((_, item) => item !== index),
                imageAttributions: form.imageAttributions.filter((_, item) => item !== index),
              })
            }
          />
          <div className="editor__url-row">
            <input
              value={imageUrl}
              placeholder="https://…"
              aria-label="Image URL"
              onChange={(event) => setImageUrl(event.target.value)}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                const url = imageUrl.trim()
                if (!url) return
                patch({ images: [...form.images, url], imageAttributions: [...form.imageAttributions, ''] })
                setImageUrl('')
              }}
            >
              Add URL
            </Button>
          </div>
          <input
            type="file"
            accept="image/*"
            aria-label="Upload a photo"
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
            {busy === 'save' ? 'Saving…' : 'Save club'}
          </Button>
          {!isNew && !confirmDelete && (
            <Button type="button" variant="ghost" disabled={busy != null} onClick={() => setConfirmDelete(true)}>
              Delete club
            </Button>
          )}
          {confirmDelete && (
            <>
              <Button type="button" variant="secondary" disabled={busy != null} onClick={() => void remove()}>
                {busy === 'delete' ? 'Deleting…' : 'Delete this club and its events'}
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
