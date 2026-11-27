import { describe, expect, it } from 'vitest'
import { parsePass, parseStock, passPile, passRef, type Pass } from './tickets'

const ID = 'AAECAwQFBgcICQoLDA0ODw'

const doc = {
  uid: 'u1',
  orderId: 'order_1',
  eventId: 'event_1',
  eventName: 'Basement',
  venueName: 'Control',
  address: 'Strada X',
  latitude: 44.4,
  longitude: 26.1,
  startsAt: '2026-11-24T21:00:00.000Z',
  endsAt: '2026-11-25T04:00:00.000Z',
  image: '',
  tierId: 'event_1:general',
  tierKind: 'general',
  tierName: 'General admission',
  price: 40,
  currency: 'EUR',
  fee: 4,
  orderCount: 1,
  buyerName: 'Ada',
  buyerEmail: 'ada@night.test',
  status: 'valid',
  keyVersion: 1,
  usedAt: null,
  usedBy: null,
  createdAt: '2026-11-24T18:00:00.000Z',
}

describe('parsePass', () => {
  it('reads a ticket document', () => {
    const pass = parsePass(ID, doc)
    expect(pass).toMatchObject({ id: ID, status: 'valid', usedAt: null, purchasedAt: doc.createdAt, keyVersion: 1 })
  })

  it('drops a document with a bad id, status, or missing fields', () => {
    expect(parsePass('short', doc)).toBeNull()
    expect(parsePass(ID, { ...doc, status: 'void' })).toBeNull()
    expect(parsePass(ID, { ...doc, eventName: '' })).toBeNull()
    expect(parsePass(ID, { ...doc, keyVersion: 0 })).toBeNull()
    expect(parsePass(ID, null)).toBeNull()
  })

  it('keeps usedAt only on a used pass', () => {
    expect(parsePass(ID, { ...doc, usedAt: '2026-11-24T22:00:00.000Z' })?.usedAt).toBeNull()
    expect(parsePass(ID, { ...doc, status: 'used', usedAt: '2026-11-24T22:00:00.000Z' })?.usedAt).toBe('2026-11-24T22:00:00.000Z')
  })
})

describe('passPile', () => {
  const pass = parsePass(ID, doc) as Pass
  const during = new Date('2026-11-24T20:00:00.000Z')

  it('keeps a stamped pass out of past until the night ends', () => {
    expect(passPile(pass, during)).toBe('upcoming')
    expect(passPile({ ...pass, status: 'used' }, during)).toBe('used')
    expect(passPile({ ...pass, status: 'used' }, new Date('2026-11-25T05:00:00.000Z'))).toBe('past')
  })
})

describe('parseStock', () => {
  it('keeps well-formed tiers only', () => {
    expect(parseStock({ tiers: { general: { capacity: 100, sold: 3 }, late: { capacity: 'x' }, bogus: { capacity: 1, sold: 0 } }, used: 2 })).toEqual({
      tiers: { general: { capacity: 100, sold: 3 } },
      used: 2,
    })
    expect(parseStock(undefined)).toEqual({ tiers: {}, used: 0 })
  })
})

describe('passRef', () => {
  it('shows the first eight characters', () => {
    expect(passRef(ID)).toBe('AAEC-AwQF')
  })
})
