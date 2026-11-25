/** Google weekday descriptions joined with ` · `, or one day per line. */

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0]

export type OpeningPeriod = {
  /** Minutes from midnight. An end past 1440 finishes the next morning. */
  start: number
  end: number
  opens: string
  closes: string
}

export type OpeningDay = {
  /** `Date.getDay()` index, Sunday = 0. */
  day: number
  name: string
  hours: string
  closed: boolean
  periods: OpeningPeriod[]
}

export type OpeningStatus = {
  open: boolean
  label: string
  detail: string
}

const DAY_LINE = /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*:\s*(.+)$/i

export function parseOpeningHours(raw: string): OpeningDay[] | null {
  const parts = raw
    .replace(/[\u202f\u00a0\u2007\u2009]/g, ' ')
    .split(/\s*·\s*|\s*\n+\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length === 0) return null

  const byDay = new Map<number, OpeningDay>()
  for (const part of parts) {
    const match = part.match(DAY_LINE)
    if (!match) return null
    const name = match[1].slice(0, 1).toUpperCase() + match[1].slice(1).toLowerCase()
    const day = DAY_NAMES.indexOf(name as (typeof DAY_NAMES)[number])
    const hours = match[2].replace(/[ \t]+/g, ' ').trim()
    const parsed = parsePeriods(hours)
    byDay.set(day, {
      day,
      name,
      hours: parsed?.closed ? 'Closed' : hours,
      closed: parsed?.closed ?? false,
      periods: parsed?.periods ?? [],
    })
  }

  return MONDAY_FIRST.flatMap((day) => {
    const entry = byDay.get(day)
    return entry ? [entry] : []
  })
}

/** Open / closed line for a parsed week. Null when a day's hours could not be read. */
export function openingStatus(days: OpeningDay[], now: Date): OpeningStatus | null {
  if (days.some((day) => !day.closed && day.periods.length === 0)) return null

  const today = now.getDay()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const byDay = new Map(days.map((day) => [day.day, day]))
  const active = periodAt(byDay, today, nowMin)
  if (active) {
    if (active.start === 0 && active.end === 24 * 60) return { open: true, label: 'Open 24 hours', detail: '' }
    return { open: true, label: 'Open', detail: `Closes ${active.closes}` }
  }

  const next = nextPeriod(byDay, today, nowMin)
  if (!next) return { open: false, label: 'Closed', detail: '' }
  if (next.day === today) return { open: false, label: 'Closed', detail: `Opens ${next.opens}` }
  const tomorrow = (today + 1) % 7
  if (next.day === tomorrow) return { open: false, label: 'Closed', detail: `Opens tomorrow ${next.opens}` }
  return { open: false, label: 'Closed', detail: `Opens ${DAY_SHORT[next.day]} ${next.opens}` }
}

function periodAt(byDay: Map<number, OpeningDay>, today: number, nowMin: number): OpeningPeriod | null {
  const todayEntry = byDay.get(today)
  if (todayEntry) {
    for (const period of todayEntry.periods) {
      if (nowMin >= period.start && nowMin < period.end) return period
    }
  }
  // A range that passes midnight belongs to the day it started.
  const yesterday = byDay.get((today + 6) % 7)
  if (!yesterday) return null
  for (const period of yesterday.periods) {
    if (period.end > 24 * 60 && nowMin < period.end - 24 * 60) return period
  }
  return null
}

function nextPeriod(
  byDay: Map<number, OpeningDay>,
  today: number,
  nowMin: number,
): (OpeningPeriod & { day: number }) | null {
  for (let offset = 0; offset < 7; offset += 1) {
    const day = (today + offset) % 7
    const entry = byDay.get(day)
    if (!entry) continue
    for (const period of entry.periods) {
      if (offset === 0 && period.start <= nowMin) continue
      return { ...period, day }
    }
  }
  return null
}

function parsePeriods(text: string): { closed: boolean; periods: OpeningPeriod[] } | null {
  if (/^closed$/i.test(text)) return { closed: true, periods: [] }
  if (/^(open\s+)?24\s+hours$/i.test(text)) {
    return { closed: false, periods: [{ start: 0, end: 24 * 60, opens: '12:00 AM', closes: '12:00 AM' }] }
  }

  const parts = text.split(/\s*,\s*/).filter(Boolean)
  const periods: OpeningPeriod[] = []
  for (const part of parts) {
    const bits = part.split(/\s*(?:[–—−-]|to)\s*/i)
    if (bits.length !== 2) return null
    const start = parseClock(bits[0])
    let end = parseClock(bits[1])
    if (start == null || end == null) return null
    if (end <= start) end += 24 * 60
    periods.push({ start, end, opens: bits[0].trim(), closes: bits[1].trim() })
  }
  periods.sort((a, b) => a.start - b.start)
  return { closed: false, periods }
}

function parseClock(input: string): number | null {
  const match = input.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i)
  if (!match) return null
  let hour = Number(match[1])
  const minute = match[2] ? Number(match[2]) : 0
  const meridiem = match[3]?.toLowerCase()
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute > 59) return null
  if (meridiem) {
    if (hour < 1 || hour > 12) return null
    if (hour === 12) hour = meridiem === 'am' ? 0 : 12
    else if (meridiem === 'pm') hour += 12
  } else if (hour === 24 && minute === 0) {
    return 24 * 60
  } else if (hour > 23) {
    return null
  }
  return hour * 60 + minute
}
