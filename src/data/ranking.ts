import { hasStarted, hoursUntil, isSameDay, isSameLocalDay, type ScheduledEvent } from './schedule'
import type { Budget, Genre } from './types'

/*
 * "For you" is a weighted sum the interface can explain. Every term is 0–1.
 * See PRODUCT.md → Best fit for the definition this mirrors.
 */

export const WEIGHTS = {
  sameDay: 40,
  timeProximity: 20,
  distance: 15,
  genreOverlap: 15,
  priceFit: 7,
  rating: 3,
} as const

export type Preferences = { genres: Genre[]; budget: Budget | null }

export function timeProximity(event: ScheduledEvent, now: Date): number {
  if (hasStarted(event, now)) return 0.25
  const hours = hoursUntil(event, now)
  if (hours <= 3) return 1
  if (hours <= 8) return 0.75
  if (isSameLocalDay(event.startsAt, now)) return 0.55
  if (hours <= 36) return 0.35
  if (hours <= 72) return 0.2
  return 0.1
}

export function distanceScore(km: number): number {
  return Math.min(1, Math.max(0, 1 - km / 12))
}

export function matchedGenres(eventGenres: Genre[], picks: Genre[]): Genre[] {
  return eventGenres.filter((genre) => picks.includes(genre))
}

export function genreOverlap(eventGenres: Genre[], picks: Genre[]): number {
  if (picks.length === 0) return 0
  return matchedGenres(eventGenres, picks).length / picks.length
}

export function priceFit(averagePrice: number, budget: Budget | null): number {
  switch (budget) {
    case null:
      return 0
    case 'under50':
      return averagePrice <= 50 ? 1 : averagePrice <= 100 ? 0.4 : 0
    case '50to100':
      return averagePrice < 50 ? 0.5 : averagePrice <= 100 ? 1 : 0.2
    case '100plus':
      return averagePrice >= 100 ? 1 : averagePrice >= 50 ? 0.5 : 0.2
  }
}

export function ratingScore(rating: number): number {
  return rating / 5
}

export type ScoreInput = {
  event: ScheduledEvent
  distanceKm: number
  rating: number
  preferences: Preferences
  now: Date
}

export function score({ event, distanceKm, rating, preferences, now }: ScoreInput): number {
  return (
    WEIGHTS.sameDay * (isSameDay(event, now) ? 1 : 0) +
    WEIGHTS.timeProximity * timeProximity(event, now) +
    WEIGHTS.distance * distanceScore(distanceKm) +
    WEIGHTS.genreOverlap * genreOverlap(event.genres, preferences.genres) +
    WEIGHTS.priceFit * priceFit(event.averagePrice, preferences.budget) +
    WEIGHTS.rating * ratingScore(rating)
  )
}

export function formatDistance(km: number): string {
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`
}

/** The card's "why it ranked here" facts, in spec order, skipping anything that doesn't apply. */
export function reasonParts({
  event,
  distanceKm,
  sameDay,
  picks,
}: {
  event: ScheduledEvent
  distanceKm: number
  sameDay: boolean
  picks: Genre[]
}): string[] {
  const parts = [formatDistance(distanceKm)]
  if (sameDay) parts.push('tonight')
  const genre = matchedGenres(event.genres, picks)[0] ?? event.genres[0]
  if (genre) parts.push(genre)
  parts.push(`about ${event.averagePrice} ${event.currency}`)
  return parts
}
