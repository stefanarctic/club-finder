/**
 * Venue galleries become the photos the club itself published (Google Business profile).
 * Each event keeps its own poster, plus a second crop from the club site when that file is different.
 * Other nights' posters are not stored on the venue.
 *
 *   node --env-file=.env scripts/set-club-photos.mjs
 */
import { initializeApp } from 'firebase/app'
import { collection, doc, getDocs, initializeFirestore, setDoc } from 'firebase/firestore'

const cloud = process.env.VITE_CLOUDINARY_CLOUD_NAME
const preset = process.env.VITE_CLOUDINARY_UPLOAD_PRESET
const placesKey = process.env.VITE_GOOGLE_MAPS_API_KEY
if (!cloud || !preset || !placesKey) {
  console.error('Cloudinary and the Places key have to be set.')
  process.exit(1)
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

function decode(value) {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#0?39;|&apos;|&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function tokens(value) {
  return new Set(
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter((word) => word.length > 2 && !['ctrl', 'live', 'the', 'and', 'with'].includes(word)),
  )
}

function numbers(value) {
  return [...value.matchAll(/\d+/g)].map((match) => match[0])
}

function score(left, right) {
  const leftNumbers = numbers(left)
  const rightNumbers = numbers(right)
  if (leftNumbers.length > 0 && rightNumbers.length > 0 && !leftNumbers.some((item) => rightNumbers.includes(item))) return 0
  const a = tokens(left)
  const b = tokens(right)
  if (a.size === 0 || b.size === 0) return 0
  let shared = 0
  for (const word of a) if (b.has(word)) shared += 1
  return shared / Math.min(a.size, b.size)
}

function fileId(url) {
  return url.match(/uid_([a-f0-9]+)/i)?.[1] ?? url.split('/').pop()
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'club-finder' } })
  if (!response.ok) throw new Error(`${url} returned ${response.status}`)
  return response.text()
}

function controlPosters(html) {
  const byHref = new Map()
  const add = (href, title, src) => {
    if (!href?.startsWith('/events/') || !title || !src) return
    const current = byHref.get(href) ?? { title: decode(title), files: new Map() }
    const id = fileId(src)
    const sized = src.includes('/img/cache/640/') ? src.replace('/img/cache/640/', '/img/cache/1600/') : src
    if (!current.files.has(id)) current.files.set(id, sized.startsWith('http') ? sized : `https://control-club.ro${sized}`)
    byHref.set(href, current)
  }
  for (const part of html.split('<div class="slide">').slice(1)) {
    add(part.match(/href="(\/events\/[^"]+)"/)?.[1], part.match(/class="title hover">([^<]+)/)?.[1], part.match(/<img src="([^"]+)"/)?.[1])
  }
  for (const part of html.split('<div class="event">').slice(1)) {
    add(part.match(/href="(\/events\/[^"]+)"/)?.[1], part.match(/class="title">([^<]+)/)?.[1], part.match(/<img src="([^"]+)"/)?.[1])
  }
  return [...byHref.values()].map((event) => ({ title: event.title, urls: [...event.files.values()], venueId: 'control-club' }))
}

async function officialVenuePhotos(placeId) {
  const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      'X-Goog-Api-Key': placesKey,
      'X-Goog-FieldMask': 'displayName,photos',
      Referer: 'http://localhost:5173/',
      Origin: 'http://localhost:5173/',
    },
  })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error?.message || `Places returned ${response.status}`)
  const venue = body.displayName?.text ?? ''
  const photos = (body.photos ?? []).filter((photo) =>
    (photo.authorAttributions ?? []).some((author) => author.displayName?.toLowerCase() === venue.toLowerCase()),
  )
  return { credit: venue, images: photos.map((photo) => photo.name).filter(Boolean) }
}

async function upload(ownerId, fileUrl) {
  const attempt = async (url) => {
    const body = new FormData()
    body.append('file', url)
    body.append('upload_preset', preset)
    body.append('asset_folder', `events/${ownerId}`)
    const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/upload`, {
      method: 'POST',
      body,
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload?.secure_url) throw new Error(payload?.error?.message || `Cloudinary returned ${response.status}`)
    return payload.secure_url
  }
  try {
    return await attempt(fileUrl)
  } catch (error) {
    const smaller = fileUrl.replace('/img/cache/1600/', '/img/cache/640/')
    if (smaller === fileUrl) throw error
    return attempt(smaller)
  }
}

const [controlHtml, venueSnap, eventSnap] = await Promise.all([
  fetchText('https://control-club.ro/'),
  getDocs(collection(db, 'venues')),
  getDocs(collection(db, 'events')),
])
const official = controlPosters(controlHtml)

for (const venue of venueSnap.docs) {
  const placeId = venue.data().googlePlaceId
  if (!placeId) {
    console.log(`skip venue ${venue.id}: no place id`)
    continue
  }
  const photos = await officialVenuePhotos(placeId)
  if (photos.images.length === 0) {
    console.log(`skip venue ${venue.id}: the club published no photos`)
    continue
  }
  await setDoc(
    doc(db, 'venues', venue.id),
    { images: photos.images, imageAttributions: photos.images.map(() => photos.credit) },
    { merge: true },
  )
  console.log(`venue ${venue.id}: ${photos.images.length} club photos`)
}

for (const stored of eventSnap.docs) {
  const data = stored.data()
  if (data.venueId !== 'control-club') {
    await setDoc(doc(db, 'events', stored.id), { images: [] }, { merge: true })
    continue
  }
  const ranked = official
    .map((event) => ({ event, score: score(data.name ?? '', event.title) }))
    .sort((a, b) => b.score - a.score)
  const best = ranked[0]
  if (!best || best.score < 0.6 || best.event.urls.length < 2) {
    await setDoc(doc(db, 'events', stored.id), { images: [] }, { merge: true })
    console.log(`event ${stored.id}: one poster`)
    continue
  }
  const extra = []
  for (const url of best.event.urls.slice(1)) {
    extra.push(await upload(stored.id, url))
  }
  await setDoc(doc(db, 'events', stored.id), { images: extra }, { merge: true })
  console.log(`event ${stored.id}: poster + ${extra.length} more`)
}

process.exit(0)
