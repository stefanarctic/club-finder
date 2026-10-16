import { describe, expect, it } from 'vitest'
import { distanceScore, formatDistance, genreOverlap, priceFit, reasonParts, score, timeProximity } from './ranking'
import type { ScheduledEvent } from './schedule'
import type { ClubEvent } from './types'

const HOUR = 3_600_000
// Friday 16 Oct 2026, 14:00 local.
const now = new Date(2026, 9, 16, 14, 0)

function eventAt(startsAt: Date, overrides: Partial<ClubEvent> = {}): ScheduledEvent {
  return {
    id: 'e',
    venueId: 'v',
    name: 'Test',
    start: { minutesFromLoad: 0 },
    durationHours: 6,
    averagePrice: 80,
    currency: 'EUR',
    genres: ['techno', 'house'],
    description: '',
    ...overrides,
    startsAt,
    endsAt: new Date(startsAt.getTime() + 6 * HOUR),
  }
}

const inHours = (h: number) => new Date(now.getTime() + h * HOUR)

describe('timeProximity', () => {
  it('follows the spec buckets', () => {
    expect(timeProximity(eventAt(inHours(-1)), now)).toBe(0.25)
    expect(timeProximity(eventAt(inHours(2)), now)).toBe(1)
    expect(timeProximity(eventAt(inHours(3)), now)).toBe(1)
    expect(timeProximity(eventAt(inHours(6)), now)).toBe(0.75)
    expect(timeProximity(eventAt(inHours(9.5)), now)).toBe(0.55) // 23:30 today
    expect(timeProximity(eventAt(inHours(20)), now)).toBe(0.35)
    expect(timeProximity(eventAt(inHours(60)), now)).toBe(0.2)
    expect(timeProximity(eventAt(inHours(100)), now)).toBe(0.1)
  })
})

describe('distanceScore', () => {
  it('is 1 on top of the guest and 0 from 12 km', () => {
    expect(distanceScore(0)).toBe(1)
    expect(distanceScore(6)).toBe(0.5)
    expect(distanceScore(12)).toBe(0)
    expect(distanceScore(30)).toBe(0)
  })
})

describe('genreOverlap', () => {
  it('divides the intersection by the number of picks', () => {
    expect(genreOverlap(['techno', 'house'], [])).toBe(0)
    expect(genreOverlap(['techno', 'house'], ['techno'])).toBe(1)
    expect(genreOverlap(['techno'], ['techno', 'latin'])).toBe(0.5)
    expect(genreOverlap(['latin'], ['techno', 'house', 'queer'])).toBe(0)
  })
})

describe('priceFit', () => {
  it('scores each band at its edges', () => {
    expect(priceFit(80, null)).toBe(0)
    expect([50, 100, 101].map((p) => priceFit(p, 'under50'))).toEqual([1, 0.4, 0])
    expect([49, 50, 100, 101].map((p) => priceFit(p, '50to100'))).toEqual([0.5, 1, 1, 0.2])
    expect([49, 50, 99, 100].map((p) => priceFit(p, '100plus'))).toEqual([0.2, 0.5, 0.5, 1])
  })
})

describe('score', () => {
  it('puts a same-day event above an otherwise better later one', () => {
    const preferences = { genres: [], budget: null }
    const tonight = score({ event: eventAt(inHours(9)), distanceKm: 10, rating: 3, preferences, now })
    const tomorrow = score({ event: eventAt(inHours(26)), distanceKm: 0, rating: 5, preferences, now })
    expect(tonight).toBeGreaterThan(tomorrow)
  })

  it('ignores genre and price terms when the guest skipped them', () => {
    const base = { event: eventAt(inHours(5)), distanceKm: 2, rating: 4, now }
    const skipped = score({ ...base, preferences: { genres: [], budget: null } })
    expect(skipped).toBeCloseTo(40 + 20 * 0.75 + 15 * (1 - 2 / 12) + 3 * 0.8)
  })
})

describe('reason line', () => {
  it('matches the spec example', () => {
    const parts = reasonParts({ event: eventAt(inHours(9)), distanceKm: 1.43, sameDay: true, picks: ['house'] })
    expect(parts).toEqual(['1.4 km', 'tonight', 'house', 'about 80 EUR'])
  })

  it('uses the first genre when the guest skipped and rounds far distances', () => {
    const parts = reasonParts({ event: eventAt(inHours(30)), distanceKm: 12.4, sameDay: false, picks: [] })
    expect(parts).toEqual(['12 km', 'techno', 'about 80 EUR'])
    expect(formatDistance(9.96)).toBe('10.0 km')
  })
})
