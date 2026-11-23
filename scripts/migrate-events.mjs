/**
 * Rewrites every event so the place lives on the event, refreshed from Places when possible,
 * then deletes the venues collection.
 *
 *   npm run migrate:events
 */
import { initializeApp } from 'firebase/app'
import { collection, deleteDoc, doc, getDocs, initializeFirestore, setDoc } from 'firebase/firestore'

const REQUIRED = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
]

const missing = REQUIRED.filter((key) => !process.env[key])
if (missing.length > 0) {
  console.error(`Missing ${missing.join(', ')}.`)
  process.exit(1)
}

const PLACES_KEY = process.env.VITE_GOOGLE_MAPS_API_KEY
const REFERER = 'http://localhost:5173/'

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

const PRICE_LEVELS = {
  PRICE_LEVEL_FREE: 1,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
}

const TYPE_GROUPS = [
  { type: 'arena', names: ['stadium', 'arena', 'sports_complex', 'athletic_field'] },
  { type: 'concert_hall', names: ['concert_hall', 'live_music_venue', 'event_venue'] },
  { type: 'theatre', names: ['performing_arts_theater', 'movie_theater', 'auditorium'] },
  { type: 'club', names: ['night_club'] },
  { type: 'bar', names: ['bar', 'pub', 'wine_bar', 'cocktail_bar'] },
  { type: 'festival', names: ['park', 'campground', 'plaza', 'amusement_park', 'national_park'] },
]

function venueTypeFromGoogle(types) {
  for (const group of TYPE_GROUPS) {
    if (types.some((type) => group.names.includes(type))) return group.type
  }
  return 'club'
}

function credit(photo) {
  const names = (photo.authorAttributions ?? []).map((author) => author.displayName?.trim()).filter(Boolean)
  return names.length > 0 ? `${names.join(', ')} · Google` : 'Google'
}

function toPlace(place) {
  const latitude = place.location?.latitude
  const longitude = place.location?.longitude
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null
  const photos = (place.photos ?? []).filter((photo) => photo.name).slice(0, 6)
  const types = [...(place.primaryType ? [place.primaryType] : []), ...(place.types ?? [])]
  return {
    name: place.displayName?.text?.trim() || '',
    venueType: venueTypeFromGoogle(types),
    address: place.formattedAddress?.trim() || '',
    latitude,
    longitude,
    rating: typeof place.rating === 'number' ? place.rating : null,
    priceLevel: PRICE_LEVELS[place.priceLevel] ?? null,
    hours: place.regularOpeningHours?.weekdayDescriptions?.join(' · ') ?? '',
    phone: place.internationalPhoneNumber?.trim() || '',
    website: place.websiteUri?.trim() || '',
    mapsUrl: place.googleMapsUri?.trim() || '',
    googlePlaceId: place.id?.trim() || '',
    images: photos.map((photo) => photo.name),
    imageAttributions: photos.map(credit),
    description: place.editorialSummary?.text?.trim() || '',
  }
}

async function placesFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'X-Goog-Api-Key': PLACES_KEY,
      Referer: REFERER,
      Origin: REFERER,
      ...options.headers,
    },
  })
  if (!response.ok) {
    const body = (await response.text()).replace(/\s+/g, ' ').slice(0, 180)
    throw new Error(body ? `Maps returned ${response.status}: ${body}` : `Maps returned ${response.status}.`)
  }
  return response.json()
}

async function lookup(venue) {
  if (!PLACES_KEY) return null
  if (venue.googlePlaceId) {
    const body = await placesFetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(venue.googlePlaceId)}`, {
      headers: { 'X-Goog-FieldMask': FIELD_MASK },
    })
    return toPlace(body)
  }
  const body = await placesFetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-FieldMask': FIELD_MASK.split(',').map((field) => `places.${field}`).join(','),
    },
    body: JSON.stringify({
      textQuery: venue.name,
      locationBias: {
        circle: { center: { latitude: venue.latitude, longitude: venue.longitude }, radius: 500 },
      },
      maxResultCount: 1,
    }),
  })
  return body.places?.[0] ? toPlace(body.places[0]) : null
}

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function strings(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()) : []
}

function storedPlace(venue, fresh) {
  const images = fresh?.images?.length ? fresh.images : strings(venue.images)
  const credits = fresh?.images?.length
    ? fresh.imageAttributions
    : Array.isArray(venue.imageAttributions)
      ? venue.imageAttributions.map((item) => (typeof item === 'string' ? item.trim() : ''))
      : []
  const level = [1, 2, 3, 4].includes(venue.priceLevel) ? venue.priceLevel : 2
  return {
    name: fresh?.name || text(venue.name),
    venueType: fresh?.venueType || 'club',
    neighbourhood: text(venue.neighbourhood),
    address: fresh?.address || text(venue.address),
    latitude: fresh?.latitude ?? venue.latitude,
    longitude: fresh?.longitude ?? venue.longitude,
    images,
    imageAttributions: credits,
    rating: fresh?.rating ?? (typeof venue.rating === 'number' ? venue.rating : 0),
    priceLevel: fresh?.priceLevel ?? level,
    hours: fresh?.hours || text(venue.hours),
    genres: Array.isArray(venue.genres) ? venue.genres.filter((item) => typeof item === 'string') : [],
    description: fresh?.description || text(venue.description),
    phone: fresh?.phone || text(venue.phone),
    website: fresh?.website || text(venue.website),
    mapsUrl: fresh?.mapsUrl || text(venue.mapsUrl),
    googlePlaceId: fresh?.googlePlaceId || text(venue.googlePlaceId),
  }
}

const app = initializeApp({
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
})

const db = initializeFirestore(app, { experimentalForceLongPolling: true })

try {
  const [venueSnap, eventSnap] = await Promise.all([
    getDocs(collection(db, 'venues')),
    getDocs(collection(db, 'events')),
  ])
  const venues = new Map(venueSnap.docs.map((item) => [item.id, item.data()]))
  const refreshed = new Map()

  for (const [id, venue] of venues) {
    try {
      refreshed.set(id, await lookup(venue))
      const place = refreshed.get(id)
      console.log(place ? `Maps: ${venue.name} → ${place.name} (${place.venueType})` : `Maps had nothing new for ${venue.name}`)
    } catch (error) {
      console.warn(`Maps lookup failed for ${venue.name}: ${error instanceof Error ? error.message : error}`)
      refreshed.set(id, null)
    }
  }

  const failed = []
  for (const item of eventSnap.docs) {
    const data = item.data()
    if (data.venue && typeof data.venue === 'object' && !data.venueId) {
      console.log(`skip event ${item.id}`)
      continue
    }
    const venue = venues.get(data.venueId)
    if (!venue) throw new Error(`Event ${item.id} points at missing venue ${data.venueId ?? '(none)'}`)
    const { venueId, ...fields } = data
    const payload = { ...fields, venue: storedPlace(venue, refreshed.get(venueId)) }
    let wrote = false
    for (let attempt = 1; attempt <= 3 && !wrote; attempt += 1) {
      try {
        await setDoc(doc(db, 'events', item.id), payload)
        wrote = true
        console.log(`rewrote event ${item.id}`)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (attempt === 3 || !/permission/i.test(message)) {
          failed.push(item.id)
          console.error(`failed event ${item.id}: ${message}`)
          break
        }
      }
    }
  }

  if (failed.length > 0) {
    throw new Error(`${failed.length} events were not rewritten, so venues were left in place.`)
  }

  for (const item of venueSnap.docs) {
    await deleteDoc(item.ref)
    console.log(`deleted venue ${item.id}`)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}

process.exit(0)
