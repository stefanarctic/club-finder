import { bucharest } from './bucharest'
import { countries } from './countries'

/** Cities and countries. Venues and events are loaded from Firestore. */
export const catalog = {
  /** A coordinate's city is whichever of these boxes contains it. Venues do not store a city. */
  cities: [bucharest],
  countries,
  /** Where the map opens, and where distance is measured from, when location is skipped. */
  defaultCity: bucharest,
}
