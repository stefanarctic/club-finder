import { describe, expect, it } from 'vitest'
import {
  emptyTicketStore,
  issuePasses,
  parseTicketStore,
  passPile,
  readTicketStore,
  serviceFee,
  tiersFor,
  writeTicketStore,
  type Pass,
  type PurchaseEvent,
} from './tickets'

const event: PurchaseEvent = {
  id: 'night',
  name: 'Night',
  image: '',
  currency: 'EUR',
  averagePrice: 40,
  startsAt: '2026-11-28T21:00:00.000Z',
  endsAt: '2026-11-29T04:00:00.000Z',
  venueName: 'Control',
  address: 'Strada X',
  latitude: 44.4,
  longitude: 26.1,
}

const pass: Pass = {
  id: 'pass_1',
  code: 'N4K-82F',
  orderId: 'order_1',
  orderCode: 'K7M-2QP',
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
  tierName: 'General admission',
  price: 40,
  currency: 'EUR',
  fee: 4,
  orderCount: 1,
  buyerName: 'Ada',
  buyerEmail: 'ada@night.test',
  purchasedAt: '2026-11-24T18:00:00.000Z',
  usedAt: null,
}

describe('tiersFor', () => {
  it('prices a paid night as early, general, and late', () => {
    const tiers = tiersFor({ id: 'alpha', averagePrice: 40, currency: 'EUR' })
    expect(tiers.map((tier) => tier.name)).toEqual(['Before midnight', 'General admission', 'Late entry'])
    expect(tiers.map((tier) => tier.price)).toEqual([32, 40, 60])
    expect(tiers.map((tier) => tier.note)).toEqual(['In before 00:00', 'Standard entry', 'After 01:00'])
    expect(tiersFor({ id: 'alpha', averagePrice: 40, currency: 'EUR' })).toEqual(tiers)
    expect(tiers[0].capacity).toBeGreaterThanOrEqual(24)
    expect(tiers[0].capacity).toBeLessThanOrEqual(60)
    expect(tiers[1].capacity).toBeGreaterThanOrEqual(80)
    expect(tiers[2].capacity).toBeLessThanOrEqual(40)
  })

  it('drops a tier that rounds to the same price', () => {
    expect(tiersFor({ id: 'small', averagePrice: 2, currency: 'EUR' }).map((tier) => tier.price)).toEqual([2, 3])
  })

  it('offers one free tier when entry is free', () => {
    const tiers = tiersFor({ id: 'open', averagePrice: 0, currency: 'EUR' })
    expect(tiers).toHaveLength(1)
    expect(tiers[0]).toMatchObject({ name: 'Free entry', price: 0, kind: 'free' })
  })
})

describe('serviceFee', () => {
  it('charges 10 percent, at least 1 euro, and nothing on a free night', () => {
    expect(serviceFee(40)).toBe(4)
    expect(serviceFee(64)).toBe(6)
    expect(serviceFee(4)).toBe(1)
    expect(serviceFee(14)).toBe(1)
    expect(serviceFee(15)).toBe(2)
    expect(serviceFee(0)).toBe(0)
  })
})

describe('issuePasses', () => {
  it('issues one pass per admission and refuses a sold-out tier', () => {
    const early = tiersFor(event)[0]
    const issued = issuePasses(emptyTicketStore(), {
      event,
      lines: [{ tierId: early.id, quantity: 2 }],
      buyerName: 'Ada',
      buyerEmail: 'ada@night.test',
    })
    expect(issued.ok).toBe(true)
    if (!issued.ok) return
    expect(issued.passes).toHaveLength(2)
    expect(issued.passes[0]).toMatchObject({ price: 32, fee: 6, orderCount: 2, tierName: 'Before midnight' })
    expect(issued.passes[0].code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{3}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{3}$/)
    expect(new Set(issued.passes.map((item) => item.code)).size).toBe(2)
    expect(issued.passes[0].orderId).toBe(issued.passes[1].orderId)
    expect(issued.store.sold[early.id]).toBe(2)

    const soldOut = issuePasses(
      { sold: { [early.id]: early.capacity }, passes: [] },
      { event, lines: [{ tierId: early.id, quantity: 1 }], buyerName: 'Ada', buyerEmail: 'ada@night.test' },
    )
    expect(soldOut).toEqual({ ok: false, error: 'Those tickets just sold out.' })
  })

  it('caps an order at 8 and checks the buyer', () => {
    const general = tiersFor(event)[1]
    expect(
      issuePasses(emptyTicketStore(), {
        event,
        lines: [{ tierId: general.id, quantity: 9 }],
        buyerName: 'Ada',
        buyerEmail: 'ada@night.test',
      }),
    ).toEqual({ ok: false, error: 'You can take up to 8 passes at once.' })
    expect(
      issuePasses(emptyTicketStore(), {
        event,
        lines: [{ tierId: general.id, quantity: 1 }],
        buyerName: ' ',
        buyerEmail: 'ada@night.test',
      }).ok,
    ).toBe(false)
  })
})

describe('passPile', () => {
  const during = new Date('2026-11-24T20:00:00.000Z')

  it('keeps a stamped pass out of past until the night ends', () => {
    expect(passPile(pass, during)).toBe('upcoming')
    expect(passPile({ ...pass, usedAt: '2026-11-24T19:00:00.000Z' }, during)).toBe('used')
    expect(passPile({ ...pass, usedAt: '2026-11-24T19:00:00.000Z' }, new Date('2026-11-25T05:00:00.000Z'))).toBe('past')
  })
})

describe('readTicketStore', () => {
  it('keeps a valid wallet and drops a broken pass', () => {
    const parsed = parseTicketStore({
      sold: { 'event_1:general': 2, bad: 0, later: 1.5 },
      passes: [pass, { id: 'nope' }],
    })
    expect(parsed.passes).toEqual([pass])
    expect(parsed.sold).toEqual({ 'event_1:general': 2 })

    const storage = memory()
    writeTicketStore(parsed, storage)
    expect(readTicketStore(storage)).toEqual(parsed)
    storage.setItem('club-finder:tickets:v1', '{')
    expect(readTicketStore(storage)).toEqual(emptyTicketStore())
  })
})

function memory() {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
  }
}
