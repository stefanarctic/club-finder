import { GENRES, type Genre, type StoredEvent, type Venue } from './types'

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

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
}

/** Firestore rejects `undefined`. Empty optional strings are stored as empty and read back as absent. */
export function definedFields<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined)) as T
}

export function parseVenue(id: string, data: unknown): Venue | null {
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
    id,
    name,
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

export function venueDocument(venue: Venue): Record<string, unknown> {
  return {
    name: venue.name.trim(),
    neighbourhood: venue.neighbourhood.trim(),
    address: venue.address.trim(),
    latitude: venue.latitude,
    longitude: venue.longitude,
    images: venue.images,
    imageAttributions: venue.images.map((_, index) => venue.imageAttributions?.[index]?.trim() ?? ''),
    rating: venue.rating,
    priceLevel: venue.priceLevel,
    hours: venue.hours.trim(),
    genres: venue.genres,
    description: venue.description.trim(),
    phone: venue.phone?.trim() ?? '',
    website: venue.website?.trim() ?? '',
    mapsUrl: venue.mapsUrl?.trim() ?? '',
    googlePlaceId: venue.googlePlaceId?.trim() ?? '',
  }
}

export function parseStoredEvent(id: string, data: unknown): StoredEvent | null {
  if (!data || typeof data !== 'object') return null
  const raw = data as Record<string, unknown>
  const name = text(raw.name)
  const venueId = text(raw.venueId)
  const startsAt = text(raw.startsAt)
  const durationHours = finite(raw.durationHours)
  const averagePrice = finite(raw.averagePrice)
  if (!name || !venueId || !startsAt || Number.isNaN(new Date(startsAt).getTime())) return null
  if (durationHours == null || durationHours <= 0 || averagePrice == null || averagePrice < 0) return null
  if (raw.currency !== 'EUR') return null
  return {
    id,
    venueId,
    name,
    startsAt,
    durationHours,
    image: text(raw.image),
    imageAttribution: optionalText(raw.imageAttribution),
    averagePrice,
    currency: 'EUR',
    genres: Array.isArray(raw.genres) ? raw.genres.filter(isGenre) : [],
    description: text(raw.description),
  }
}

export function eventDocument(event: StoredEvent): Record<string, unknown> {
  return definedFields({
    venueId: event.venueId,
    name: event.name.trim(),
    startsAt: event.startsAt,
    durationHours: event.durationHours,
    image: event.image.trim(),
    imageAttribution: event.imageAttribution?.trim() ?? '',
    averagePrice: event.averagePrice,
    currency: 'EUR' as const,
    genres: event.genres,
    description: event.description.trim(),
  })
}
