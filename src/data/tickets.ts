/**
 * Guest passes kept in this browser. Nothing here charges a card or writes to the database.
 * Tiers are derived from an event's average price so a night can be bought without organizer tools.
 */

export const MAX_PASSES_PER_ORDER = 8

export const REFUND_RULE =
  'Refundable until 24 hours before the start. After that the pass stays valid for entry.'

const STORAGE_KEY = 'club-finder:tickets:v1'

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

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

export type AvailableTier = TicketTier & { remaining: number }

export type PurchaseEvent = {
  id: string
  name: string
  image: string
  currency: 'EUR'
  averagePrice: number
  startsAt: string
  endsAt: string
  venueName: string
  address: string
  latitude: number
  longitude: number
}

export type PurchaseInput = {
  event: PurchaseEvent
  lines: { tierId: string; quantity: number }[]
  buyerName: string
  buyerEmail: string
}

export type Pass = {
  id: string
  code: string
  orderId: string
  orderCode: string
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
  usedAt: string | null
}

export type TicketStore = {
  sold: Record<string, number>
  passes: Pass[]
}

export type PassPile = 'upcoming' | 'used' | 'past'

type KeyValue = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function emptyTicketStore(): TicketStore {
  return { sold: {}, passes: [] }
}

export function formatPrice(amount: number, currency: 'EUR' = 'EUR'): string {
  if (amount === 0) return 'Free'
  return `${amount} ${currency}`
}

/** 10% of the subtotal, rounded to a whole euro, at least 1 EUR. Free nights pay nothing. */
export function serviceFee(subtotal: number): number {
  if (!(subtotal > 0)) return 0
  return Math.max(1, Math.round(subtotal * 0.1))
}

export function buyerError(name: string, email: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return 'Add your name.'
  if (trimmed.length > 80) return 'That name is too long.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Add a valid email.'
  return null
}

export function tiersFor(event: { id: string; averagePrice: number; currency: 'EUR' }): TicketTier[] {
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

export function tierRemaining(tier: TicketTier, sold: Record<string, number>): number {
  return Math.max(0, tier.capacity - (sold[tier.id] ?? 0))
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

export type IssueResult = { ok: true; passes: Pass[]; store: TicketStore } | { ok: false; error: string }

export function issuePasses(store: TicketStore, input: PurchaseInput, now = new Date()): IssueResult {
  const who = buyerError(input.buyerName, input.buyerEmail)
  if (who) return { ok: false, error: who }
  if (Number.isNaN(Date.parse(input.event.startsAt)) || Number.isNaN(Date.parse(input.event.endsAt))) {
    return { ok: false, error: 'That night has no start time.' }
  }
  if (!Number.isFinite(input.event.latitude) || !Number.isFinite(input.event.longitude)) {
    return { ok: false, error: 'That night has no address.' }
  }

  const tiers = tiersFor(input.event)
  const wanted = new Map<string, number>()
  for (const line of input.lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 0) return { ok: false, error: 'Choose at least one pass.' }
    if (line.quantity === 0) continue
    wanted.set(line.tierId, (wanted.get(line.tierId) ?? 0) + line.quantity)
  }

  const count = [...wanted.values()].reduce((sum, quantity) => sum + quantity, 0)
  if (count === 0) return { ok: false, error: 'Choose at least one pass.' }
  if (count > MAX_PASSES_PER_ORDER) return { ok: false, error: 'You can take up to 8 passes at once.' }

  const lines: { tier: TicketTier; quantity: number }[] = []
  for (const tier of tiers) {
    const quantity = wanted.get(tier.id)
    if (!quantity) continue
    wanted.delete(tier.id)
    if (quantity > tierRemaining(tier, store.sold)) return { ok: false, error: 'Those tickets just sold out.' }
    lines.push({ tier, quantity })
  }
  if (wanted.size > 0) return { ok: false, error: 'Those tickets are no longer on sale.' }

  const subtotal = lines.reduce((sum, line) => sum + line.tier.price * line.quantity, 0)
  const fee = serviceFee(subtotal)
  const orderId = createId('order')
  const orderCode = admissionCode(orderId)
  const purchasedAt = now.toISOString()
  const buyerName = input.buyerName.trim()
  const buyerEmail = input.buyerEmail.trim()
  const passes: Pass[] = []

  for (const line of lines) {
    for (let index = 0; index < line.quantity; index++) {
      const id = createId('pass')
      passes.push({
        id,
        code: admissionCode(id),
        orderId,
        orderCode,
        eventId: input.event.id,
        eventName: input.event.name,
        venueName: input.event.venueName,
        address: input.event.address,
        latitude: input.event.latitude,
        longitude: input.event.longitude,
        startsAt: input.event.startsAt,
        endsAt: input.event.endsAt,
        image: input.event.image,
        tierId: line.tier.id,
        tierName: line.tier.name,
        price: line.tier.price,
        currency: 'EUR',
        fee,
        orderCount: count,
        buyerName,
        buyerEmail,
        purchasedAt,
        usedAt: null,
      })
    }
  }

  const sold = { ...store.sold }
  for (const line of lines) sold[line.tier.id] = (sold[line.tier.id] ?? 0) + line.quantity

  return { ok: true, passes, store: { sold, passes: [...store.passes, ...passes] } }
}

/** Ended nights are past, even if stamped. Used is only a night that has not ended. */
export function passPile(pass: Pass, now: Date): PassPile {
  if (new Date(pass.endsAt).getTime() <= now.getTime()) return 'past'
  if (pass.usedAt) return 'used'
  return 'upcoming'
}

export function parseTicketStore(value: unknown): TicketStore {
  if (!value || typeof value !== 'object') return emptyTicketStore()
  const raw = value as { sold?: unknown; passes?: unknown }
  return { sold: parseSold(raw.sold), passes: Array.isArray(raw.passes) ? raw.passes.filter(isPass) : [] }
}

export function readTicketStore(storage: Pick<KeyValue, 'getItem'> | null = browserStorage()): TicketStore {
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    if (!raw) return emptyTicketStore()
    return parseTicketStore(JSON.parse(raw))
  } catch {
    return emptyTicketStore()
  }
}

export function writeTicketStore(store: TicketStore, storage: KeyValue | null = browserStorage()): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Private mode, or a full disk. The in-memory wallet still works for this view.
  }
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

function admissionCode(seed: string): string {
  let h = hash(seed)
  let out = ''
  for (let i = 0; i < 6; i++) {
    out += CODE_ALPHABET[h % CODE_ALPHABET.length]
    h = Math.imul(h ^ (i + 1), 16777619) >>> 0
  }
  return `${out.slice(0, 3)}-${out.slice(3)}`
}

function createId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return `${prefix}_${uuid}`
  return `${prefix}_${hash(`${Math.random()}:${Date.now()}`).toString(36)}`
}

function parseSold(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {}
  const sold: Record<string, number> = {}
  for (const [key, count] of Object.entries(value)) {
    if (typeof count === 'number' && Number.isInteger(count) && count > 0) sold[key] = count
  }
  return sold
}

function isPass(value: unknown): value is Pass {
  if (!value || typeof value !== 'object') return false
  const pass = value as Partial<Pass>
  return (
    nonEmpty(pass.id) &&
    nonEmpty(pass.code) &&
    nonEmpty(pass.orderId) &&
    nonEmpty(pass.orderCode) &&
    nonEmpty(pass.eventId) &&
    nonEmpty(pass.eventName) &&
    nonEmpty(pass.venueName) &&
    typeof pass.address === 'string' &&
    typeof pass.latitude === 'number' &&
    pass.latitude >= -90 &&
    pass.latitude <= 90 &&
    typeof pass.longitude === 'number' &&
    pass.longitude >= -180 &&
    pass.longitude <= 180 &&
    isInstant(pass.startsAt) &&
    isInstant(pass.endsAt) &&
    typeof pass.image === 'string' &&
    nonEmpty(pass.tierId) &&
    nonEmpty(pass.tierName) &&
    typeof pass.price === 'number' &&
    pass.price >= 0 &&
    pass.currency === 'EUR' &&
    typeof pass.fee === 'number' &&
    pass.fee >= 0 &&
    typeof pass.orderCount === 'number' &&
    Number.isInteger(pass.orderCount) &&
    pass.orderCount > 0 &&
    nonEmpty(pass.buyerName) &&
    nonEmpty(pass.buyerEmail) &&
    isInstant(pass.purchasedAt) &&
    (pass.usedAt === null || isInstant(pass.usedAt))
  )
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isInstant(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function browserStorage(): KeyValue | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}
