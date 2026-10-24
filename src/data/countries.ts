import type { Country } from './types'

/** Romania, with a little margin so a fit isn't clipped by the coast. */
export const romania: Country = {
  id: 'romania',
  name: 'Romania',
  boundingBox: { north: 48.3, south: 43.6, west: 20.2, east: 29.8 },
}

export const countries: Country[] = [romania]
