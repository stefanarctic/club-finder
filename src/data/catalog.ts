import { bucharest, events, venues } from './bucharest'
import { countries } from './countries'
import { scheduleEvents } from './schedule'

/** Tonight, tomorrow and this weekend are resolved once, against the clock at load. */
export const loadedAt = new Date()

export const catalog = {
  /** A coordinate's city is whichever of these boxes contains it. Venues do not store a city. */
  cities: [bucharest],
  countries,
  /** Where the map opens, and where distance is measured from, when location is skipped. */
  defaultCity: bucharest,
  venues,
  events: scheduleEvents(events, loadedAt),
}
