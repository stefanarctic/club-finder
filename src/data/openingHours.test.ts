import { describe, expect, it } from 'vitest'
import { openingStatus, parseOpeningHours } from './openingHours'

const week =
  'Monday: 12:00\u202fPM – 3:00\u202fAM · Tuesday: 12:00 PM – 5:00 AM · Wednesday: 12:00 PM – 3:00 AM · Thursday: 12:00 PM – 5:00 AM · Friday: 12:00 PM – 6:00 AM · Saturday: 12:00 PM – 6:00 AM · Sunday: Closed'

describe('parseOpeningHours', () => {
  it('reads a Google week, Monday first, and keeps overnight ranges', () => {
    const days = parseOpeningHours(week)
    expect(days?.map((day) => day.name)).toEqual([
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ])
    expect(days?.[0]).toMatchObject({
      hours: '12:00 PM – 3:00 AM',
      closed: false,
      periods: [{ start: 12 * 60, end: 3 * 60 + 24 * 60, opens: '12:00 PM', closes: '3:00 AM' }],
    })
    expect(days?.[6]).toMatchObject({ closed: true, hours: 'Closed', periods: [] })
  })

  it('accepts one day per line and a split shift', () => {
    const days = parseOpeningHours('Friday: 10:00 AM – 2:00 PM, 5:00 PM – 11:00 PM\nSaturday: Open 24 hours')
    expect(days).toMatchObject([
      { name: 'Friday', periods: [{ start: 10 * 60 }, { start: 17 * 60, end: 23 * 60 }] },
      { name: 'Saturday', periods: [{ start: 0, end: 24 * 60 }] },
    ])
  })

  it('leaves free text alone', () => {
    expect(parseOpeningHours('Thu–Sat 22:00–07:00')).toBeNull()
    expect(parseOpeningHours('')).toBeNull()
  })
})

describe('openingStatus', () => {
  const days = parseOpeningHours(week)
  if (!days) throw new Error('fixture did not parse')

  const at = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute)

  it('is open through an overnight close', () => {
    expect(openingStatus(days, at(25, 13))).toEqual({ open: true, label: 'Open', detail: 'Closes 3:00 AM' })
    expect(openingStatus(days, at(26, 2))).toEqual({ open: true, label: 'Open', detail: 'Closes 3:00 AM' })
  })

  it('says when a closed venue opens next', () => {
    expect(openingStatus(days, at(25, 10))).toEqual({ open: false, label: 'Closed', detail: 'Opens 12:00 PM' })
    expect(openingStatus(days, at(26, 4))).toEqual({ open: false, label: 'Closed', detail: 'Opens 12:00 PM' })
    expect(openingStatus(days, at(29, 8))).toEqual({ open: false, label: 'Closed', detail: 'Opens tomorrow 12:00 PM' })
  })

  it('treats a 24-hour day as open all day', () => {
    const always = parseOpeningHours('Wednesday: Open 24 hours')
    expect(openingStatus(always ?? [], at(25, 4))).toEqual({ open: true, label: 'Open 24 hours', detail: '' })
  })

  it('does not invent a status when a day is unreadable', () => {
    const messy = parseOpeningHours('Wednesday: noonish')
    expect(openingStatus(messy ?? [], at(25, 13))).toBeNull()
  })
})
