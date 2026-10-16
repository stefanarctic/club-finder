export const GENRES = ['techno', 'house', 'hip-hop', 'live', 'commercial', 'queer', 'latin'] as const
export type Genre = (typeof GENRES)[number]

export const MAX_GENRE_PICKS = 3

export const BUDGETS = ['under50', '50to100', '100plus'] as const
export type Budget = (typeof BUDGETS)[number]

export type LatLng = { latitude: number; longitude: number }

export type City = {
  id: string
  name: string
  boundingBox: { north: number; south: number; west: number; east: number }
  defaultCenter: LatLng
  /** Shown wherever the fallback origin is named, e.g. "Distances are measured from Piața Unirii". */
  defaultCenterName: string
}

export type Venue = {
  id: string
  name: string
  cityId: string
  neighbourhood: string
  address: string
  latitude: number
  longitude: number
  /** Local paths, served from `public/photos`. */
  images: string[]
  /** Placeholder, 0–5. */
  rating: number
  /** Cost of a night out, 1–4. Never the ticket price. */
  priceLevel: 1 | 2 | 3 | 4
  hours: string
  genres: Genre[]
  description: string
}

/**
 * When an event starts, relative to the moment the app loads. Absolute dates are never stored
 * because they go stale.
 */
export type EventStart =
  /** Local calendar day offset, `0` meaning today. */
  | { daysFromToday: number; hour: number; minute: number }
  /** The coming Saturday or Sunday (today, if today is that day). */
  | { weekday: 'saturday' | 'sunday'; hour: number; minute: number }
  /** Offset from load time. Keeps "on now" and "starts soon" visible whatever the clock says. */
  | { minutesFromLoad: number }

export type ClubEvent = {
  id: string
  venueId: string
  name: string
  start: EventStart
  durationHours: number
  /** Local path, served from `public/photos`. */
  image: string
  /** Average ticket or door price. */
  averagePrice: number
  currency: 'EUR'
  genres: Genre[]
  description: string
}
