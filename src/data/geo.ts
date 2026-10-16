import type { City, LatLng } from './types'

const EARTH_RADIUS_KM = 6371

export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180
  const dLat = (b.latitude - a.latitude) * rad
  const dLng = (b.longitude - a.longitude) * rad
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

export function isInsideCity(point: LatLng, city: City): boolean {
  const { north, south, west, east } = city.boundingBox
  return point.latitude <= north && point.latitude >= south && point.longitude >= west && point.longitude <= east
}
