import type { ClubEvent, EventStart, StoredEvent } from './types'

export type ScheduledEvent = ClubEvent & { startsAt: Date; endsAt: Date }

export type TimeRange = 'tonight' | 'weekend' | 'all'

const MINUTE = 60_000
const HOUR = 60 * MINUTE

export function startOfLocalDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function addLocalDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

const weekdayIndex = { sunday: 0, saturday: 6 } as const

export function resolveStart(start: EventStart, loadedAt: Date): Date {
  if ('minutesFromLoad' in start) {
    const at = loadedAt.getTime() + start.minutesFromLoad * MINUTE
    const step = 5 * MINUTE
    return new Date(Math.round(at / step) * step)
  }
  const today = startOfLocalDay(loadedAt)
  const offset =
    'daysFromToday' in start ? start.daysFromToday : (weekdayIndex[start.weekday] - today.getDay() + 7) % 7
  const d = addLocalDays(today, offset)
  d.setHours(start.hour, start.minute, 0, 0)
  return d
}

/** Absolute times are derived once, when the app loads, from the seed's relative offsets. */
export function scheduleEvents(events: ClubEvent[], loadedAt: Date): ScheduledEvent[] {
  return events.map((event) => {
    const startsAt = resolveStart(event.start, loadedAt)
    return { ...event, startsAt, endsAt: new Date(startsAt.getTime() + event.durationHours * HOUR) }
  })
}

/** Live events already store an absolute start. Invalid instants are dropped. */
export function scheduleStoredEvents(events: StoredEvent[]): ScheduledEvent[] {
  const scheduled: ScheduledEvent[] = []
  for (const event of events) {
    const startsAt = new Date(event.startsAt)
    if (Number.isNaN(startsAt.getTime())) continue
    scheduled.push({
      id: event.id,
      venueId: event.venueId,
      name: event.name,
      start: { minutesFromLoad: 0 },
      durationHours: event.durationHours,
      image: event.image,
      imageAttribution: event.imageAttribution,
      averagePrice: event.averagePrice,
      currency: event.currency,
      genres: event.genres,
      description: event.description,
      startsAt,
      endsAt: new Date(startsAt.getTime() + event.durationHours * HOUR),
    })
  }
  return scheduled
}

/** Not ended yet. Started-and-running events count as upcoming. */
export function isUpcoming(event: ScheduledEvent, now: Date): boolean {
  return event.endsAt.getTime() > now.getTime()
}

export function hasStarted(event: ScheduledEvent, now: Date): boolean {
  return event.startsAt.getTime() <= now.getTime()
}

/** Starts on the guest's local calendar date and has not ended. The only signal behind the pin outline. */
export function isSameDay(event: ScheduledEvent, now: Date): boolean {
  return isSameLocalDay(event.startsAt, now) && isUpcoming(event, now)
}

export function hoursUntil(event: ScheduledEvent, now: Date): number {
  return (event.startsAt.getTime() - now.getTime()) / HOUR
}

/** End of "this weekend": the next Monday 06:00, so Sunday-night events still count. */
export function weekendEnd(now: Date): Date {
  const today = startOfLocalDay(now)
  const daysToMonday = (1 - today.getDay() + 7) % 7
  const end = addLocalDays(today, daysToMonday)
  end.setHours(6, 0, 0, 0)
  return end.getTime() > now.getTime() ? end : addLocalDays(end, 7)
}

export function matchesTimeRange(event: ScheduledEvent, range: TimeRange, now: Date): boolean {
  switch (range) {
    case 'all':
      return isUpcoming(event, now)
    case 'tonight':
      return isSameDay(event, now)
    case 'weekend':
      return isUpcoming(event, now) && event.startsAt.getTime() < weekendEnd(now).getTime()
  }
}
