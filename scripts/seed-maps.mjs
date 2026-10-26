/**
 * Writes Control Club and Forge into Firestore if those documents are not there yet.
 * Place details and photo resource names come from the Places API. Photo bytes stay on Google.
 * Published Forge nights are included only when the venue page listed a name, a clock time and a price.
 *
 *   npm run seed:maps
 *
 * Needs .env (see .env.example). A Places key restricted to http://localhost:5173 is sent that Referer.
 */
import { initializeApp } from 'firebase/app'
import { doc, getDoc, initializeFirestore, setDoc } from 'firebase/firestore'

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
  console.error(`Missing ${missing.join(', ')}. Copy .env.example to .env and fill in the Firebase web app config.`)
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
  'photos',
].join(',')

const PRICE_LEVELS = {
  PRICE_LEVEL_FREE: 1,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
}

const venues = [
  {
    id: 'control-club',
    placeId: 'ChIJJ0NP5kb_sUARywqM81TfZD0',
    name: 'Control Club',
    neighbourhood: 'Universitate',
    address: 'Strada Constantin Mille 4, București 010142',
    latitude: 44.435449,
    longitude: 26.097076,
    rating: 4.1,
    priceLevel: 2,
    hours: 'Sun–Mon 12:00–03:00 · Tue 12:00–05:00 · Wed 12:00–03:00 · Thu 12:00–05:00 · Fri–Sat 12:00–06:00',
    genres: ['live'],
    description: 'Music venue at Strada Constantin Mille 4, with a garden terrace, live shows and club nights.',
    phone: '+40 733 927 861',
    website: 'https://www.control-club.ro',
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Control+Club&query_place_id=ChIJJ0NP5kb_sUARywqM81TfZD0',
    googlePlaceId: 'ChIJJ0NP5kb_sUARywqM81TfZD0',
    images: [],
    imageAttributions: [],
  },
  {
    id: 'forge-bucharest',
    search: 'Forge Bucharest Pantelimon',
    name: 'Forge',
    neighbourhood: 'Pantelimon',
    address: 'Șoseaua Pantelimon 1A, intrare din Strada Ziduri Moși, București 022401',
    latitude: 44.448702,
    longitude: 26.133668,
    rating: 0,
    priceLevel: 2,
    hours: '',
    genres: ['techno'],
    description: 'Industrial club on Șoseaua Pantelimon 1A, entered from Strada Ziduri Moși.',
    phone: '+40 725 517 170',
    website: 'https://www.theforge.live',
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=44.448702,26.133668',
    googlePlaceId: '',
    images: [],
    imageAttributions: [],
  },
]

/**
 * Nights listed on https://www.theforge.live/evenimente with a clock time.
 * 40 RON and 64 RON are stored as about 8 EUR and 13 EUR. The description keeps the RON figure.
 * Control’s public program did not include clock times, so no Control event is invented.
 */
const events = [
  {
    id: 'forge-schissma-halloween-2026-10-24',
    venueId: 'forge-bucharest',
    name: 'SCHISSMA HALLOWEEN: BUCHAREST',
    startsAt: '2026-10-24T23:00:00+03:00',
    durationHours: 7,
    image: '',
    imageAttribution: '',
    averagePrice: 8,
    currency: 'EUR',
    genres: ['techno'],
    description: 'Techno night in the Piperoom at Forge. Tickets listed from 40 RON.',
  },
  {
    id: 'forge-solidago-2026-10-25',
    venueId: 'forge-bucharest',
    name: 'Solidago — Not a halloween party',
    startsAt: '2026-10-25T18:00:00+02:00',
    durationHours: 6,
    image: '',
    imageAttribution: '',
    averagePrice: 0,
    currency: 'EUR',
    genres: ['commercial'],
    description: 'Free courtyard night at Forge. Free entry.',
  },
  {
    id: 'forge-room-010-2026-11-07',
    venueId: 'forge-bucharest',
    name: 'ROOM:010',
    startsAt: '2026-11-07T23:00:00+02:00',
    durationHours: 6,
    image: '',
    imageAttribution: '',
    averagePrice: 13,
    currency: 'EUR',
    genres: ['techno'],
    description: 'Techno night in the Piperoom at Forge. Tickets listed from 64 RON.',
  },
]

function credit(photo) {
  const names = (photo.authorAttributions ?? [])
    .map((author) => author.displayName?.trim())
    .filter(Boolean)
  return names.length > 0 ? `${names.join(', ')} · Google` : 'Google'
}

function toPlace(place) {
  const latitude = place.location?.latitude
  const longitude = place.location?.longitude
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null
  const photos = (place.photos ?? []).filter((photo) => photo.name).slice(0, 6)
  return {
    name: place.displayName?.text?.trim() || '',
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

async function placeById(placeId) {
  const body = await placesFetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: { 'X-Goog-FieldMask': FIELD_MASK },
  })
  return toPlace(body)
}

async function placeByText(text) {
  const body = await placesFetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-FieldMask': FIELD_MASK.split(',').map((field) => `places.${field}`).join(',') },
    body: JSON.stringify({
      textQuery: text,
      locationBias: { circle: { center: { latitude: 44.4268, longitude: 26.1025 }, radius: 25000 } },
      maxResultCount: 5,
    }),
  })
  const named = (body.places ?? []).filter((place) => /forge/i.test(place.displayName?.text ?? ''))
  const match = named.find((place) => /pantelimon|ziduri/i.test(place.formattedAddress ?? '')) ?? named[0]
  return match ? toPlace(match) : null
}

function merge(base, place) {
  if (!place) return base
  return {
    ...base,
    name: place.name || base.name,
    address: place.address || base.address,
    latitude: place.latitude,
    longitude: place.longitude,
    rating: place.rating ?? base.rating,
    priceLevel: place.priceLevel ?? base.priceLevel,
    hours: place.hours || base.hours,
    phone: place.phone || base.phone,
    website: place.website || base.website,
    mapsUrl: place.mapsUrl || base.mapsUrl,
    googlePlaceId: place.googlePlaceId || base.googlePlaceId,
    description: place.description || base.description,
    images: place.images.length > 0 ? place.images : base.images,
    imageAttributions: place.images.length > 0 ? place.imageAttributions : base.imageAttributions,
  }
}

function venueRecord(venue) {
  const { id, placeId, search, ...fields } = venue
  return fields
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

async function ensureVenue(base) {
  const ref = doc(db, 'venues', base.id)
  if ((await getDoc(ref)).exists()) {
    console.log(`skip venue ${base.id}`)
    return
  }
  let place = null
  if (!PLACES_KEY) {
    console.warn(`No VITE_GOOGLE_MAPS_API_KEY. ${base.id} is stored without Maps photos.`)
  } else {
    try {
      place = base.placeId ? await placeById(base.placeId) : await placeByText(base.search)
      if (!place) console.warn(`Maps had no match for ${base.id}. Stored the known address without photos.`)
      else console.log(`Maps: ${place.name} · ${place.images.length} photos`)
    } catch (error) {
      console.warn(`Maps lookup failed for ${base.id}: ${error instanceof Error ? error.message : error}`)
    }
  }
  await setDoc(ref, venueRecord(merge(base, place)))
  console.log(`stored venue ${base.id}`)
}

async function ensureEvent(event) {
  const ref = doc(db, 'events', event.id)
  if ((await getDoc(ref)).exists()) {
    console.log(`skip event ${event.id}`)
    return
  }
  await setDoc(ref, event)
  console.log(`stored event ${event.id}`)
}

try {
  for (const venue of venues) await ensureVenue(venue)
  for (const event of events) await ensureEvent(event)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}

process.exit(0)
