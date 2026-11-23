import { parseMapsLink } from './mapsLink'
import type { LatLng, VenueType } from './types'

export class PlaceLookupError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PlaceLookupError'
  }
}

export type PlaceDraft = {
  name: string
  venueType: VenueType
  address: string
  latitude: number
  longitude: number
  rating: number | null
  priceLevel: 1 | 2 | 3 | 4 | null
  hours: string
  phone: string
  website: string
  mapsUrl: string
  googlePlaceId: string
  images: string[]
  imageAttributions: string[]
  description: string
}

type PlaceJson = {
  id?: string
  displayName?: { text?: string }
  formattedAddress?: string
  location?: { latitude?: number; longitude?: number }
  rating?: number
  priceLevel?: string
  regularOpeningHours?: { weekdayDescriptions?: string[] }
  internationalPhoneNumber?: string
  websiteUri?: string
  googleMapsUri?: string
  editorialSummary?: { text?: string }
  primaryType?: string
  types?: string[]
  photos?: { name?: string; authorAttributions?: { displayName?: string }[] }[]
}

const PRICE_LEVELS: Record<string, 1 | 2 | 3 | 4> = {
  PRICE_LEVEL_FREE: 1,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
}

const FIELD_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'rating',
  'priceLevel',
  'regularOpeningHours',
  'internationalPhoneNumber',
  'websiteUri',
  'googleMapsUri',
  'editorialSummary',
  'primaryType',
  'types',
  'photos',
].join(',')

const SEARCH_MASK = FIELD_MASK.split(',')
  .map((field) => `places.${field}`)
  .join(',')

const TYPE_GROUPS: { type: VenueType; names: string[] }[] = [
  { type: 'arena', names: ['stadium', 'arena', 'sports_complex', 'athletic_field'] },
  { type: 'concert_hall', names: ['concert_hall', 'live_music_venue', 'event_venue'] },
  { type: 'theatre', names: ['performing_arts_theater', 'movie_theater', 'auditorium'] },
  { type: 'club', names: ['night_club'] },
  { type: 'bar', names: ['bar', 'pub', 'wine_bar', 'cocktail_bar'] },
  { type: 'festival', names: ['park', 'campground', 'plaza', 'amusement_park', 'national_park'] },
]

/** Best venue type we can read from a Google place. Unknown places stay clubs. */
export function venueTypeFromGoogle(types: string[]): VenueType {
  for (const group of TYPE_GROUPS) {
    if (types.some((type) => group.names.includes(type))) return group.type
  }
  return 'club'
}

export async function lookupPlace(query: { placeId: string } | { text: string; bias?: LatLng }): Promise<PlaceDraft> {
  const places = 'placeId' in query ? [await lookupPlaceById(query.placeId)] : await lookupPlaces(query)
  const place = places[0]
  if (!place) throw new PlaceLookupError('Maps didn’t return a place for that search.')
  return place
}

export async function lookupPlaceById(placeId: string): Promise<PlaceDraft> {
  const key = mapsKey()
  const place = await fetchPlace(placeId, key)
  if (!place) throw new PlaceLookupError('Maps didn’t return a place for that search.')
  return toDraft(place)
}

/** Text search. `bias` keeps a Cluj link from landing on a same-named place in another city. */
export async function lookupPlaces(query: { text: string; bias?: LatLng }): Promise<PlaceDraft[]> {
  const key = mapsKey()
  const places = await searchPlaces(query.text, query.bias, key)
  const drafts = places.flatMap((place) => {
    try {
      return [toDraft(place)]
    } catch {
      return []
    }
  })
  if (drafts.length === 0) throw new PlaceLookupError('Maps didn’t return a place for that search.')
  return drafts
}

export async function lookupMapsLink(input: string): Promise<PlaceDraft[]> {
  const parsed = parseMapsLink(input)
  if (parsed.kind === 'empty') throw new PlaceLookupError('Paste a Google Maps link.')
  if (parsed.kind === 'short') {
    throw new PlaceLookupError('Open that short link, then paste the full URL from the address bar.')
  }
  if (parsed.kind === 'invalid') throw new PlaceLookupError('That link doesn’t point at a place.')
  if (parsed.kind === 'placeId') return [await lookupPlaceById(parsed.placeId)]
  return lookupPlaces({ text: parsed.text, bias: parsed.bias })
}

function mapsKey(): string {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  if (!key) throw new PlaceLookupError('Add VITE_GOOGLE_MAPS_API_KEY to read details and photos from Maps.')
  return key
}

async function fetchPlace(placeId: string, key: string): Promise<PlaceJson | null> {
  const id = placeId.replace(/^places\//, '').trim()
  if (!id) throw new PlaceLookupError('Enter a place id or a club name.')
  const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`, {
    headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELD_MASK },
  })
  if (!response.ok) throw new PlaceLookupError(await errorMessage(response))
  return (await response.json()) as PlaceJson
}

async function searchPlaces(text: string, bias: LatLng | undefined, key: string): Promise<PlaceJson[]> {
  const query = text.trim()
  if (!query) throw new PlaceLookupError('Enter a place id or a club name.')
  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': SEARCH_MASK,
    },
    body: JSON.stringify({
      textQuery: query,
      ...(bias ? { locationBias: { circle: { center: bias, radius: 2000 } } } : {}),
      maxResultCount: 5,
    }),
  })
  if (!response.ok) throw new PlaceLookupError(await errorMessage(response))
  const body = (await response.json()) as { places?: PlaceJson[] }
  return body.places ?? []
}

export function toDraft(place: PlaceJson): PlaceDraft {
  const latitude = place.location?.latitude
  const longitude = place.location?.longitude
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new PlaceLookupError('Maps returned a place without coordinates.')
  }
  const photos = (place.photos ?? []).filter((photo) => photo.name).slice(0, 6)
  return {
    name: place.displayName?.text?.trim() || '',
    venueType: venueTypeFromGoogle([...(place.primaryType ? [place.primaryType] : []), ...(place.types ?? [])]),
    address: place.formattedAddress?.trim() || '',
    latitude,
    longitude,
    rating: typeof place.rating === 'number' ? place.rating : null,
    priceLevel: place.priceLevel ? (PRICE_LEVELS[place.priceLevel] ?? null) : null,
    hours: place.regularOpeningHours?.weekdayDescriptions?.join(' · ') ?? '',
    phone: place.internationalPhoneNumber?.trim() || '',
    website: place.websiteUri?.trim() || '',
    mapsUrl: place.googleMapsUri?.trim() || '',
    googlePlaceId: place.id?.trim() || '',
    images: photos.map((photo) => photo.name as string),
    imageAttributions: photos.map((photo) => credit(photo)),
    description: place.editorialSummary?.text?.trim() || '',
  }
}

function credit(photo: { authorAttributions?: { displayName?: string }[] }): string {
  const names = (photo.authorAttributions ?? [])
    .map((author) => author.displayName?.trim())
    .filter((name): name is string => Boolean(name))
  return names.length > 0 ? `${names.join(', ')} · Google` : 'Google'
}

async function errorMessage(response: Response): Promise<string> {
  const body = await response.text()
  const detail = body.replace(/\s+/g, ' ').slice(0, 180)
  return detail ? `Maps returned ${response.status}: ${detail}` : `Maps returned ${response.status}.`
}
