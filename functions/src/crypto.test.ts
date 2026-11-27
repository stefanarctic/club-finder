import { describe, expect, it } from 'vitest'
import { CODE_PERIOD_MS, formatPayload, isTicketId, parsePayload } from '../../shared/ticketing'
import { checkCode, codeMac, deriveTicketKey, newTicketId, orderIdFor, parseMasterKey } from './crypto'

const MASTER = parseMasterKey('BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=')
const ID = 'AAECAwQFBgcICQoLDA0ODw'
const COUNTER = 60_000_000
const AT = COUNTER * CODE_PERIOD_MS + 5_000

function payloadFor(id: string, keyVersion: number, counter: number) {
  const parsed = parsePayload(formatPayload(id, counter, codeMac(deriveTicketKey(MASTER, id, keyVersion), id, counter)))
  if (!parsed) throw new Error('unparsable payload')
  return parsed
}

describe('ticket ids', () => {
  it('are 16 random bytes in base64url', () => {
    const ids = new Set(Array.from({ length: 1000 }, newTicketId))
    expect(ids.size).toBe(1000)
    for (const id of ids) {
      expect(isTicketId(id)).toBe(true)
      expect(Buffer.from(id, 'base64url')).toHaveLength(16)
    }
  })

  it('derive the same order id for a retried request only', () => {
    expect(orderIdFor('uid1', 'req')).toBe(orderIdFor('uid1', 'req'))
    expect(orderIdFor('uid1', 'req')).not.toBe(orderIdFor('uid2', 'req'))
    expect(orderIdFor('uid1', 'req')).not.toBe(orderIdFor('uid1', 'req2'))
  })
})

describe('parseMasterKey', () => {
  it('refuses a short secret', () => {
    expect(() => parseMasterKey(Buffer.alloc(16).toString('base64'))).toThrow()
    expect(() => parseMasterKey('')).toThrow()
  })
})

describe('key derivation', () => {
  it('matches the fixed vectors the browser test also checks', () => {
    const key = deriveTicketKey(MASTER, ID, 1)
    expect(key.toString('base64url')).toBe('_KgmmFVPFJGswZ-5uSsxAv2VFYW8qOWH13s0dWSU3jI')
    expect(codeMac(key, ID, COUNTER)).toBe('868EXQ7ERErjFek9wIleCw')
  })

  it('changes with the key version', () => {
    expect(deriveTicketKey(MASTER, ID, 2).equals(deriveTicketKey(MASTER, ID, 1))).toBe(false)
  })
})

describe('checkCode', () => {
  const ticket = { id: ID, keyVersion: 1 }

  it('accepts the current period and one either side', () => {
    expect(checkCode(MASTER, ticket, payloadFor(ID, 1, COUNTER), AT)).toBe('ok')
    expect(checkCode(MASTER, ticket, payloadFor(ID, 1, COUNTER - 1), AT)).toBe('ok')
    expect(checkCode(MASTER, ticket, payloadFor(ID, 1, COUNTER + 1), AT)).toBe('ok')
  })

  it('calls a genuine but old code expired', () => {
    expect(checkCode(MASTER, ticket, payloadFor(ID, 1, COUNTER - 2), AT)).toBe('expired_code')
    expect(checkCode(MASTER, ticket, payloadFor(ID, 1, COUNTER + 5), AT)).toBe('expired_code')
  })

  it('rejects a reset key, a tampered mac, a moved counter, and another ticket', () => {
    expect(checkCode(MASTER, { id: ID, keyVersion: 2 }, payloadFor(ID, 1, COUNTER), AT)).toBe('bad_signature')

    const good = payloadFor(ID, 1, COUNTER)
    const flipped = good.mac[0] === 'A' ? `B${good.mac.slice(1)}` : `A${good.mac.slice(1)}`
    expect(checkCode(MASTER, ticket, { ...good, mac: flipped }, AT)).toBe('bad_signature')
    expect(checkCode(MASTER, ticket, { ...good, counter: COUNTER + 1 }, AT)).toBe('bad_signature')

    const other = newTicketId()
    expect(checkCode(MASTER, ticket, payloadFor(other, 1, COUNTER), AT)).toBe('bad_signature')

    const otherMaster = parseMasterKey(Buffer.alloc(32, 9).toString('base64'))
    expect(checkCode(otherMaster, ticket, good, AT)).toBe('bad_signature')
  })
})
