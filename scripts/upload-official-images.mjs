/**
 * Uploads official event posters from the clubs' own sites to Cloudinary
 * and stores the delivery URL on the event. Google Places photos are not copied.
 *
 *   node --env-file=.env scripts/upload-official-images.mjs
 *   node --env-file=.env scripts/upload-official-images.mjs --dry-run
 */
import { initializeApp } from 'firebase/app'
import { doc, getDocs, collection, initializeFirestore, setDoc } from 'firebase/firestore'

const dryRun = process.argv.includes('--dry-run')
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

function decode(value) {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&Icirc;/g, 'Î')
    .replace(/&uacute;/g, 'ú')
    .replace(/&rsquo;/g, '’')
    .replace(/&nbsp;/g, ' ')
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

async function fetchText(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'club-finder' } })
  if (!response.ok) throw new Error(`${url} returned ${response.status}`)
  return response.text()
}

function controlEvents(html) {
  const byHref = new Map()
  const take = (href, title, img, description) => {
    if (!href || !title || !img) return
    const current = byHref.get(href)
    const large = img.includes('/img/cache/640/') ? img.replace('/img/cache/640/', '/img/cache/1600/') : img
    byHref.set(href, {
      href,
      title: decode(title),
      img: current?.img?.includes('/img/cache/1600/') ? current.img : large,
      description: description ? decode(description) : current?.description ?? '',
    })
  }
  for (const part of html.split('<div class="slide">').slice(1)) {
    take(
      part.match(/href="(\/events\/[^"]+)"/)?.[1],
      part.match(/class="title hover">([^<]+)/)?.[1],
      part.match(/<img src="([^"]+)"/)?.[1],
      part.match(/<div class="description">\s*<p>([\s\S]*?)<\/p>/)?.[1],
    )
  }
  for (const part of html.split('<div class="event">').slice(1)) {
    take(
      part.match(/href="(\/events\/[^"]+)"/)?.[1],
      part.match(/class="title">([^<]+)/)?.[1],
      part.match(/<img src="([^"]+)"/)?.[1],
    )
  }
  return [...byHref.values()]
}

function forgeEvents(html) {
  const events = []
  const pattern = /aria-label="([^"]+)"[\s\S]{0,1200}?src="(https:\/\/[^"]+\/flyers\/[^"]+)"/g
  for (const match of html.matchAll(pattern)) {
    const card = match[2]
    const full = card.includes('-card.webp') ? card.replace('-card.webp', '-full.webp') : card
    events.push({ href: '', title: decode(match[1]), img: full, description: '' })
  }
  return events
}

async function officialBlurb(event) {
  if (!event.href.startsWith('/events/')) return event.description
  const html = await fetchText(`https://control-club.ro${event.href}`)
  const content = html.match(/property="og:description" content="([^"]*)"/)?.[1]
  return content ? decode(content) : event.description
}

async function upload(folder, ownerId, fileUrl) {
  const body = new FormData()
  body.append('file', fileUrl)
  body.append('upload_preset', preset)
  body.append('asset_folder', `${folder}/${ownerId}`)
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

const [controlHtml, forgeHtml, venueSnap, eventSnap] = await Promise.all([
  fetchText('https://control-club.ro/'),
  fetchText('https://www.theforge.live/evenimente'),
  getDocs(collection(db, 'venues')),
  getDocs(collection(db, 'events')),
])

const official = [
  ...controlEvents(controlHtml).map((event) => ({ ...event, credit: 'Control Club', venueId: 'control-club' })),
  ...forgeEvents(forgeHtml).map((event) => ({ ...event, credit: 'Forge', venueId: 'forge-bucharest' })),
]

let uploaded = 0
let skipped = 0
for (const stored of eventSnap.docs) {
  const data = stored.data()
  const candidates = official.filter((event) => event.venueId === data.venueId)
  const ranked = candidates
    .map((event) => ({ event, score: score(data.name ?? '', event.title) }))
    .sort((a, b) => b.score - a.score)
  const best = ranked[0]
  if (!best || best.score < 0.6) {
    skipped += 1
    console.log(`skip ${stored.id} (${data.name}) best ${best ? `${best.score.toFixed(2)} ${best.event.title}` : 'none'}`)
    continue
  }
  const source = best.event.img.startsWith('http') ? best.event.img : `https://control-club.ro${best.event.img}`
  let description = best.event.description
  if (!dryRun && best.event.href) {
    try {
      description = await officialBlurb(best.event)
    } catch (error) {
      console.warn(`blurb ${stored.id}: ${error instanceof Error ? error.message : error}`)
    }
  }
  console.log(`match ${stored.id} ${best.score.toFixed(2)} <- ${best.event.title}`)
  if (dryRun) continue
  try {
    const url = await upload('events', stored.id, source)
    const patch = { image: url, imageAttribution: best.event.credit }
    if (description) patch.description = description
    await setDoc(doc(db, 'events', stored.id), patch, { merge: true })
    uploaded += 1
    console.log(`stored ${stored.id}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (source.includes('/img/cache/1600/')) {
      const smaller = source.replace('/img/cache/1600/', '/img/cache/640/')
      try {
        const url = await upload('events', stored.id, smaller)
        const patch = { image: url, imageAttribution: best.event.credit }
        if (description) patch.description = description
        await setDoc(doc(db, 'events', stored.id), patch, { merge: true })
        uploaded += 1
        console.log(`stored ${stored.id} (640)`)
        continue
      } catch (retryError) {
        console.error(`fail ${stored.id}: ${retryError instanceof Error ? retryError.message : retryError}`)
        continue
      }
    }
    console.error(`fail ${stored.id}: ${message}`)
  }
}

const control = venueSnap.docs.find((venue) => venue.id === 'control-club')
if (control && !dryRun) {
  await setDoc(
    doc(db, 'venues', 'control-club'),
    {
      description:
        "Control is one of the most influential clubs in Central and Eastern Europe, with a history of over 16 years. Since its beginning, the club has built on a mix of live events and DJ acts, hosting communities from punk and goth to techno, dark disco, indie, house and funk.",
    },
    { merge: true },
  )
  console.log('updated control-club description from the club about page')
}

console.log(dryRun ? 'dry run' : `uploaded ${uploaded}, skipped ${skipped}, venues ${venueSnap.size}`)
process.exit(0)
