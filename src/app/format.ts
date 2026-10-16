import { addLocalDays, hasStarted, isSameLocalDay, startOfLocalDay, type ScheduledEvent } from '../data/schedule'
import type { Budget } from '../data/types'

// English interface, 24-hour clock, guest's own timezone.
const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short' })
const dayMonth = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

export const formatTime = (date: Date) => time.format(date)

function dayLabel(date: Date, now: Date): string {
  if (isSameLocalDay(date, now)) return date.getHours() >= 17 || date.getHours() < 5 ? 'Tonight' : 'Today'
  if (isSameLocalDay(date, addLocalDays(now, 1))) return 'Tomorrow'
  const days = (startOfLocalDay(date).getTime() - startOfLocalDay(now).getTime()) / 86_400_000
  return days < 7 ? weekday.format(date) : dayMonth.format(date)
}

/** Card start line, e.g. "Tonight · 23:00", "Sat · 22:00", "Started 20:00". */
export function startLabel(event: ScheduledEvent, now: Date): string {
  if (hasStarted(event, now)) return `Started ${formatTime(event.startsAt)}`
  return `${dayLabel(event.startsAt, now)} · ${formatTime(event.startsAt)}`
}

/** Detail-page time span, e.g. "Tonight · 23:00 – 06:00". */
export function timeSpanLabel(event: ScheduledEvent, now: Date): string {
  const day = hasStarted(event, now) ? 'On now' : dayLabel(event.startsAt, now)
  return `${day} · ${formatTime(event.startsAt)} – ${formatTime(event.endsAt)}`
}

export const budgetLabels: Record<Budget, string> = {
  under50: 'Under 50',
  '50to100': '50–100',
  '100plus': '100+',
}

export function externalMapUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
}
