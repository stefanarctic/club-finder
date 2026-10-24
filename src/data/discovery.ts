import { distanceKm } from './geo'
import { matchedGenres, reasonParts, score, type Preferences } from './ranking'
import { hasStarted, isSameDay, isUpcoming, matchesTimeRange, type ScheduledEvent, type TimeRange } from './schedule'
import type { Genre, LatLng, Venue } from './types'

/*
 * One definition of "upcoming", "same day" and "for you" shared by the map and the list.
 */

export type SortKey = 'forYou' | 'soonest' | 'nearest' | 'price'

export type Listing = {
  event: ScheduledEvent
  venue: Venue
  distanceKm: number
  sameDay: boolean
  /** Started, not ended. Stays visible, sinks in the list. */
  live: boolean
  score: number
  matchedGenres: Genre[]
  reasons: string[]
}

export type DiscoveryContext = {
  venues: Venue[]
  events: ScheduledEvent[]
  origin: LatLng
  preferences: Preferences
  now: Date
}

/** Every upcoming event, scored from its coordinates. Ended events are dropped before scoring. */
export function buildListings({ venues, events, origin, preferences, now }: DiscoveryContext): Listing[] {
  const venuesById = new Map(venues.map((v) => [v.id, v]))
  const listings: Listing[] = []
  for (const event of events) {
    const venue = venuesById.get(event.venueId)
    if (!venue || !isUpcoming(event, now)) continue
    const km = distanceKm(origin, venue)
    const sameDay = isSameDay(event, now)
    listings.push({
      event,
      venue,
      distanceKm: km,
      sameDay,
      live: hasStarted(event, now),
      score: score({ event, distanceKm: km, rating: venue.rating, preferences, now }),
      matchedGenres: matchedGenres(event.genres, preferences.genres),
      reasons: reasonParts({ event, distanceKm: km, sameDay, picks: preferences.genres }),
    })
  }
  return listings
}

export type ListFilters = { timeRange: TimeRange; genres: Genre[] }

/** Genre chips narrow the list to events sharing at least one pick. No picks means no genre filter. */
export function matchesFilters(listing: Listing, filters: ListFilters, now: Date): boolean {
  if (!matchesTimeRange(listing.event, filters.timeRange, now)) return false
  return filters.genres.length === 0 || listing.matchedGenres.length > 0
}

const byStart = (a: Listing, b: Listing) => a.event.startsAt.getTime() - b.event.startsAt.getTime()
const byScore = (a: Listing, b: Listing) => b.score - a.score

const comparators: Record<SortKey, (a: Listing, b: Listing) => number> = {
  forYou: (a, b) => byScore(a, b) || byStart(a, b),
  soonest: (a, b) => byStart(a, b) || byScore(a, b),
  nearest: (a, b) => a.distanceKm - b.distanceKm || byScore(a, b),
  price: (a, b) => a.event.averagePrice - b.event.averagePrice || byScore(a, b),
}

export function sortListings(listings: Listing[], sort: SortKey): Listing[] {
  return [...listings].sort(comparators[sort])
}

/** "Tonight" sits above "Coming up". Each group keeps the active sort. */
export function groupListings(sorted: Listing[]): { tonight: Listing[]; comingUp: Listing[] } {
  return {
    tonight: sorted.filter((l) => l.sameDay),
    comingUp: sorted.filter((l) => !l.sameDay),
  }
}

export type VenuePinData = {
  venue: Venue
  /** Remaining events at the venue, soonest first. The first is the pin's primary event. */
  listings: Listing[]
  /** Any remaining event here starts today. */
  tonight: boolean
  tonightCount: number
  /** At least one event here passes the active list filters. */
  matched: boolean
}

/** Collapse upcoming events to one pin per venue. Venues with nothing left are absent. */
export function buildPins(listings: Listing[], matchedEventIds: ReadonlySet<string>): VenuePinData[] {
  const byVenue = new Map<string, Listing[]>()
  for (const listing of listings) {
    const group = byVenue.get(listing.venue.id)
    if (group) group.push(listing)
    else byVenue.set(listing.venue.id, [listing])
  }
  return [...byVenue.values()].map((group) => {
    const sorted = [...group].sort(byStart)
    const tonightCount = sorted.filter((l) => l.sameDay).length
    return {
      venue: sorted[0].venue,
      listings: sorted,
      tonight: tonightCount > 0,
      tonightCount,
      matched: sorted.some((l) => matchedEventIds.has(l.event.id)),
    }
  })
}
