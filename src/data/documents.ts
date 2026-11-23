import { GENRES, VENUE_TYPES, type EventPlace, type Genre, type StoredEvent, type VenueType } from './types'

const GENRE_SET = new Set<string>(GENRES)

function isGenre(value: unknown): value is Genre {
  return typeof value === 'string' && GENRE_SET.has(value)
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function optionalText(value: unknown): string | undefined {
  const trimmed = text(value)
  return trimmed || undefined
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function priceLevel(value: unknown): 1 | 2 | 3 | 4 | null {
  return value === 1 || value === 2 || value === 3 || value === 4 ? value : null
}

function venueType(value: unknown): VenueType {
  return VENUE_TYPES.find((item) => item === value) ?? 'club'
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
}

/** Firestore rejects `undefined`. Empty optional strings are stored as empty and read back as absent. */
export function definedFields<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined)) as T
}

export function parseEventPlace(data: unknown): EventPlace | null {
  if (!data || typeof data !== 'object') return null
  const raw = data as Record<string, unknown>
  const name = text(raw.name)
  const latitude = finite(raw.latitude)
  const longitude = finite(raw.longitude)
  const level = priceLevel(raw.priceLevel)
  if (!name || latitude == null || longitude == null || level == null) return null
  const images = strings(raw.images)
  const credits = Array.isArray(raw.imageAttributions)
    ? raw.imageAttributions.map((item) => (typeof item === 'string' ? item.trim() : ''))
    : []
  return {
    name,
    venueType: venueType(raw.venueType),
    neighbourhood: text(raw.neighbourhood),
    address: text(raw.address),
    latitude,
    longitude,
    images,
    imageAttributions: credits.length > 0 ? credits : undefined,
    rating: Math.min(5, Math.max(0, finite(raw.rating) ?? 0)),
    priceLevel: level,
    hours: text(raw.hours),
    genres: Array.isArray(raw.genres) ? raw.genres.filter(isGenre) : [],
    description: text(raw.description),
    phone: optionalText(raw.phone),
    website: optionalText(raw.website),
    mapsUrl: optionalText(raw.mapsUrl),
    googlePlaceId: optionalText(raw.googlePlaceId),
  }
}

export function placeDocument(place: EventPlace): Record<string, unknown> {
  return {
    name: place.name.trim(),
    venueType: place.venueType,
    neighbourhood: place.neighbourhood.trim(),
    address: place.address.trim(),
    latitude: place.latitude,
    longitude: place.longitude,
    images: place.images,
    imageAttributions: place.images.map((_, index) => place.imageAttributions?.[index]?.trim() ?? ''),
    rating: place.rating,
    priceLevel: place.priceLevel,
    hours: place.hours.trim(),
    genres: place.genres,
    description: place.description.trim(),
    phone: place.phone?.trim() ?? '',
    website: place.website?.trim() ?? '',
    mapsUrl: place.mapsUrl?.trim() ?? '',
    googlePlaceId: place.googlePlaceId?.trim() ?? '',
  }
}

function parseNightFields(id: string, raw: Record<string, unknown>) {
  const name = text(raw.name)
  const startsAt = text(raw.startsAt)
  const durationHours = finite(raw.durationHours)
  const averagePrice = finite(raw.averagePrice)
  if (!name || !startsAt || Number.isNaN(new Date(startsAt).getTime())) return null
  if (durationHours == null || durationHours <= 0 || averagePrice == null || averagePrice < 0) return null
  if (raw.currency !== 'EUR') return null
  return {
    id,
    name,
    startsAt,
    durationHours,
    image: text(raw.image),
    images: strings(raw.images),
    imageAttribution: optionalText(raw.imageAttribution),
    averagePrice,
    currency: 'EUR' as const,
    genres: Array.isArray(raw.genres) ? raw.genres.filter(isGenre) : [],
    description: text(raw.description),
    createdBy: optionalText(raw.createdBy),
  }
}

/** An event saved before the place lived on the document. The venue is joined at read time. */
export type LinkedEvent = NonNullable<ReturnType<typeof parseNightFields>> & { venueId: string }

export function parseStoredEvent(id: string, data: unknown): StoredEvent | LinkedEvent | null {
  if (!data || typeof data !== 'object') return null
  const raw = data as Record<string, unknown>
  const fields = parseNightFields(id, raw)
  if (!fields) return null
  const venue = parseEventPlace(raw.venue)
  if (venue) return { ...fields, venue }
  const venueId = text(raw.venueId)
  if (!venueId) return null
  return { ...fields, venueId }
}

export function isLinkedEvent(event: StoredEvent | LinkedEvent): event is LinkedEvent {
  return 'venueId' in event
}

export function eventDocument(event: StoredEvent): Record<string, unknown> {
  return definedFields({
    name: event.name.trim(),
    createdBy: event.createdBy,
    startsAt: event.startsAt,
    durationHours: event.durationHours,
    image: event.image.trim(),
    images: (event.images ?? []).map((item) => item.trim()).filter((item) => item.length > 0),
    imageAttribution: event.imageAttribution?.trim() ?? '',
    averagePrice: event.averagePrice,
    currency: 'EUR' as const,
    genres: event.genres,
    description: event.description.trim(),
    venue: placeDocument(event.venue),
  })
}
