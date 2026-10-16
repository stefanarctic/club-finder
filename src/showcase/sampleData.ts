import type { EventCardProps } from '../design-system'

export const genres = ['techno', 'house', 'hip-hop', 'live', 'commercial', 'queer', 'latin'] as const

export const tonightEvents: Omit<EventCardProps, 'onSelect'>[] = [
  {
    id: 'evt-control-basement',
    name: 'Basement Frequencies',
    venueName: 'Control Placeholder',
    startLabel: 'Tonight · 23:00',
    reasons: ['1.4 km', 'tonight', 'techno', 'about 80 EUR'],
    genres: ['techno', 'house'],
    matchedGenres: ['techno'],
    tonight: true,
    moreAtVenue: 1,
  },
  {
    id: 'evt-guesthouse-velvet',
    name: 'Velvet Room: All Night Long',
    venueName: 'Guesthouse Demo',
    startLabel: 'Tonight · 22:30',
    reasons: ['2.1 km', 'tonight', 'house', 'about 45 EUR'],
    genres: ['house', 'queer'],
    matchedGenres: ['house'],
    tonight: true,
  },
  {
    id: 'evt-fratelli-early',
    name: 'Sunset Sessions',
    venueName: 'Terasa Sample',
    startLabel: 'Started 20:00',
    reasons: ['3.8 km', 'tonight', 'commercial', 'about 30 EUR'],
    genres: ['commercial'],
    tonight: true,
    live: true,
  },
]

export const upcomingEvents: Omit<EventCardProps, 'onSelect'>[] = [
  {
    id: 'evt-form-space-latin',
    name: 'Noche Caliente',
    venueName: 'Form Placeholder',
    startLabel: 'Sat 22:00',
    reasons: ['4.6 km', 'latin', 'about 60 EUR'],
    genres: ['latin', 'live'],
  },
  {
    id: 'evt-expirat-cypher',
    name: 'Cypher Vol. 12',
    venueName: 'Expirat Demo',
    startLabel: 'Tue 23:30',
    reasons: ['12 km', 'hip-hop', 'about 120 EUR'],
    genres: ['hip-hop'],
  },
]
