import { describe, expect, it } from 'vitest'
import {
  CODE_PERIOD_MS,
  base64urlToBytes,
  bytesToBase64url,
  codeCounter,
  codeRemainingMs,
  counterFresh,
  formatPayload,
  isTicketId,
  parsePayload,
  planOrder,
  scanWindow,
  serviceFee,
  tierRemaining,
  tiersFor,
} from './ticketing'

const ID = 'AAECAwQFBgcICQoLDA0ODw'
const MAC = 'q83vEjRWeJCrze8SNFZ4kA'

describe('tiersFor', () => {
  it('prices a paid night as early, general, and late', () => {
    const tiers = tiersFor({ id: 'alpha', averagePrice: 40 })
    expect(tiers.map((tier) => tier.name)).toEqual(['Before midnight', 'General admission', 'Late entry'])
    expect(tiers.map((tier) => tier.price)).toEqual([32, 40, 60])
    expect(tiers.map((tier) => tier.note)).toEqual(['In before 00:00', 'Standard entry', 'After 01:00'])
    expect(tiersFor({ id: 'alpha', averagePrice: 40 })).toEqual(tiers)
    expect(tiers[0].capacity).toBeGreaterThanOrEqual(24)
    expect(tiers[0].capacity).toBeLessThanOrEqual(60)
    expect(tiers[1].capacity).toBeGreaterThanOrEqual(80)
    expect(tiers[2].capacity).toBeLessThanOrEqual(40)
  })

  it('drops a tier that rounds to the same price', () => {
    expect(tiersFor({ id: 'small', averagePrice: 2 }).map((tier) => tier.price)).toEqual([2, 3])
  })

  it('offers one free tier when entry is free', () => {
    const tiers = tiersFor({ id: 'open', averagePrice: 0 })
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

describe('tierRemaining', () => {
  it('uses the frozen capacity once a tier has sold', () => {
    const general = tiersFor({ id: 'alpha', averagePrice: 40 })[1]
    expect(tierRemaining(general, null)).toBe(general.capacity)
    expect(tierRemaining(general, { tiers: { general: { capacity: 10, sold: 4 } }, used: 0 })).toBe(6)
    expect(tierRemaining(general, { tiers: { general: { capacity: 10, sold: 12 } }, used: 0 })).toBe(0)
  })
})

describe('planOrder', () => {
  const tiers = tiersFor({ id: 'night', averagePrice: 40 })

  it('prices lines from the server tiers and merges repeats', () => {
    const planned = planOrder(tiers, [
      { tierId: 'night:early', quantity: 1, price: 0 },
      { tierId: 'night:early', quantity: 1 },
    ])
    expect(planned).toEqual({
      ok: true,
      order: { lines: [{ tier: tiers[0], quantity: 2 }], count: 2, subtotal: 64, fee: 6, total: 70 },
    })
  })

  it('refuses empty, oversized, fractional, and unknown lines', () => {
    expect(planOrder(tiers, []).ok).toBe(false)
    expect(planOrder(tiers, 'x').ok).toBe(false)
    expect(planOrder(tiers, [{ tierId: 'night:general', quantity: 0 }]).ok).toBe(false)
    expect(planOrder(tiers, [{ tierId: 'night:general', quantity: 1.5 }]).ok).toBe(false)
    expect(planOrder(tiers, [{ tierId: 'night:general', quantity: -1 }]).ok).toBe(false)
    expect(planOrder(tiers, [{ tierId: 'night:general', quantity: 9 }]).ok).toBe(false)
    expect(
      planOrder(tiers, [
        { tierId: 'night:general', quantity: 5 },
        { tierId: 'night:late', quantity: 4 },
      ]),
    ).toEqual({ ok: false, error: 'You can take up to 8 passes at once.' })
    expect(planOrder(tiers, [{ tierId: 'other:general', quantity: 1 }])).toEqual({
      ok: false,
      error: 'Those tickets are no longer on sale.',
    })
  })
})

describe('payload', () => {
  it('round-trips a well-formed code', () => {
    const text = formatPayload(ID, 12345, MAC)
    expect(text).toBe(`CF1.${ID}.12345.${MAC}`)
    expect(parsePayload(text)).toEqual({ ticketId: ID, counter: 12345, mac: MAC })
  })

  it('rejects anything that is not exactly the format', () => {
    expect(parsePayload(`CF2.${ID}.1.${MAC}`)).toBeNull()
    expect(parsePayload(`CF1.${ID}x.1.${MAC}`)).toBeNull()
    expect(parsePayload(`CF1.${ID}.1.${MAC.slice(1)}`)).toBeNull()
    expect(parsePayload(`CF1.${ID}.-1.${MAC}`)).toBeNull()
    expect(parsePayload(`CF1.${ID}.1.${MAC} `)).toBeNull()
    expect(parsePayload(`CF1.${ID.slice(0, 21)}+.1.${MAC}`)).toBeNull()
    expect(parsePayload(42)).toBeNull()
    expect(parsePayload('x'.repeat(500))).toBeNull()
  })

  it('accepts the current period and one either side', () => {
    const now = 1_800_000_000_000
    const counter = codeCounter(now)
    expect(counterFresh(counter, now)).toBe(true)
    expect(counterFresh(counter - 1, now)).toBe(true)
    expect(counterFresh(counter + 1, now)).toBe(true)
    expect(counterFresh(counter - 2, now)).toBe(false)
    expect(counterFresh(counter + 2, now)).toBe(false)
    expect(codeRemainingMs(counter * CODE_PERIOD_MS)).toBe(CODE_PERIOD_MS)
    expect(codeRemainingMs(counter * CODE_PERIOD_MS + 1000)).toBe(CODE_PERIOD_MS - 1000)
  })

  it('checks ticket ids by length and alphabet', () => {
    expect(isTicketId(ID)).toBe(true)
    expect(isTicketId(ID.slice(1))).toBe(false)
    expect(isTicketId(`${ID.slice(1)}/`)).toBe(false)
    expect(isTicketId(null)).toBe(false)
  })
})

describe('scanWindow', () => {
  it('opens six hours before the start and closes at the end', () => {
    const startsAt = '2026-11-28T21:00:00.000Z'
    const endsAt = '2026-11-29T04:00:00.000Z'
    expect(scanWindow(startsAt, endsAt, Date.parse('2026-11-28T14:59:00.000Z'))).toBe('not_open')
    expect(scanWindow(startsAt, endsAt, Date.parse('2026-11-28T15:00:00.000Z'))).toBe('open')
    expect(scanWindow(startsAt, endsAt, Date.parse('2026-11-29T03:59:59.000Z'))).toBe('open')
    expect(scanWindow(startsAt, endsAt, Date.parse('2026-11-29T04:00:00.000Z'))).toBe('closed')
  })
})

describe('base64url', () => {
  it('round-trips bytes without padding', () => {
    const bytes = Uint8Array.from({ length: 16 }, (_, i) => i)
    expect(bytesToBase64url(bytes)).toBe(ID)
    expect(base64urlToBytes(ID)).toEqual(bytes)
    const edge = Uint8Array.from([0xfb, 0xff, 0xbf])
    expect(bytesToBase64url(edge)).toBe('-_-_')
  })
})
