/**
 * Replaces Google Places venue galleries with images published by the clubs.
 *
 *   node --env-file=.env scripts/upload-venue-images.mjs
 */
import { initializeApp } from 'firebase/app'
import { doc, initializeFirestore, setDoc } from 'firebase/firestore'

const cloud = process.env.VITE_CLOUDINARY_CLOUD_NAME
const preset = process.env.VITE_CLOUDINARY_UPLOAD_PRESET
if (!cloud || !preset) {
  console.error('Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET.')
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

async function fetchText(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'club-finder' } })
  if (!response.ok) throw new Error(`${url} returned ${response.status}`)
  return response.text()
}

function controlImages(html) {
  const images = []
  for (const part of html.split('<div class="slide">').slice(1)) {
    const src = part.match(/<img src="([^"]+)"/)?.[1]
    if (!src) continue
    const large = src.replace(/\/img\/cache\/\d+\//, '/img/cache/1600/')
    const absolute = large.startsWith('http') ? large : `https://control-club.ro${large}`
    if (!images.includes(absolute)) images.push(absolute)
    if (images.length === 6) break
  }
  return images
}

function forgeImages(html) {
  const images = []
  for (const match of html.matchAll(/https:\/\/[^"'\s]+\/flyers\/[^"'\s]+-full\.webp/g)) {
    const url = match[0].replace(/&amp;/g, '&')
    if (!images.includes(url)) images.push(url)
    if (images.length === 6) break
  }
  return images
}

async function upload(ownerId, fileUrl) {
  const body = new FormData()
  body.append('file', fileUrl)
  body.append('upload_preset', preset)
  body.append('asset_folder', `venues/${ownerId}`)
  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/upload`, {
    method: 'POST',
    body,
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.secure_url) {
    throw new Error(payload?.error?.message || `Cloudinary returned ${response.status}`)
  }
  return payload.secure_url
}

async function storeVenue(id, sources, credit) {
  const images = []
  for (const source of sources) {
    try {
      images.push(await upload(id, source))
      console.log(`uploaded ${id} ${images.length}`)
    } catch (error) {
      const smaller = source.replace('/img/cache/1600/', '/img/cache/640/')
      if (smaller === source) {
        console.error(`fail ${id}: ${error instanceof Error ? error.message : error}`)
        continue
      }
      images.push(await upload(id, smaller))
      console.log(`uploaded ${id} ${images.length} (640)`)
    }
  }
  if (images.length === 0) throw new Error(`${id} has no uploaded images`)
  await setDoc(
    doc(db, 'venues', id),
    { images, imageAttributions: images.map(() => credit) },
    { merge: true },
  )
  console.log(`stored ${id} ${images.length} images`)
}

const [controlHtml, forgeHtml] = await Promise.all([
  fetchText('https://control-club.ro/'),
  fetchText('https://www.theforge.live/evenimente'),
])

await storeVenue('control-club', controlImages(controlHtml), 'Control Club')
await storeVenue('forge-bucharest', forgeImages(forgeHtml), 'Forge')
process.exit(0)
