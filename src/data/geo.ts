import type { BoundingBox, City, Country, LatLng } from './types'

const EARTH_RADIUS_KM = 6371

export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180
  const dLat = (b.latitude - a.latitude) * rad
  const dLng = (b.longitude - a.longitude) * rad
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

export function isInsideBounds(point: LatLng, box: BoundingBox): boolean {
  return point.latitude <= box.north && point.latitude >= box.south && point.longitude >= box.west && point.longitude <= box.east
}

export function isInsideCity(point: LatLng, city: City): boolean {
  return isInsideBounds(point, city.boundingBox)
}

/** First city whose bounds contain the point. City boxes are expected not to overlap. */
export function cityContaining(point: LatLng, cities: readonly City[]): City | null {
  return cities.find((city) => isInsideCity(point, city)) ?? null
}

export function countryContaining(point: LatLng, countries: readonly Country[]): Country | null {
  return countries.find((country) => isInsideBounds(point, country.boundingBox)) ?? null
}

/** A frame around `center` that still contains every point. */
export function boundsAroundPoints(
  center: LatLng,
  points: readonly LatLng[],
  pad = 0.01,
): [[number, number], [number, number]] {
  let dLat = pad
  let dLng = pad
  for (const point of points) {
    dLat = Math.max(dLat, Math.abs(point.latitude - center.latitude))
    dLng = Math.max(dLng, Math.abs(point.longitude - center.longitude))
  }
  return [
    [center.longitude - dLng, center.latitude - dLat],
    [center.longitude + dLng, center.latitude + dLat],
  ]
}

export function toLngLatBounds(box: BoundingBox, pad = 0): [[number, number], [number, number]] {
  return [
    [box.west - pad, box.south - pad],
    [box.east + pad, box.north + pad],
  ]
}

/** Country-sized window used when a point falls outside every known country. */
export function boundsAround(point: LatLng, spanDegrees = 5): BoundingBox {
  return {
    north: Math.min(85, point.latitude + spanDegrees),
    south: Math.max(-85, point.latitude - spanDegrees),
    west: point.longitude - spanDegrees,
    east: point.longitude + spanDegrees,
  }
}
