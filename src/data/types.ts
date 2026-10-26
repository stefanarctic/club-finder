export const GENRES = ['techno', 'house', 'hip-hop', 'live', 'commercial', 'queer', 'latin'] as const
export type Genre = (typeof GENRES)[number]

export const MAX_GENRE_PICKS = 3

export const BUDGETS = ['under50', '50to100', '100plus'] as const
export type Budget = (typeof BUDGETS)[number]

export type LatLng = { latitude: number; longitude: number }

export type BoundingBox = { north: number; south: number; west: number; east: number }

export type City = {
  id: string
  name: string
  boundingBox: BoundingBox
  defaultCenter: LatLng
  /** Shown wherever the fallback origin is named, e.g. "Distances are measured from Piața Unirii". */
  defaultCenterName: string
}

/** A country is only a bounding box the map can open on. Events are not stored against it. */
export type Country = {
  id: string
  name: string
  boundingBox: BoundingBox
}

export type Venue = {
  id: string
  name: string
  neighbourhood: string
  address: string
  /** The city is whichever city bounds contain this point. It is not stored on the venue. */
  latitude: number
  longitude: number
  /**
   * Local paths, download URLs, or Places photo resource names (`places/…/photos/…`).
   * Resource names are resolved at display time and are not copied into storage.
   */
  images: string[]
  /** Parallel to `images`. Set for Google photos. Empty entries have no credit line. */
  imageAttributions?: string[]
  /** 0–5. `0` means the listing has no rating yet. */
  rating: number
  /** Cost of a night out, 1–4. Never the ticket price. */
  priceLevel: 1 | 2 | 3 | 4
  hours: string
  genres: Genre[]
  description: string
  phone?: string
  website?: string
  mapsUrl?: string
  googlePlaceId?: string
}

/**
 * When a placeholder event starts, relative to the moment the tests load it.
 * Live events store an absolute `startsAt` instead, so a saved night does not move.
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
  /** Local path, download URL, or a Places photo resource name. Empty when there is no cover. */
  image: string
  /** Credit line when `image` is a Google photo. */
  imageAttribution?: string
  /** Average ticket or door price. `0` means free entry. */
  averagePrice: number
  currency: 'EUR'
  genres: Genre[]
  description: string
}

/** An event document. `startsAt` is an ISO 8601 instant and stays on that date. */
export type StoredEvent = {
  id: string
  venueId: string
  name: string
  startsAt: string
  durationHours: number
  image: string
  imageAttribution?: string
  averagePrice: number
  currency: 'EUR'
  genres: Genre[]
  description: string
}
