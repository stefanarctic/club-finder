import { describe, expect, it } from 'vitest'
import { parseMapsLink } from './mapsLink'
import { venueTypeFromGoogle } from './places'

describe('venueTypeFromGoogle', () => {
  it('prefers a hall, a club, then a bar', () => {
    expect(venueTypeFromGoogle(['stadium', 'point_of_interest'])).toBe('arena')
    expect(venueTypeFromGoogle(['night_club', 'bar'])).toBe('club')
    expect(venueTypeFromGoogle(['park'])).toBe('festival')
    expect(venueTypeFromGoogle(['restaurant'])).toBe('club')
  })
})

describe('parseMapsLink', () => {
  it('reads a place id from the query or the path', () => {
    expect(parseMapsLink('https://www.google.com/maps/search/?api=1&query=BT+Arena&query_place_id=ChIJabcdefghij1234567890')).toEqual({
      kind: 'placeId',
      placeId: 'ChIJabcdefghij1234567890',
    })
    expect(parseMapsLink('ChIJabcdefghij1234567890')).toEqual({
      kind: 'placeId',
      placeId: 'ChIJabcdefghij1234567890',
    })
  })

  it('searches a named place near the pin in the URL', () => {
    expect(parseMapsLink('https://www.google.com/maps/place/BT+Arena/@46.7712,23.5684,17z')).toEqual({
      kind: 'search',
      text: 'BT Arena',
      bias: { latitude: 46.7712, longitude: 23.5684 },
    })
  })

  it('refuses a short link the browser cannot open', () => {
    expect(parseMapsLink('https://maps.app.goo.gl/abc123')).toEqual({ kind: 'short' })
    expect(parseMapsLink('  ')).toEqual({ kind: 'empty' })
    expect(parseMapsLink('not a place')).toEqual({ kind: 'invalid' })
  })
})
