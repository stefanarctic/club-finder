import type { LatLng } from './types'

export type MapsLink =
  | { kind: 'placeId'; placeId: string }
  | { kind: 'search'; text: string; bias?: LatLng }
  | { kind: 'short' }
  | { kind: 'empty' }
  | { kind: 'invalid' }

const PLACE_ID = /ChIJ[\w-]{10,}/
const AT_COORDS = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/

/** Reads a Google Maps URL. Short links cannot be followed from the browser. */
export function parseMapsLink(input: string): MapsLink {
  const value = input.trim()
  if (!value) return { kind: 'empty' }
  if (PLACE_ID.test(value) && !value.includes('://') && !value.includes('/')) {
    const id = value.match(PLACE_ID)
    return id ? { kind: 'placeId', placeId: id[0] } : { kind: 'invalid' }
  }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    const id = value.match(PLACE_ID)
    return id ? { kind: 'placeId', placeId: id[0] } : { kind: 'invalid' }
  }

  const host = url.hostname.replace(/^www\./, '')
  if (host === 'maps.app.goo.gl' || host === 'goo.gl') return { kind: 'short' }

  const fromQuery = url.searchParams.get('query_place_id') || url.searchParams.get('place_id')
  if (fromQuery && PLACE_ID.test(fromQuery)) {
    return { kind: 'placeId', placeId: fromQuery.match(PLACE_ID)![0] }
  }

  const embedded = `${url.pathname}${url.search}${url.hash}`.match(PLACE_ID)
  if (embedded) return { kind: 'placeId', placeId: embedded[0] }

  const name = placeName(url.pathname)
  const bias = coordinates(url.href)
  if (name) return bias ? { kind: 'search', text: name, bias } : { kind: 'search', text: name }
  return { kind: 'invalid' }
}

function placeName(pathname: string): string | null {
  const match = pathname.match(/\/place\/([^/@]+)/)
  if (!match) return null
  const name = decodeURIComponent(match[1]).replace(/\+/g, ' ').replace(/\//g, ' ').trim()
  return name || null
}

function coordinates(href: string): LatLng | null {
  const match = href.match(AT_COORDS)
  if (!match) return null
  const latitude = Number(match[1])
  const longitude = Number(match[2])
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null
  return { latitude, longitude }
}
