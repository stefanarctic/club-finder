import { describe, expect, it } from 'vitest'
import { parseEventPlace, parseStoredEvent } from './documents'

const place = {
  name: 'Forge',
  venueType: 'club',
  neighbourhood: 'Pantelimon',
  address: 'Șoseaua Pantelimon 1A',
  latitude: 44.448702,
  longitude: 26.133668,
  images: ['places/ChIJ/photos/abc', ''],
  imageAttributions: ['Ada · Google'],
  rating: 4.1,
  priceLevel: 2,
  hours: 'Friday: 12:00 PM – 6:00 AM',
  genres: ['techno', 'nope'],
  description: 'A music venue.',
  phone: '+40 725 517 170',
  website: '',
  googlePlaceId: 'ChIJforge',
}

describe('parseEventPlace', () => {
  it('reads a maps listing and drops a place without coordinates', () => {
    expect(parseEventPlace(place)).toMatchObject({
      images: ['places/ChIJ/photos/abc'],
      genres: ['techno'],
      website: undefined,
      priceLevel: 2,
      venueType: 'club',
    })
    expect(parseEventPlace({ name: 'X', priceLevel: 2 })).toBeNull()
    expect(parseEventPlace({ name: 'X', latitude: 1, longitude: 2, priceLevel: 5 })).toBeNull()
    expect(parseEventPlace({ ...place, venueType: 'nope' })?.venueType).toBe('club')
  })
})

describe('parseStoredEvent', () => {
  it('keeps an absolute start and the place copied onto the event', () => {
    expect(
      parseStoredEvent('forge-room', {
        name: 'ROOM:010',
        startsAt: '2026-11-07T23:00:00+02:00',
        durationHours: 6,
        image: '',
        averagePrice: 13,
        currency: 'EUR',
        genres: ['techno'],
        description: 'Techno night.',
        venue: place,
      }),
    ).toMatchObject({ startsAt: '2026-11-07T23:00:00+02:00', venue: { name: 'Forge' } })

    expect(
      parseStoredEvent('old', {
        venueId: 'forge-bucharest',
        name: 'Sliding',
        startsAt: '2026-11-07T23:00:00+02:00',
        durationHours: 6,
        averagePrice: 10,
        currency: 'EUR',
      }),
    ).toMatchObject({ venueId: 'forge-bucharest', name: 'Sliding' })

    expect(
      parseStoredEvent('bad', {
        name: 'Sliding',
        startsAt: '',
        durationHours: 6,
        averagePrice: 10,
        currency: 'EUR',
      }),
    ).toBeNull()
  })
})
