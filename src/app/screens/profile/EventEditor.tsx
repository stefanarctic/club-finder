import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button, Cover } from '../../../design-system'
import { useLiveCatalog } from '../../../data/LiveCatalog'
import { lookupMapsLink, type PlaceDraft } from '../../../data/places'
import { photoCredit, photoUrl } from '../../../data/photos'
import { deleteEvent, saveEvent, uploadImage } from '../../../data/records'
import { VENUE_TYPES, type EventPlace, type Genre, type StoredEvent, type VenueType } from '../../../data/types'
import { canEditEvent, canManage, useAccount } from '../../auth'
import { venueTypeLabels } from '../../format'
import { ScreenFrame } from '../../shell/ScreenFrame'
import { useTickets } from '../../tickets'
import { DoorStaffEditor } from './DoorStaffEditor'
import { EditorNotice, Field, GenrePicker, ImageList, fromDatetimeLocal, toDatetimeLocal } from './editorShared'
import { PlacePinMap } from './PlacePinMap'
import './Editors.css'

type PlaceForm = {
  venueType: VenueType
  mapsUrl: string
  name: string
  neighbourhood: string
  address: string
  latitude: string
  longitude: string
  hours: string
  rating: string
  priceLevel: '1' | '2' | '3' | '4'
  description: string
  phone: string
  website: string
  googlePlaceId: string
  images: string[]
  imageAttributions: string[]
  genres: Genre[]
}

type EventForm = {
  name: string
  startsAt: string
  durationHours: string
  averagePrice: string
  genres: Genre[]
  description: string
  image: string
  images: string[]
  imageAttribution: string
  place: PlaceForm
}

const emptyPlace = (): PlaceForm => ({
  venueType: 'club',
  mapsUrl: '',
  name: '',
  neighbourhood: '',
  address: '',
  latitude: '',
  longitude: '',
  hours: '',
  rating: '',
  priceLevel: '2',
  description: '',
  phone: '',
  website: '',
  googlePlaceId: '',
  images: [],
  imageAttributions: [],
  genres: [],
})

const emptyForm = (): EventForm => ({
  name: '',
  startsAt: '',
  durationHours: '6',
  averagePrice: '',
  genres: [],
  description: '',
  image: '',
  images: [],
  imageAttribution: '',
  place: emptyPlace(),
})

function coordinate(value: string): number | null {
  if (value.trim() === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function toPlaceForm(place: EventPlace): PlaceForm {
  return {
    venueType: place.venueType,
    mapsUrl: place.mapsUrl ?? '',
    name: place.name,
    neighbourhood: place.neighbourhood,
    address: place.address,
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    hours: place.hours,
    rating: place.rating ? String(place.rating) : '',
    priceLevel: String(place.priceLevel) as PlaceForm['priceLevel'],
    description: place.description,
    phone: place.phone ?? '',
    website: place.website ?? '',
    googlePlaceId: place.googlePlaceId ?? '',
    images: place.images,
    imageAttributions: place.images.map((_, index) => place.imageAttributions?.[index] ?? ''),
    genres: place.genres,
  }
}

function toForm(event: StoredEvent): EventForm {
  return {
    name: event.name,
    startsAt: toDatetimeLocal(event.startsAt),
    durationHours: String(event.durationHours),
    averagePrice: String(event.averagePrice),
    genres: event.genres,
    description: event.description,
    image: event.image,
    images: event.images ?? [],
    imageAttribution: event.imageAttribution ?? '',
    place: toPlaceForm(event.venue),
  }
}

export function EventEditor() {
  const params = useParams()
  const navigate = useNavigate()
  const live = useLiveCatalog()
  const { ready, account } = useAccount()
  const isNew = !params.id
  const [draftId] = useState(() => `event-${crypto.randomUUID().slice(0, 8)}`)
  const id = params.id ?? draftId
  const stored = live.storedEvents.find((item) => item.id === params.id)
  const { stock } = useTickets()
  const hasSales = !isNew && stock[id] !== undefined
  const loadedId = useRef<string | null>(null)
  const [form, setForm] = useState<EventForm | null>(null)
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'save' | 'upload' | 'place' | 'maps' | 'delete' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [choices, setChoices] = useState<PlaceDraft[]>([])
  const [placeUrl, setPlaceUrl] = useState('')

  useEffect(() => {
    document.title = isNew ? 'Club Finder · New event' : 'Club Finder · Edit event'
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
    if (!stored) {
      setForm(null)
      setMissing(true)
      return
    }
    loadedId.current = id
    setMissing(false)
    setForm(toForm(stored))
    setPlaceUrl(stored.venue.mapsUrl ?? '')
  }, [id, isNew, live.status, stored])

  const patch = (partial: Partial<EventForm>) => setForm((current) => (current ? { ...current, ...partial } : current))
  const patchPlace = (partial: Partial<PlaceForm>) =>
    setForm((current) => (current ? { ...current, place: { ...current.place, ...partial } } : current))

  const applyPlace = (place: PlaceDraft) => {
    patchPlace({
      name: place.name || form?.place.name || '',
      address: place.address,
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      rating: place.rating == null ? form?.place.rating ?? '' : String(place.rating),
      priceLevel: place.priceLevel == null ? form?.place.priceLevel ?? '2' : (String(place.priceLevel) as PlaceForm['priceLevel']),
      hours: place.hours,
      phone: place.phone,
      website: place.website,
      mapsUrl: place.mapsUrl || placeUrl,
      googlePlaceId: place.googlePlaceId,
      description: place.description || form?.place.description || '',
      images: place.images.length > 0 ? place.images : form?.place.images ?? [],
      imageAttributions: place.images.length > 0 ? place.imageAttributions : form?.place.imageAttributions ?? [],
    })
    setChoices([])
  }

  const fillFromMaps = async () => {
    if (!form) return
    setError(null)
    setBusy('maps')
    try {
      const places = await lookupMapsLink(placeUrl || form.place.mapsUrl)
      if (places.length === 1) applyPlace(places[0])
      else setChoices(places)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that place from Maps.')
    } finally {
      setBusy(null)
    }
  }

  const save = async () => {
    if (!form || !account) return
    const startsAt = fromDatetimeLocal(form.startsAt)
    const durationHours = Number(form.durationHours)
    const averagePrice = Number(form.averagePrice)
    const latitude = Number(form.place.latitude)
    const longitude = Number(form.place.longitude)
    const rating = form.place.rating.trim() === '' ? 0 : Number(form.place.rating)
    const priceLevel = Number(form.place.priceLevel)
    if (!form.name.trim()) {
      setError('Add a name.')
      return
    }
    if (!form.place.name.trim()) {
      setError('Add the venue name.')
      return
    }
    if (form.place.latitude.trim() === '' || form.place.longitude.trim() === '' || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setError('Set the venue on the map, or fill it from Maps.')
      return
    }
    if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
      setError('Rating is a number from 0 to 5.')
      return
    }
    if (priceLevel !== 1 && priceLevel !== 2 && priceLevel !== 3 && priceLevel !== 4) return
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
        name: form.name.trim(),
        startsAt,
        durationHours,
        image: form.image.trim(),
        images: form.images,
        imageAttribution: form.imageAttribution.trim() || undefined,
        averagePrice,
        currency: 'EUR',
        genres: form.genres,
        description: form.description.trim(),
        createdBy: isNew ? account.id : stored?.createdBy,
        venue: {
          name: form.place.name.trim(),
          venueType: form.place.venueType,
          neighbourhood: form.place.neighbourhood.trim(),
          address: form.place.address.trim(),
          latitude,
          longitude,
          images: form.place.images,
          imageAttributions: form.place.imageAttributions,
          rating,
          priceLevel,
          hours: form.place.hours.trim(),
          genres: form.place.genres,
          description: form.place.description.trim(),
          phone: form.place.phone.trim() || undefined,
          website: form.place.website.trim() || undefined,
          mapsUrl: (form.place.mapsUrl || placeUrl).trim() || undefined,
          googlePlaceId: form.place.googlePlaceId.trim() || undefined,
        },
      })
      if (isNew) navigate(`/profile/events/${id}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the event.')
    } finally {
      setBusy(null)
    }
  }

  const uploadCover = async (file: File | undefined) => {
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

  const uploadPlacePhoto = async (file: File | undefined) => {
    if (!file || !form) return
    setError(null)
    setBusy('place')
    try {
      const url = await uploadImage('events', id, file)
      patchPlace({ images: [...form.place.images, url], imageAttributions: [...form.place.imageAttributions, ''] })
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
  if (!ready || (!isNew && live.status === 'loading')) return <EditorNotice title="Event">Loading this event…</EditorNotice>
  if (!isNew && live.status === 'error' && !stored) {
    return <EditorNotice title="Event">{live.error ?? 'Couldn’t load events.'}</EditorNotice>
  }
  if (missing) return <EditorNotice title="Event">This event isn’t in the database.</EditorNotice>
  if (isNew && !canManage(account)) {
    return <EditorNotice title="Event">Event managers add events. An admin can promote your account.</EditorNotice>
  }
  if (!isNew && !canEditEvent(account, stored?.createdBy)) {
    return <EditorNotice title="Event">You can edit events you created. An admin can edit any event.</EditorNotice>
  }
  if (!form) return <EditorNotice title="Event">Loading this event…</EditorNotice>

  const latitude = coordinate(form.place.latitude)
  const longitude = coordinate(form.place.longitude)
  const manual = form.place.venueType === 'other'

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
        <Field label="About the night">
          <textarea value={form.description} onChange={(event) => patch({ description: event.target.value })} />
        </Field>
        <div className="editor__field">
          <span className="cf-label">Cover</span>
          {form.image && (
            <ul className="editor__photos">
              <li>
                <Cover seed={id} src={photoUrl(form.image, 'cover')} alt="" className="editor__photo" />
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
              void uploadCover(file)
            }}
          />
          {busy === 'upload' && <span className="editor__hint">Uploading…</span>}
        </div>

        <Field label="Venue type">
          <select
            value={form.place.venueType}
            onChange={(event) => patchPlace({ venueType: event.target.value as VenueType })}
          >
            {VENUE_TYPES.map((type) => (
              <option key={type} value={type}>
                {venueTypeLabels[type]}
              </option>
            ))}
          </select>
        </Field>

        {!manual && (
          <div className="editor__field">
            <span className="cf-label">Google Maps link</span>
            <div className="editor__url-row">
              <input
                value={placeUrl}
                placeholder="https://www.google.com/maps/place/…"
                aria-label="Google Maps link"
                onChange={(event) => setPlaceUrl(event.target.value)}
              />
              <Button type="button" variant="secondary" disabled={busy != null} onClick={() => void fillFromMaps()}>
                {busy === 'maps' ? 'Reading…' : 'Fill from Maps'}
              </Button>
            </div>
            <span className="editor__hint">
              Short maps.app.goo.gl links can’t be opened here. Open the link, then paste the full URL from the address bar.
            </span>
            {choices.length > 1 && (
              <ul className="editor__choices">
                {choices.map((place) => (
                  <li key={place.googlePlaceId || place.name}>
                    <button type="button" className="editor__choice" onClick={() => applyPlace(place)}>
                      <span>{place.name}</span>
                      <small>{place.address}</small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <Field label="Venue name">
          <input value={form.place.name} onChange={(event) => patchPlace({ name: event.target.value })} />
        </Field>
        <Field label="Address">
          <input value={form.place.address} onChange={(event) => patchPlace({ address: event.target.value })} />
        </Field>
        <Field label="Neighbourhood">
          <input value={form.place.neighbourhood} onChange={(event) => patchPlace({ neighbourhood: event.target.value })} />
        </Field>
        <div className="editor__field">
          <span className="cf-label">Location</span>
          <PlacePinMap
            latitude={latitude}
            longitude={longitude}
            onPick={(lat, lng) => patchPlace({ latitude: lat.toFixed(6), longitude: lng.toFixed(6) })}
          />
          <span className="editor__hint">Click the map to drop a pin. Latitude and longitude stay editable.</span>
        </div>
        <div className="editor__grid">
          <Field label="Latitude">
            <input value={form.place.latitude} inputMode="decimal" onChange={(event) => patchPlace({ latitude: event.target.value })} />
          </Field>
          <Field label="Longitude">
            <input value={form.place.longitude} inputMode="decimal" onChange={(event) => patchPlace({ longitude: event.target.value })} />
          </Field>
        </div>
        <Field label="Hours">
          <input value={form.place.hours} onChange={(event) => patchPlace({ hours: event.target.value })} />
        </Field>
        <div className="editor__grid">
          <Field label="Rating">
            <input value={form.place.rating} inputMode="decimal" onChange={(event) => patchPlace({ rating: event.target.value })} />
          </Field>
          <Field label="Night-out price">
            <select
              value={form.place.priceLevel}
              onChange={(event) => patchPlace({ priceLevel: event.target.value as PlaceForm['priceLevel'] })}
            >
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
            </select>
          </Field>
        </div>
        <Field label="Phone">
          <input value={form.place.phone} onChange={(event) => patchPlace({ phone: event.target.value })} />
        </Field>
        <Field label="Website">
          <input value={form.place.website} onChange={(event) => patchPlace({ website: event.target.value })} />
        </Field>
        <Field label="About the place">
          <textarea value={form.place.description} onChange={(event) => patchPlace({ description: event.target.value })} />
        </Field>
        <div className="editor__field">
          <span className="cf-label">Venue photos</span>
          <ImageList
            images={form.place.images}
            attributions={form.place.imageAttributions}
            onRemove={(index) =>
              patchPlace({
                images: form.place.images.filter((_, item) => item !== index),
                imageAttributions: form.place.imageAttributions.filter((_, item) => item !== index),
              })
            }
          />
          <input
            type="file"
            accept="image/*"
            aria-label="Upload a venue photo"
            disabled={busy != null}
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              void uploadPlacePhoto(file)
            }}
          />
          {busy === 'place' && <span className="editor__hint">Uploading…</span>}
        </div>

        {error && <p className="editor__error">{error}</p>}
        <div className="editor__actions">
          <Button type="submit" disabled={busy != null}>
            {busy === 'save' ? 'Saving…' : 'Save event'}
          </Button>
          {!isNew && !confirmDelete && !hasSales && (
            <Button type="button" variant="ghost" disabled={busy != null} onClick={() => setConfirmDelete(true)}>
              Delete event
            </Button>
          )}
          {!isNew && hasSales && <span className="editor__hint">Passes have been issued for this night, so it can’t be deleted.</span>}
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
      {!isNew && <DoorStaffEditor eventId={id} />}
    </ScreenFrame>
  )
}
