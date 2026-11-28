import { describe, expect, it } from 'vitest'
import type { ScheduledEvent } from '../data/schedule'
import { startLabel, timeSpanLabel, tonightGroupLabel } from './format'

function night(startsAt: Date, endsAt: Date): ScheduledEvent {
  return { startsAt, endsAt } as ScheduledEvent
}

describe('day labels', () => {
  const now = new Date(2026, 10, 28, 1, 11)

  it('puts the calendar date next to today, tonight, and tomorrow', () => {
    expect(startLabel(night(new Date(2026, 10, 28, 14, 0), new Date(2026, 10, 28, 18, 0)), now)).toBe('Today, 28 Nov · 14:00')
    expect(startLabel(night(new Date(2026, 10, 28, 23, 0), new Date(2026, 10, 29, 6, 0)), now)).toBe('Tonight, 28 Nov · 23:00')
    expect(startLabel(night(new Date(2026, 10, 29, 23, 0), new Date(2026, 10, 30, 6, 0)), now)).toBe('Tomorrow, 29 Nov · 23:00')
    expect(tonightGroupLabel(now)).toBe('Tonight, 28 Nov')
  })

  it('marks a night that has already started, and keeps its date', () => {
    const going = night(new Date(2026, 10, 27, 23, 0), new Date(2026, 10, 28, 6, 0))
    expect(startLabel(going, now)).toBe('On now, 27 Nov · 23:00')
    expect(timeSpanLabel(going, now)).toBe('On now, 27 Nov · 23:00 – 06:00')
  })
})
