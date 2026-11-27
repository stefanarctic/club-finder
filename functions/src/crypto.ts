import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { MAC_BYTES, codeMessage, counterFresh, keyMessage, type ParsedPayload } from '../../shared/ticketing'

const MIN_MASTER_BYTES = 32

/** 128 random bits, base64url without padding (22 characters). */
export function newTicketId(): string {
  return randomBytes(16).toString('base64url')
}

/** The same request from the same account always lands on the same order, so a retry cannot buy twice. */
export function orderIdFor(uid: string, requestId: string): string {
  return createHash('sha256').update(`cf-order|${uid}|${requestId}`).digest('base64url')
}

/** The secret is stored base64-encoded. Anything shorter than 32 bytes is refused rather than used weakly. */
export function parseMasterKey(secret: string): Buffer {
  const key = Buffer.from(secret.trim(), 'base64')
  if (key.length < MIN_MASTER_BYTES) throw new Error('TICKET_HMAC_KEY must be at least 32 random bytes, base64-encoded.')
  return key
}

export function deriveTicketKey(master: Buffer, ticketId: string, keyVersion: number): Buffer {
  return createHmac('sha256', master).update(keyMessage(ticketId, keyVersion)).digest()
}

export function codeMac(ticketKey: Buffer, ticketId: string, counter: number): string {
  return createHmac('sha256', ticketKey).update(codeMessage(ticketId, counter)).digest().subarray(0, MAC_BYTES).toString('base64url')
}

export type CodeCheck = 'ok' | 'bad_signature' | 'expired_code'

/** Signature first, in constant time. Only a genuine code learns whether it was merely stale. */
export function checkCode(
  master: Buffer,
  ticket: { id: string; keyVersion: number },
  payload: ParsedPayload,
  nowMs: number,
): CodeCheck {
  if (payload.ticketId !== ticket.id) return 'bad_signature'
  const expected = Buffer.from(codeMac(deriveTicketKey(master, ticket.id, ticket.keyVersion), ticket.id, payload.counter))
  const given = Buffer.from(payload.mac)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return 'bad_signature'
  return counterFresh(payload.counter, nowMs) ? 'ok' : 'expired_code'
}
