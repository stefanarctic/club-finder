import type { City } from './types'

/**
 * Bucharest is only the box the map opens on. Live venues come from Firestore.
 * The invented demo seed lives in `placeholders.json` and is not shown.
 */
export const bucharest: City = {
  id: 'bucharest',
  name: 'Bucharest',
  boundingBox: { north: 44.54, south: 44.33, west: 25.96, east: 26.23 },
  defaultCenter: { latitude: 44.4268, longitude: 26.1025 },
  defaultCenterName: 'Piața Unirii',
}
