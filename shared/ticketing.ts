/**
 * Ticket rules shared by the app and the Cloud Functions.
 * Pure code only: no Firebase, no Node or DOM APIs beyond `btoa`/`atob`, which both runtimes have.
 */

export const MAX_PASSES_PER_ORDER = 8
export const MAX_PASSES_PER_EVENT = 8

/** A QR code is good for one period. The door accepts the period before and after for clock drift. */
export const CODE_PERIOD_MS = 120_000
export const CODE_SKEW_PERIODS = 1

/** Doors open for scanning this long before the start, and close when the night ends. */
export const SCAN_OPENS_BEFORE_MS = 6 * 60 * 60 * 1000

export const FUNCTIONS_REGION = 'europe-west1'

export const PAYLOAD_VERSION = 'CF1'

/** 16 random bytes in base64url, no padding. */
export const TICKET_ID_LENGTH = 22
/** 16 bytes of the HMAC-SHA256 output in base64url, no padding. */
export const MAC_LENGTH = 22
export const MAC_BYTES = 16

const BASE64URL_ID = /^[A-Za-z0-9_-]+$/
const PAYLOAD_PATTERN = /^CF1\.([A-Za-z0-9_-]{22})\.(\d{1,12})\.([A-Za-z0-9_-]{22})$/

export type TicketKind = 'early' | 'general' | 'late' | 'free'

export type TicketTier = {
  id: string
  eventId: string
  kind: TicketKind
  name: string
  note: string
  price: number
  currency: 'EUR'
  capacity: number
}

export type TierStock = { capacity: number; sold: number }

/** `ticketStock/{eventId}`. Tiers are keyed by kind so map keys stay plain. */
export type EventStock = { tiers: Partial<Record<TicketKind, TierStock>>; used: number }

export type OrderLine = { tier: TicketTier; quantity: number }

export type TicketStatus = 'valid' | 'used'

export type RedeemReason =
  | 'accepted'
  | 'already_used'
  | 'expired_code'
  | 'bad_signature'
  | 'bad_format'
  | 'wrong_event'
  | 'not_open'
  | 'closed'
  | 'not_found'

export type RedeemResult = {
  result: RedeemReason
  tierName?: string
  buyerName?: string
  usedAt?: string
  usedByName?: string
}

/** 10% of the subtotal, rounded to a whole euro, at least 1 EUR. Free nights pay nothing. */
export function serviceFee(subtotal: number): number {
  if (!(subtotal > 0)) return 0
  return Math.max(1, Math.round(subtotal * 0.1))
}

export function tiersFor(event: { id: string; averagePrice: number }): TicketTier[] {
  const free = makeTier(event.id, 'free', 'Free entry', 'No charge at the door', 0, between(`${event.id}:free`, 80, 200))
  if (!Number.isFinite(event.averagePrice) || event.averagePrice <= 0) return [free]

  const price = event.averagePrice
  const candidates = [
    makeTier(event.id, 'early', 'Before midnight', 'In before 00:00', Math.round(price * 0.8), between(`${event.id}:early`, 24, 60)),
    makeTier(event.id, 'general', 'General admission', 'Standard entry', Math.round(price), between(`${event.id}:general`, 80, 180)),
    makeTier(event.id, 'late', 'Late entry', 'After 01:00', Math.round(price * 1.5), between(`${event.id}:late`, 12, 40)),
  ]
  const seen = new Set<number>()
  const tiers: TicketTier[] = []
  for (const tier of candidates) {
    if (tier.price <= 0 || seen.has(tier.price)) continue
    seen.add(tier.price)
    tiers.push(tier)
  }
  return tiers.length > 0 ? tiers : [free]
}

/** The first sale freezes a tier's capacity, so editing the event later cannot oversell it. */
export function tierRemaining(tier: TicketTier, stock: EventStock | null): number {
  const entry = stock?.tiers[tier.kind]
  const capacity = entry?.capacity ?? tier.capacity
  return Math.max(0, capacity - (entry?.sold ?? 0))
}

export function orderQuote(tiers: TicketTier[], quantities: Record<string, number>) {
  const lines = tiers
    .map((tier) => ({ tier, quantity: quantities[tier.id] ?? 0 }))
    .filter((line) => line.quantity > 0)
  const count = lines.reduce((sum, line) => sum + line.quantity, 0)
  const subtotal = lines.reduce((sum, line) => sum + line.tier.price * line.quantity, 0)
  const fee = serviceFee(subtotal)
  return { lines, count, subtotal, fee, total: subtotal + fee }
}

export type PlannedOrder = { lines: OrderLine[]; count: number; subtotal: number; fee: number; total: number }

/**
 * Checks requested lines against the tiers the server derived itself. Prices never come from the request.
 * Stock and the per-account cap are checked separately, inside the transaction.
 */
export function planOrder(
  tiers: TicketTier[],
  requested: unknown,
): { ok: true; order: PlannedOrder } | { ok: false; error: string } {
  if (!Array.isArray(requested) || requested.length === 0 || requested.length > tiers.length) {
    return { ok: false, error: 'Choose at least one pass.' }
  }
  const wanted = new Map<string, number>()
  for (const line of requested) {
    if (!line || typeof line !== 'object') return { ok: false, error: 'Choose at least one pass.' }
    const { tierId, quantity } = line as { tierId?: unknown; quantity?: unknown }
    if (typeof tierId !== 'string' || tierId.length > 300) return { ok: false, error: 'Those tickets are no longer on sale.' }
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 0 || quantity > MAX_PASSES_PER_ORDER) {
      return { ok: false, error: 'Choose at least one pass.' }
    }
    if (quantity === 0) continue
    wanted.set(tierId, (wanted.get(tierId) ?? 0) + quantity)
  }

  const count = [...wanted.values()].reduce((sum, quantity) => sum + quantity, 0)
  if (count === 0) return { ok: false, error: 'Choose at least one pass.' }
  if (count > MAX_PASSES_PER_ORDER) return { ok: false, error: `You can take up to ${MAX_PASSES_PER_ORDER} passes at once.` }

  const lines: OrderLine[] = []
  for (const tier of tiers) {
    const quantity = wanted.get(tier.id)
    if (!quantity) continue
    wanted.delete(tier.id)
    lines.push({ tier, quantity })
  }
  if (wanted.size > 0) return { ok: false, error: 'Those tickets are no longer on sale.' }

  const subtotal = lines.reduce((sum, line) => sum + line.tier.price * line.quantity, 0)
  const fee = serviceFee(subtotal)
  return { ok: true, order: { lines, count, subtotal, fee, total: subtotal + fee } }
}

export function isTicketId(value: unknown): value is string {
  return typeof value === 'string' && value.length === TICKET_ID_LENGTH && BASE64URL_ID.test(value)
}

export function codeCounter(nowMs: number): number {
  return Math.floor(nowMs / CODE_PERIOD_MS)
}

/** Milliseconds until the code on screen changes. */
export function codeRemainingMs(nowMs: number): number {
  return CODE_PERIOD_MS - (((nowMs % CODE_PERIOD_MS) + CODE_PERIOD_MS) % CODE_PERIOD_MS)
}

/** The string the per-ticket key is derived from, under the server's master key. */
export function keyMessage(ticketId: string, keyVersion: number): string {
  return `cf-ticket-key|v1|${ticketId}|${keyVersion}`
}

/** The string each rotating code signs, under the per-ticket key. */
export function codeMessage(ticketId: string, counter: number): string {
  return `${PAYLOAD_VERSION}|${ticketId}|${counter}`
}

export function formatPayload(ticketId: string, counter: number, mac: string): string {
  return `${PAYLOAD_VERSION}.${ticketId}.${counter}.${mac}`
}

export type ParsedPayload = { ticketId: string; counter: number; mac: string }

export function parsePayload(value: unknown): ParsedPayload | null {
  if (typeof value !== 'string' || value.length > 80) return null
  const match = PAYLOAD_PATTERN.exec(value)
  if (!match) return null
  const counter = Number(match[2])
  if (!Number.isSafeInteger(counter)) return null
  return { ticketId: match[1], counter, mac: match[3] }
}

/** Whether a code's period is close enough to the server's. Older means a screenshot or a stale screen. */
export function counterFresh(counter: number, nowMs: number): boolean {
  return Math.abs(codeCounter(nowMs) - counter) <= CODE_SKEW_PERIODS
}

export function scanWindow(startsAt: string, endsAt: string, nowMs: number): 'open' | 'not_open' | 'closed' {
  const start = Date.parse(startsAt)
  const end = Date.parse(endsAt)
  if (nowMs < start - SCAN_OPENS_BEFORE_MS) return 'not_open'
  if (nowMs >= end) return 'closed'
  return 'open'
}

export function bytesToBase64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64urlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function makeTier(
  eventId: string,
  kind: TicketKind,
  name: string,
  note: string,
  price: number,
  capacity: number,
): TicketTier {
  return { id: `${eventId}:${kind}`, eventId, kind, name, note, price, currency: 'EUR', capacity }
}

function between(seed: string, min: number, max: number): number {
  return min + (hash(seed) % (max - min + 1))
}

function hash(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
