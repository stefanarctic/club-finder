const HOUR = 60 * 60 * 1000

export type SaleEvent = {
  id: string
  name: string
  startsAt: string
  endsAt: string
  image: string
  averagePrice: number
  createdBy: string | null
  venueName: string
  address: string
  latitude: number
  longitude: number
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** Only events that carry their own place can sell. Anything malformed is treated as not on sale. */
export function parseSaleEvent(id: string, data: unknown): SaleEvent | null {
  if (!data || typeof data !== 'object') return null
  const raw = data as Record<string, unknown>
  const venue = raw.venue && typeof raw.venue === 'object' ? (raw.venue as Record<string, unknown>) : null
  const name = text(raw.name)
  const start = Date.parse(text(raw.startsAt))
  const durationHours = finite(raw.durationHours)
  const averagePrice = finite(raw.averagePrice)
  const latitude = finite(venue?.latitude)
  const longitude = finite(venue?.longitude)
  if (!venue || !name || Number.isNaN(start) || raw.currency !== 'EUR') return null
  if (durationHours == null || durationHours <= 0 || durationHours > 48) return null
  if (averagePrice == null || averagePrice < 0 || latitude == null || longitude == null) return null
  const venueName = text(venue.name)
  if (!venueName) return null
  return {
    id,
    name,
    startsAt: new Date(start).toISOString(),
    endsAt: new Date(start + durationHours * HOUR).toISOString(),
    image: text(raw.image),
    averagePrice,
    createdBy: text(raw.createdBy) || null,
    venueName,
    address: text(venue.address),
    latitude,
    longitude,
  }
}

const EVENT_ID = /^[A-Za-z0-9_-]{1,200}$/

export function isEventId(value: unknown): value is string {
  return typeof value === 'string' && EVENT_ID.test(value)
}
