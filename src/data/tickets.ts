/**
 * Passes as the app reads them. Tickets are issued, priced, and stamped only by the Cloud Functions;
 * the browser reads its own `tickets` documents and never writes them.
 */
import { isTicketId, type EventStock, type TicketKind, type TicketTier } from '../../shared/ticketing'

export {
  MAX_PASSES_PER_EVENT,
  MAX_PASSES_PER_ORDER,
  orderQuote,
  serviceFee,
  tierRemaining,
  tiersFor,
  type EventStock,
  type TicketKind,
  type TicketTier,
} from '../../shared/ticketing'

export const REFUND_RULE = 'Passes are final. Refunds are not available yet.'

export type AvailableTier = TicketTier & { remaining: number }

export type PassStatus = 'valid' | 'used'

export type Pass = {
  id: string
  orderId: string
  eventId: string
  eventName: string
  venueName: string
  address: string
  latitude: number
  longitude: number
  startsAt: string
  endsAt: string
  image: string
  tierId: string
  tierName: string
  price: number
  currency: 'EUR'
  /** Service fee for the whole order, repeated on each pass. */
  fee: number
  orderCount: number
  buyerName: string
  buyerEmail: string
  purchasedAt: string
  status: PassStatus
  usedAt: string | null
  keyVersion: number
}

export type PassPile = 'upcoming' | 'used' | 'past'

export function formatPrice(amount: number, currency: 'EUR' = 'EUR'): string {
  if (amount === 0) return 'Free'
  return `${amount} ${currency}`
}

/** A short reference people can read out at the door. The id alone never admits anyone. */
export function passRef(id: string): string {
  return `${id.slice(0, 4)}-${id.slice(4, 8)}`
}

/** Ended nights are past, even if stamped. Used is only a night that has not ended. */
export function passPile(pass: Pass, now: Date): PassPile {
  if (new Date(pass.endsAt).getTime() <= now.getTime()) return 'past'
  if (pass.status === 'used') return 'used'
  return 'upcoming'
}

export function parsePass(id: string, data: unknown): Pass | null {
  if (!isTicketId(id) || !data || typeof data !== 'object') return null
  const raw = data as Record<string, unknown>
  const status = raw.status === 'valid' || raw.status === 'used' ? raw.status : null
  const latitude = finite(raw.latitude)
  const longitude = finite(raw.longitude)
  const price = finite(raw.price)
  const fee = finite(raw.fee)
  const orderCount = finite(raw.orderCount)
  const keyVersion = finite(raw.keyVersion)
  if (!status || latitude == null || longitude == null || price == null || fee == null) return null
  if (orderCount == null || !Number.isInteger(orderCount) || orderCount < 1) return null
  if (keyVersion == null || !Number.isInteger(keyVersion) || keyVersion < 1) return null
  const fields = {
    orderId: text(raw.orderId),
    eventId: text(raw.eventId),
    eventName: text(raw.eventName),
    venueName: text(raw.venueName),
    tierId: text(raw.tierId),
    tierName: text(raw.tierName),
    buyerName: text(raw.buyerName),
  }
  if (Object.values(fields).some((value) => !value)) return null
  if (!isInstant(raw.startsAt) || !isInstant(raw.endsAt) || !isInstant(raw.createdAt)) return null
  const usedAt = isInstant(raw.usedAt) ? raw.usedAt : null
  return {
    id,
    ...fields,
    address: text(raw.address),
    latitude,
    longitude,
    startsAt: raw.startsAt,
    endsAt: raw.endsAt,
    image: text(raw.image),
    price,
    currency: 'EUR',
    fee,
    orderCount,
    buyerEmail: text(raw.buyerEmail),
    purchasedAt: raw.createdAt,
    status,
    usedAt: status === 'used' ? usedAt : null,
    keyVersion,
  }
}

const KINDS: TicketKind[] = ['early', 'general', 'late', 'free']

export function parseStock(data: unknown): EventStock {
  const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
  const rawTiers = raw.tiers && typeof raw.tiers === 'object' ? (raw.tiers as Record<string, unknown>) : {}
  const tiers: EventStock['tiers'] = {}
  for (const kind of KINDS) {
    const entry = rawTiers[kind] as { capacity?: unknown; sold?: unknown } | undefined
    const capacity = finite(entry?.capacity)
    const sold = finite(entry?.sold)
    if (capacity != null && sold != null) tiers[kind] = { capacity, sold }
  }
  return { tiers, used: finite(raw.used) ?? 0 }
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function isInstant(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}
