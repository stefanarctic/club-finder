export class PlaceLookupError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PlaceLookupError'
  }
}

export type PlaceDraft = {
  name: string
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
  'photos',
].join(',')

const SEARCH_MASK = FIELD_MASK.split(',')
  .map((field) => `places.${field}`)
  .join(',')

/** Bucharest centre, so a name search does not land on a Forge in another city. */
const BUCHAREST = { latitude: 44.4268, longitude: 26.1025 }

export async function lookupPlace(query: { placeId: string } | { text: string }): Promise<PlaceDraft> {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  if (!key) {
    throw new PlaceLookupError('Add VITE_GOOGLE_MAPS_API_KEY to read details and photos from Maps.')
  }
  const place = 'placeId' in query ? await fetchPlace(query.placeId, key) : await searchPlace(query.text, key)
  if (!place) throw new PlaceLookupError('Maps didn’t return a place for that search.')
  return toDraft(place)
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

async function searchPlace(text: string, key: string): Promise<PlaceJson | null> {
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
      locationBias: { circle: { center: BUCHAREST, radius: 25000 } },
      maxResultCount: 5,
    }),
  })
  if (!response.ok) throw new PlaceLookupError(await errorMessage(response))
  const body = (await response.json()) as { places?: PlaceJson[] }
  return body.places?.[0] ?? null
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
