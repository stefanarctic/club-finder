import { addLocalDays, hasStarted, isSameLocalDay, startOfLocalDay, type ScheduledEvent } from '../data/schedule'
import type { Budget, Role, VenueType } from '../data/types'

// English interface, 24-hour clock, guest's own timezone.
const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short' })
const dayStamp = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
const dayMonth = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

export const formatTime = (date: Date) => time.format(date)

/** "Today" after midnight is the new calendar day. The date keeps that from reading as "happening now". */
function withDate(word: string, date: Date): string {
  return `${word}, ${dayStamp.format(date)}`
}

function dayLabel(date: Date, now: Date): string {
  if (isSameLocalDay(date, now)) return withDate(date.getHours() >= 17 || date.getHours() < 5 ? 'Tonight' : 'Today', date)
  if (isSameLocalDay(date, addLocalDays(now, 1))) return withDate('Tomorrow', date)
  const days = (startOfLocalDay(date).getTime() - startOfLocalDay(now).getTime()) / 86_400_000
  return days < 7 ? weekday.format(date) : dayMonth.format(date)
}

/** List group for events that start on the guest's calendar day. */
export function tonightGroupLabel(now: Date): string {
  return withDate('Tonight', now)
}

/** Card start line, e.g. "Tonight, 28 Nov · 23:00", "Sat · 22:00", "On now, 28 Nov · 23:00". */
export function startLabel(event: ScheduledEvent, now: Date): string {
  if (hasStarted(event, now)) return `${withDate('On now', event.startsAt)} · ${formatTime(event.startsAt)}`
  return `${dayLabel(event.startsAt, now)} · ${formatTime(event.startsAt)}`
}

/** Detail-page time span, e.g. "On now, 28 Nov · 23:00 – 06:00". */
export function timeSpanLabel(event: { startsAt: Date; endsAt: Date }, now: Date): string {
  const day = hasStarted(event, now) ? withDate('On now', event.startsAt) : dayLabel(event.startsAt, now)
  return `${day} · ${formatTime(event.startsAt)} – ${formatTime(event.endsAt)}`
}

export const budgetLabels: Record<Budget, string> = {
  under50: 'Under 50',
  '50to100': '50–100',
  '100plus': '100+',
}

export const venueTypeLabels: Record<VenueType, string> = {
  club: 'Club',
  bar: 'Bar',
  concert_hall: 'Concert hall',
  arena: 'Arena',
  theatre: 'Theatre',
  festival: 'Festival / outdoor',
  other: 'Other',
}

export const roleLabels: Record<Role, string> = {
  user: 'User',
  organizer: 'Event manager',
  admin: 'Admin',
}

export function externalMapUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
}
