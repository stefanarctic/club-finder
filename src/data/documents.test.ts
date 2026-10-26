import { describe, expect, it } from 'vitest'
import { parseStoredEvent, parseVenue } from './documents'

describe('parseVenue', () => {
  it('reads a maps listing and drops a document without coordinates', () => {
    expect(
      parseVenue('control-club', {
        name: 'Control Club',
        neighbourhood: 'Universitate',
        address: 'Strada Constantin Mille 4',
        latitude: 44.435449,
        longitude: 26.097076,
        images: ['places/ChIJ/photos/abc', ''],
        imageAttributions: ['Ada · Google'],
        rating: 4.1,
        priceLevel: 2,
        hours: 'Friday: 12:00 PM – 6:00 AM',
        genres: ['live', 'nope'],
        description: 'A music venue.',
        phone: '+40 733 927 861',
        website: '',
        googlePlaceId: 'ChIJJ0NP5kb_sUARywqM81TfZD0',
      }),
    ).toMatchObject({
      id: 'control-club',
      images: ['places/ChIJ/photos/abc'],
      genres: ['live'],
      website: undefined,
      priceLevel: 2,
    })

    expect(parseVenue('x', { name: 'X', priceLevel: 2 })).toBeNull()
    expect(parseVenue('x', { name: 'X', latitude: 1, longitude: 2, priceLevel: 5 })).toBeNull()
  })
})

describe('parseStoredEvent', () => {
  it('keeps an absolute start and rejects a relative one', () => {
    expect(
      parseStoredEvent('forge-room', {
        venueId: 'forge-bucharest',
        name: 'ROOM:010',
        startsAt: '2026-11-07T23:00:00+02:00',
        durationHours: 6,
        image: '',
        averagePrice: 13,
        currency: 'EUR',
        genres: ['techno'],
        description: 'Techno night.',
      })?.startsAt,
    ).toBe('2026-11-07T23:00:00+02:00')

    expect(
      parseStoredEvent('bad', {
        venueId: 'forge-bucharest',
        name: 'Sliding',
        startsAt: '',
        durationHours: 6,
        averagePrice: 10,
        currency: 'EUR',
      }),
    ).toBeNull()
  })
})
