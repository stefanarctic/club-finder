import { describe, expect, it } from 'vitest'
import { bucharest, events, venues } from './bucharest'
import { romania } from './countries'
import { buildListings, buildPins } from './discovery'
import { cityContaining, countryContaining } from './geo'
import { isSameDay, isUpcoming, matchesTimeRange, resolveStart, scheduleEvents, weekendEnd } from './schedule'

// Friday 16 Oct 2026.
const friday = (h: number, m = 0) => new Date(2026, 9, 16, h, m)

describe('resolveStart', () => {
  it('resolves day offsets and weekdays against the local date', () => {
    const at = friday(14)
    expect(resolveStart({ daysFromToday: 1, hour: 23, minute: 30 }, at)).toEqual(new Date(2026, 9, 17, 23, 30))
    expect(resolveStart({ weekday: 'saturday', hour: 22, minute: 0 }, at)).toEqual(new Date(2026, 9, 17, 22, 0))
    expect(resolveStart({ weekday: 'sunday', hour: 18, minute: 0 }, at)).toEqual(new Date(2026, 9, 18, 18, 0))
  })

  it('treats today as the coming weekday when it matches', () => {
    const saturday = new Date(2026, 9, 17, 12)
    expect(resolveStart({ weekday: 'saturday', hour: 22, minute: 0 }, saturday)).toEqual(new Date(2026, 9, 17, 22, 0))
  })

  it('rounds load-relative starts to five minutes', () => {
    expect(resolveStart({ minutesFromLoad: 75 }, friday(14, 2))).toEqual(friday(15, 15))
  })
})

describe('weekendEnd', () => {
  it('runs through Sunday night', () => {
    expect(weekendEnd(friday(14))).toEqual(new Date(2026, 9, 19, 6, 0))
    expect(weekendEnd(new Date(2026, 9, 19, 3))).toEqual(new Date(2026, 9, 19, 6, 0))
    expect(weekendEnd(new Date(2026, 9, 19, 7))).toEqual(new Date(2026, 9, 26, 6, 0))
  })
})

describe('seed', () => {
  const loadTimes = [friday(14), friday(22, 30), new Date(2026, 9, 18, 2), new Date(2026, 9, 20, 9)]

  it.each(loadTimes)('keeps every venue on the map when loaded at %s', (loadedAt) => {
    const scheduled = scheduleEvents(events, loadedAt)
    const listings = buildListings({
      venues,
      events: scheduled,
      origin: bucharest.defaultCenter,
      preferences: { genres: [], budget: null },
      now: loadedAt,
    })
    const pins = buildPins(listings, new Set())
    expect(pins).toHaveLength(venues.length)

    const stacked = pins.filter((p) => p.listings.length > 1)
    expect(stacked.length).toBeGreaterThanOrEqual(2)
    expect(stacked.some((p) => p.tonight && p.listings.some((l) => !l.sameDay))).toBe(true)
    expect(scheduled.some((e) => e.startsAt <= loadedAt && isUpcoming(e, loadedAt))).toBe(true)
  })

  it('has several same-day events and something for the weekend on a weekday afternoon', () => {
    const at = friday(14)
    const scheduled = scheduleEvents(events, at)
    expect(scheduled.filter((e) => isSameDay(e, at)).length).toBeGreaterThanOrEqual(4)
    expect(scheduled.filter((e) => matchesTimeRange(e, 'weekend', at) && !isSameDay(e, at)).length).toBeGreaterThan(3)
  })

  it('places every venue inside Bucharest by coordinates and covers all three budget bands', () => {
    expect(venues.every((v) => cityContaining(v, [bucharest])?.id === 'bucharest')).toBe(true)
    expect(countryContaining(bucharest.defaultCenter, [romania])?.id).toBe('romania')
    expect(cityContaining({ latitude: 48.8566, longitude: 2.3522 }, [bucharest])).toBeNull()
    const prices = events.map((e) => e.averagePrice)
    expect(prices.some((p) => p < 50)).toBe(true)
    expect(prices.some((p) => p >= 50 && p <= 100)).toBe(true)
    expect(prices.some((p) => p > 100)).toBe(true)
  })
})
