import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore, type DocumentData } from 'firebase-admin/firestore'
import { defineSecret } from 'firebase-functions/params'
import { setGlobalOptions } from 'firebase-functions/v2'
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https'
import {
  FUNCTIONS_REGION,
  MAX_PASSES_PER_EVENT,
  isTicketId,
  parsePayload,
  planOrder,
  scanWindow,
  tierRemaining,
  tiersFor,
  type EventStock,
  type RedeemReason,
  type RedeemResult,
  type TicketKind,
  type TierStock,
} from '../../shared/ticketing'
import { checkCode, deriveTicketKey, newTicketId, orderIdFor, parseMasterKey } from './crypto'
import { isEventId, parseSaleEvent, type SaleEvent } from './events'

initializeApp()
setGlobalOptions({ region: FUNCTIONS_REGION, maxInstances: 10 })

const db = getFirestore()
const TICKET_HMAC_KEY = defineSecret('TICKET_HMAC_KEY')

/** The emulator has no App Check attestation. Deployed functions always enforce it. */
const callable = { enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true' }
const withKey = { ...callable, secrets: [TICKET_HMAC_KEY] }

const REQUEST_ID = /^[A-Za-z0-9-]{16,64}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** Keys stay available a while after the snapshot end, in case the night was moved later. */
const KEY_GRACE_MS = 48 * 60 * 60 * 1000
/** Off while testing so a pass scans outside the night. Turn back on before a real door. */
const ENFORCE_SCAN_WINDOW = false

let cachedMaster: { source: string; key: Buffer } | null = null

function masterKey(): Buffer {
  const source = TICKET_HMAC_KEY.value()
  if (cachedMaster?.source !== source) cachedMaster = { source, key: parseMasterKey(source) }
  return cachedMaster.key
}

function requireUid(request: CallableRequest): string {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.')
  return request.auth.uid
}

function input(request: CallableRequest): Record<string, unknown> {
  const data: unknown = request.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpsError('invalid-argument', 'Bad request.')
  return data as Record<string, unknown>
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function keyVersionOf(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 1
}

const KINDS: TicketKind[] = ['early', 'general', 'late', 'free']

function readStock(data: DocumentData | undefined): EventStock {
  const tiers: EventStock['tiers'] = {}
  const raw = data?.tiers && typeof data.tiers === 'object' ? (data.tiers as Record<string, unknown>) : {}
  for (const kind of KINDS) {
    const entry = raw[kind] as Partial<TierStock> | undefined
    if (entry && typeof entry.capacity === 'number' && typeof entry.sold === 'number') {
      tiers[kind] = { capacity: entry.capacity, sold: entry.sold }
    }
  }
  return { tiers, used: typeof data?.used === 'number' ? data.used : 0 }
}

/** Admins, and the organizer who created the night while they still hold the role. */
function ownsEvent(uid: string, role: unknown, event: SaleEvent): boolean {
  if (role === 'admin') return true
  return role === 'organizer' && event.createdBy === uid
}

async function loadEventFor(uid: string, eventId: string) {
  const eventRef = db.collection('events').doc(eventId)
  const [eventSnap, userSnap, staffSnap] = await db.getAll(
    eventRef,
    db.collection('users').doc(uid),
    eventRef.collection('staff').doc(uid),
  )
  const event = eventSnap.exists ? parseSaleEvent(eventSnap.id, eventSnap.data()) : null
  if (!event) throw new HttpsError('not-found', 'That night does not exist.')
  const owner = ownsEvent(uid, userSnap.get('role'), event)
  return { eventRef, event, owner, staff: staffSnap.exists }
}

export const issueTickets = onCall(callable, async (request) => {
  const uid = requireUid(request)
  const { eventId, requestId, lines } = input(request)
  if (!isEventId(eventId)) throw new HttpsError('invalid-argument', 'That night is not on sale.')
  if (typeof requestId !== 'string' || !REQUEST_ID.test(requestId)) throw new HttpsError('invalid-argument', 'Try again.')
  const email = text(request.auth?.token.email)

  const orderRef = db.collection('orders').doc(orderIdFor(uid, requestId))
  const eventRef = db.collection('events').doc(eventId)
  const stockRef = db.collection('ticketStock').doc(eventId)
  const holderRef = db.collection('ticketHolders').doc(`${eventId}_${uid}`)
  const userRef = db.collection('users').doc(uid)

  return db.runTransaction(async (tx) => {
    const [orderSnap, eventSnap, stockSnap, holderSnap, userSnap] = await tx.getAll(orderRef, eventRef, stockRef, holderRef, userRef)

    if (orderSnap.exists) {
      if (orderSnap.get('uid') !== uid) throw new HttpsError('permission-denied', 'Try again.')
      return { orderId: orderRef.id, ticketIds: orderSnap.get('ticketIds') as string[] }
    }

    const event = eventSnap.exists ? parseSaleEvent(eventSnap.id, eventSnap.data()) : null
    if (!event) throw new HttpsError('not-found', 'That night is not on sale.')
    const now = Date.now()
    if (now >= Date.parse(event.endsAt)) throw new HttpsError('failed-precondition', 'Sales for this night have closed.')

    const planned = planOrder(tiersFor(event), lines)
    if (!planned.ok) throw new HttpsError('invalid-argument', planned.error)
    const { order } = planned

    const held = holderSnap.exists ? Number(holderSnap.get('count')) || 0 : 0
    if (held + order.count > MAX_PASSES_PER_EVENT) {
      const left = Math.max(0, MAX_PASSES_PER_EVENT - held)
      throw new HttpsError(
        'resource-exhausted',
        left === 0
          ? `You already hold ${MAX_PASSES_PER_EVENT} passes for this night.`
          : `You can take ${left} more ${left === 1 ? 'pass' : 'passes'} for this night.`,
      )
    }

    const stock = readStock(stockSnap.data())
    for (const line of order.lines) {
      if (line.quantity > tierRemaining(line.tier, stock)) throw new HttpsError('resource-exhausted', 'Those tickets just sold out.')
    }

    const buyerName = text(userSnap.get('displayName')) || email || 'Guest'
    const createdAt = new Date(now).toISOString()
    const ticketIds: string[] = []
    const tiers = { ...stock.tiers }

    for (const line of order.lines) {
      const entry = tiers[line.tier.kind] ?? { capacity: line.tier.capacity, sold: 0 }
      tiers[line.tier.kind] = { capacity: entry.capacity, sold: entry.sold + line.quantity }
      for (let index = 0; index < line.quantity; index++) {
        const id = newTicketId()
        ticketIds.push(id)
        tx.create(db.collection('tickets').doc(id), {
          uid,
          orderId: orderRef.id,
          eventId: event.id,
          eventName: event.name,
          venueName: event.venueName,
          address: event.address,
          latitude: event.latitude,
          longitude: event.longitude,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          image: event.image,
          tierId: line.tier.id,
          tierKind: line.tier.kind,
          tierName: line.tier.name,
          price: line.tier.price,
          currency: 'EUR',
          fee: order.fee,
          orderCount: order.count,
          buyerName,
          buyerEmail: email,
          status: 'valid',
          keyVersion: 1,
          usedAt: null,
          usedBy: null,
          createdAt,
        })
      }
    }

    tx.create(orderRef, {
      uid,
      eventId: event.id,
      requestId,
      lines: order.lines.map((line) => ({ tierId: line.tier.id, tierName: line.tier.name, price: line.tier.price, quantity: line.quantity })),
      subtotal: order.subtotal,
      fee: order.fee,
      total: order.total,
      currency: 'EUR',
      ticketIds,
      createdAt,
    })
    tx.set(stockRef, { tiers }, { merge: true })
    tx.set(holderRef, { eventId: event.id, uid, count: held + order.count })

    return { orderId: orderRef.id, ticketIds }
  })
})

export const getTicketKeys = onCall(withKey, async (request) => {
  const uid = requireUid(request)
  const now = Date.now()
  const snap = await db.collection('tickets').where('uid', '==', uid).where('status', '==', 'valid').limit(200).get()
  const master = masterKey()
  const keys = snap.docs
    .filter((doc) => Date.parse(text(doc.get('endsAt'))) + KEY_GRACE_MS > now)
    .map((doc) => {
      const keyVersion = keyVersionOf(doc.get('keyVersion'))
      return { ticketId: doc.id, keyVersion, key: deriveTicketKey(master, doc.id, keyVersion).toString('base64url') }
    })
  return { serverTime: now, keys }
})

export const resetTicketKey = onCall(withKey, async (request) => {
  const uid = requireUid(request)
  const { ticketId } = input(request)
  if (!isTicketId(ticketId)) throw new HttpsError('not-found', 'That pass is not on this account.')
  const ref = db.collection('tickets').doc(ticketId)
  const keyVersion = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists || snap.get('uid') !== uid) throw new HttpsError('not-found', 'That pass is not on this account.')
    if (snap.get('status') !== 'valid') throw new HttpsError('failed-precondition', 'That pass has already been used.')
    const next = keyVersionOf(snap.get('keyVersion')) + 1
    tx.update(ref, { keyVersion: next })
    return next
  })
  return { serverTime: Date.now(), ticketId, keyVersion, key: deriveTicketKey(masterKey(), ticketId, keyVersion).toString('base64url') }
})

export const redeemTicket = onCall(withKey, async (request): Promise<RedeemResult> => {
  const uid = requireUid(request)
  const { eventId, payload } = input(request)
  if (!isEventId(eventId)) throw new HttpsError('invalid-argument', 'Pick a night to scan for.')
  const { eventRef, event, owner, staff } = await loadEventFor(uid, eventId)
  if (!owner && !staff) throw new HttpsError('permission-denied', 'You can’t scan tickets for this night.')

  const scans = eventRef.collection('scans')
  const parsed = parsePayload(payload)
  if (!parsed) {
    await scans.add({ ticketId: null, scannerUid: uid, result: 'bad_format', at: FieldValue.serverTimestamp() })
    return { result: 'bad_format' }
  }

  const master = masterKey()
  const ticketRef = db.collection('tickets').doc(parsed.ticketId)
  const stockRef = db.collection('ticketStock').doc(eventId)

  const outcome = await db.runTransaction(async (tx) => {
    const now = Date.now()
    const snap = await tx.get(ticketRef)
    const scanRef = scans.doc()
    const log = (result: RedeemReason, extra: Omit<RedeemResult, 'result'> & { usedBy?: string } = {}) => {
      tx.create(scanRef, { ticketId: parsed.ticketId, scannerUid: uid, result, at: FieldValue.serverTimestamp() })
      return { result, ...extra }
    }

    if (!snap.exists) return log('not_found')
    const check = checkCode(master, { id: snap.id, keyVersion: keyVersionOf(snap.get('keyVersion')) }, parsed, now)
    if (check !== 'ok') return log(check)
    if (snap.get('eventId') !== eventId) return log('wrong_event')
    if (ENFORCE_SCAN_WINDOW) {
      const window = scanWindow(event.startsAt, event.endsAt, now)
      if (window !== 'open') return log(window)
    }

    const tierName = text(snap.get('tierName'))
    const buyerName = text(snap.get('buyerName'))
    const status = snap.get('status')
    if (status === 'used') {
      return log('already_used', { tierName, buyerName, usedAt: text(snap.get('usedAt')), usedBy: text(snap.get('usedBy')) })
    }
    if (status !== 'valid') return log('not_found')

    tx.update(ticketRef, { status: 'used', usedAt: new Date(now).toISOString(), usedBy: uid })
    tx.set(stockRef, { used: FieldValue.increment(1) }, { merge: true })
    return log('accepted', { tierName, buyerName })
  })

  const { usedBy, ...result } = outcome
  if (usedBy) {
    const scanner = await db.collection('users').doc(usedBy).get()
    result.usedByName = text(scanner.get('displayName')) || 'door staff'
  }
  return result
})

export const setDoorStaff = onCall(callable, async (request) => {
  const uid = requireUid(request)
  const { eventId, email: rawEmail, add } = input(request)
  if (!isEventId(eventId)) throw new HttpsError('invalid-argument', 'Pick a night first.')
  const email = text(rawEmail).toLowerCase()
  if (email.length > 254 || !EMAIL.test(email)) throw new HttpsError('invalid-argument', 'Enter a valid email.')
  const { eventRef, owner } = await loadEventFor(uid, eventId)
  if (!owner) throw new HttpsError('permission-denied', 'Only the organizer can change the door list.')

  let staffUser
  try {
    staffUser = await getAuth().getUserByEmail(email)
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String((error as { code: unknown }).code) : ''
    if (code === 'auth/user-not-found') throw new HttpsError('not-found', 'No account uses that email.')
    throw error
  }

  const ref = eventRef.collection('staff').doc(staffUser.uid)
  if (add === true) {
    const profile = await db.collection('users').doc(staffUser.uid).get()
    await ref.set({
      uid: staffUser.uid,
      email,
      displayName: text(profile.get('displayName')) || staffUser.displayName || email,
      addedBy: uid,
      addedAt: new Date().toISOString(),
    })
  } else {
    await ref.delete()
  }
  return { ok: true }
})
