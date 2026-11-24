/**
 * Imports upcoming nights from Forge, Control Club and Omen Bar.
 * The place is stored on each event. There is no venue document.
 *
 *   node --env-file=.env scripts/import-nights.mjs --dry-run
 *   node --env-file=.env scripts/import-nights.mjs
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { initializeApp } from 'firebase/app'
import { doc, getDoc, initializeFirestore } from 'firebase/firestore'

const dryRun = process.argv.includes('--dry-run')
const TODAY = '2026-11-24'

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
const CLOUD = process.env.VITE_CLOUDINARY_CLOUD_NAME
const PRESET = process.env.VITE_CLOUDINARY_UPLOAD_PRESET

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

const NAMED = {
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  nbsp: ' ',
  bull: '·',
  middot: '·',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  ldquo: '“',
  rdquo: '”',
  acirc: 'â',
  Acirc: 'Â',
  icirc: 'î',
  Icirc: 'Î',
  atilde: 'ã',
  eacute: 'é',
  uacute: 'ú',
}

function decode(value) {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);|&#x([0-9a-f]+);|&([a-z]+);/gi, (entity, decimal, hex, named) => {
      if (decimal) return String.fromCodePoint(Number(decimal))
      if (hex) return String.fromCodePoint(Number.parseInt(hex, 16))
      return NAMED[named] ?? entity
    })
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function stripBoilerplate(text) {
  return text
    .replace(/\*+\s*Children up to[\s\S]*$/i, '')
    .replace(/Serving and alcohol consumption[\s\S]*$/i, '')
    .trim()
}

function clip(text, max = 700) {
  const clean = stripBoilerplate(text).replace(/\s+\n/g, '\n').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('\n'))
  return `${(end > 240 ? cut.slice(0, end + 1) : cut).trim()}…`
}

function ronToEur(ron) {
  return Math.max(0, Math.round(ron / 5))
}

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

function offsetFor(date) {
  const probe = new Date(`${date}T12:00:00Z`)
  const part = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Bucharest', timeZoneName: 'longOffset' })
    .formatToParts(probe)
    .find((item) => item.type === 'timeZoneName')?.value
  const match = part?.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/)
  if (!match) return '+02:00'
  const hours = String(Math.abs(Number(match[1]))).padStart(2, '0')
  const sign = match[1].startsWith('-') ? '-' : '+'
  return `${sign}${hours}:${match[2] ?? '00'}`
}

function startsAt(date, time) {
  const clock = /^\d{2}:\d{2}$/.test(time) ? time : '20:00'
  return `${date}T${clock}:00${offsetFor(date)}`
}

function durationHours(start, end) {
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return null
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let minutes = eh * 60 + em - (sh * 60 + sm)
  if (minutes <= 0) minutes += 24 * 60
  return Math.min(48, Math.max(1, Math.round(minutes / 60)))
}

function genresFrom(blob) {
  const text = blob.replace(/\(\s*live\s*\)/gi, ' ').toLowerCase()
  const genres = []
  if (/\btechno\b|fjaak|nobu|\bwarehouse\b|\bacid\b|\brave\b|\belectronic\b/.test(text)) genres.push('techno')
  if (/\bhouse\b|disco|permanent vacation|boogie/.test(text)) genres.push('house')
  if (/hip-?hop|\brap\b|\btrap\b|balkan/.test(text)) genres.push('hip-hop')
  if (/reggaeton|perreo|\blatin\b/.test(text)) genres.push('latin')
  if (/queer|lgbt/.test(text)) genres.push('queer')
  if (/\blive\b|concert|\bband\b|spoken word|jazz|\brock\b|metal/.test(text)) genres.push('live')
  if (genres.length === 0) genres.push('commercial')
  return genres.slice(0, 3)
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'club-finder' } })
  if (!response.ok) throw new Error(`${url} returned ${response.status}`)
  return response.text()
}

function jsonLd(html) {
  const blocks = []
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      blocks.push(JSON.parse(match[1]))
    } catch {
      /* a listing page can carry a broken extra block */
    }
  }
  return blocks
}

function forgeEvents(html) {
  const payload = html.slice(html.indexOf('$_TSR.router='))
  const found = [...payload.matchAll(/\$R\[\d+\]=\{id:"([^"]+)",title:"((?:\\.|[^"\\])*)",slug:"([^"]+)"/g)]
  const events = []
  for (const match of found) {
    const from = match.index
    const next = payload.indexOf(',$R[', from + 10)
    const body = payload.slice(from, next > from ? next : from + 5000)
    const str = (name) => {
      const item = body.match(new RegExp(`${name}:"((?:\\\\.|[^"\\\\])*)"`))
      return item ? JSON.parse(`"${item[1]}"`) : ''
    }
    const num = (name) => {
      const item = body.match(new RegExp(`${name}:(-?\\d+(?:\\.\\d+)?)`))
      return item ? Number(item[1]) : null
    }
    const date = str('event_date')
    if (!date || date < TODAY) continue
    const start = str('start_time').slice(0, 5)
    const end = str('end_time').slice(0, 5)
    const title = JSON.parse(`"${match[2]}"`)
    const ron = num('ticket_price_from') ?? num('door_price')
    const free = /is_free:true/.test(body) || /free entry/i.test(str('description'))
    const stage = str('stage').replaceAll('_', ' ')
    const about = clip(str('description') || str('short_description'))
    events.push({
      id: `forge-${match[3]}`.slice(0, 140),
      name: title,
      startsAt: startsAt(date, start),
      durationHours: durationHours(start, end) ?? 6,
      image: str('flyer_url'),
      imageAttribution: 'Forge',
      averagePrice: free ? 0 : ronToEur(ron ?? 0),
      priceNote: free ? 'Free entry.' : ron != null ? `Tickets listed from ${ron} RON.` : '',
      genres: genresFrom(`${title} ${about} ${stage === 'piperoom' ? 'techno electronic' : ''}`),
      description: [stage ? `Piperoom and courtyard: ${stage}.` : '', about, free ? 'Free entry.' : ron != null ? `Tickets listed from ${ron} RON.` : '']
        .filter(Boolean)
        .join(' ')
        .replace(/^Piperoom and courtyard: piperoom\. /, 'Piperoom. ')
        .replace('Piperoom and courtyard: courtyard. ', 'Courtyard. ')
        .replace('Piperoom and courtyard: full venue. ', 'Full venue. '),
      venueKey: 'forge',
    })
  }
  return events
}

function controlPrice(text) {
  if (/free entry|intrare liber[aă]|gratuit/i.test(text)) return 0
  const amounts = [...text.matchAll(/(\d{2,3})\s*(?:lei|ron)\b/gi)].map((match) => Number(match[1]))
  if (amounts.length === 0) return null
  return Math.min(...amounts)
}

async function controlTicketPrices(ids) {
  const prices = new Map()
  for (const id of [...new Set(ids.filter(Boolean))]) {
    const body = new URLSearchParams({ performance_id: String(id) })
    const response = await fetch('https://control-club.ro/php/buy_tickets.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'club-finder' },
      body,
    })
    const data = await response.json().catch(() => null)
    const amounts = (data?.price_categories ?? []).map((category) => Number(category.price)).filter((price) => price > 0)
    if (amounts.length > 0) prices.set(String(id), Math.min(...amounts))
  }
  return prices
}

async function listedRon(url) {
  if (!url) return null
  const html = await fetchText(url)
  const text = html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
  if (/0 lei \(Acces pe bază de bilet cu valoare 0\)/i.test(text)) return 0
  const general = text.match(/(\d+)\s*lei\s*\((?:Acces general|Pre[tț] normal)/i)
  if (general) return Number(general[1])
  const labeled = [...text.matchAll(/(\d+)\s*lei\s*\((?!Bilet student)([^)]{0,40})\)/gi)]
    .map((match) => Number(match[1]))
    .filter((price) => price > 0 && price < 300)
  if (labeled.length > 0) return Math.min(...labeled)
  const plain = [...text.matchAll(/(\d+)\s*lei\b/gi)].map((match) => Number(match[1])).filter((price) => price > 5 && price < 300)
  return plain.length > 0 ? Math.min(...plain) : null
}

async function controlEventsFromPages(pages, ticketPrices) {
  const byKey = new Map()
  for (const page of pages) {
    const ticketRaw = page.html.match(/data-ticket='([^']+)'/)?.[1]
    const ticket = ticketRaw ? JSON.parse(ticketRaw) : null
    const title = (ticket?.title || page.html.match(/<h2>\s*([^<]+)/)?.[1] || '').trim()
    const date = ticket?.date || ''
    if (!title || !date || date < TODAY) continue
    const text = decode(page.html.match(/<div class="content">([\s\S]*?)<\/div>\s*<\/div>/)?.[1] ?? '')
    const heading = decode(page.html.match(/<h2>\s*([^<]+)/)?.[1] ?? title)
    if (/\[\s*postponed\s*\]|this show is postponed/i.test(`${title} ${heading} ${text}`)) continue
    const tags = [...page.html.matchAll(/class="tag[^"]*">([^<]+)/g)].map((match) => decode(match[1]))
    const hour = page.html.match(/class="hour">\s*(\d{1,2}:\d{2})/)?.[1]
      || text.match(/Open Doors:\s*(\d{1,2}:\d{2})/i)?.[1]
      || text.match(/Doors(?:\s+at)?:\s*(\d{1,2}:\d{2})/i)?.[1]
      || ''
    const clock = hour ? hour.padStart(5, '0') : '20:00'
    const calendar = page.html.match(/dates=(\d{8}T\d{6})Z\/(\d{8}T\d{6})Z/)
    const nights = tags.some((tag) => /nights/i.test(tag))
    let duration = nights || Number(clock.slice(0, 2)) >= 21 ? durationHours(clock, '06:00') ?? 6 : 3
    if (calendar) {
      const start = Date.parse(`${calendar[1].slice(0, 4)}-${calendar[1].slice(4, 6)}-${calendar[1].slice(6, 8)}T${calendar[1].slice(9, 11)}:${calendar[1].slice(11, 13)}:${calendar[1].slice(13, 15)}Z`)
      const end = Date.parse(`${calendar[2].slice(0, 4)}-${calendar[2].slice(4, 6)}-${calendar[2].slice(6, 8)}T${calendar[2].slice(9, 11)}:${calendar[2].slice(11, 13)}:${calendar[2].slice(13, 15)}Z`)
      const hours = Math.round((end - start) / 3600000)
      if (hours >= 4 && hours <= 48) duration = hours
    }
    const room = decode(page.html.match(/class="room">([^<]+)/)?.[1] ?? '')
    const performanceId = ticket?.performance_id ? String(ticket.performance_id) : ''
    let ron = ticketPrices.get(performanceId) ?? controlPrice(text)
    if (ron == null) ron = await listedRon(ticket?.ticket_url)
    if (ron == null) {
      const links = [...page.html.matchAll(/href="(https?:\/\/(?:www\.)?iabilet\.ro\/[^"]+)"/g)].map((match) => match[1])
      for (const link of links) {
        ron = await listedRon(link)
        if (ron != null) break
      }
    }
    const img = page.html.match(/<img src="(\/img\/cache\/800\/[^"]+)"/)?.[1]
    const pretty = !/^\/events\/[0-9a-f]{16,}$/i.test(page.href)
    const slug = pretty ? page.href.split('/').pop() : slugify(title)
    const event = {
      id: `control-${decodeURIComponent(slug)}`.slice(0, 140),
      name: decode(title).replace(/\s+/g, ' '),
      startsAt: startsAt(date, clock),
      durationHours: duration,
      image: img ? `https://control-club.ro${img}` : '',
      imageAttribution: 'Control Club',
      averagePrice: ron == null ? null : ron === 0 ? 0 : ronToEur(ron),
      priceNote: ron == null ? '' : ron === 0 ? 'Free entry.' : `Tickets listed from ${ron} RON.`,
      genres: genresFrom(`${title} ${tags.join(' ')} ${text.slice(0, 400)}`),
      description: [room, clip(text), ron == null ? '' : ron === 0 ? 'Free entry.' : `Tickets listed from ${ron} RON.`]
        .filter(Boolean)
        .join(' '),
      venueKey: 'control',
    }
    const key = `${date}|${event.name.toLowerCase()}`
    const current = byKey.get(key)
    if (!current || (pretty && !current.pretty)) byKey.set(key, { ...event, pretty })
  }
  return [...byKey.values()].map(({ pretty, ...event }) => event)
}

function omenEvents(pages) {
  const events = []
  for (const page of pages) {
    const blocks = jsonLd(page.html).flatMap((block) => (Array.isArray(block) ? block : [block]))
    const event = blocks.find((block) => block['@type'] === 'Event' || (Array.isArray(block['@type']) && block['@type'].includes('Event')))
    const start = event?.startDate || page.html.match(/datetime="([^"]+)"/)?.[1] || ''
    const date = start.slice(0, 10)
    if (!date || date < TODAY) continue
    const time = start.length >= 16 ? start.slice(11, 16) : '20:00'
    const name = event?.name || page.html.match(/<h1[^>]*>([^<]+)/)?.[1] || ''
    const offers = Array.isArray(event?.offers) ? event.offers : event?.offers ? [event.offers] : []
    const ron = offers.map((offer) => Number(offer.price)).find((price) => Number.isFinite(price) && price > 0)
      ?? controlPrice(decode(page.html))
    const about = clip(decode(event?.description || page.html.match(/<p>([\s\S]*?)<\/p>/)?.[1] || ''))
    const image = typeof event?.image === 'string' ? event.image : event?.image?.[0] || ''
    events.push({
      id: `omen-${slugify(name)}-${date}`,
      name: decode(name).replace(/\s+/g, ' ').replace(/\s*@\s*Omen Bar\s*/i, '').trim(),
      startsAt: startsAt(date, time),
      durationHours: 3,
      image,
      imageAttribution: 'Omen Bar',
      averagePrice: ron == null ? null : ronToEur(ron),
      priceNote: ron == null ? '' : `Tickets listed from ${ron} RON.`,
      genres: genresFrom(`${name} ${about} live rock`),
      description: [about, ron == null ? '' : `Tickets listed from ${ron} RON.`].filter(Boolean).join(' '),
      venueKey: 'omen',
    })
  }
  return events
}

const VENUES = {
  forge: {
    search: 'Forge Bucharest Pantelimon',
    fallback: {
      name: 'Forge',
      venueType: 'club',
      neighbourhood: 'Pantelimon',
      address: 'Șoseaua Pantelimon 1A, intrare din Strada Ziduri Moși, București',
      latitude: 44.448702,
      longitude: 26.133668,
      genres: ['techno'],
      description: 'Industrial club on Șoseaua Pantelimon 1A, entered from Strada Ziduri Moși.',
      phone: '+40 725 517 170',
      website: 'https://www.theforge.live',
    },
  },
  control: {
    placeId: 'ChIJJ0NP5kb_sUARywqM81TfZD0',
    fallback: {
      name: 'Control Club',
      venueType: 'club',
      neighbourhood: 'Universitate',
      address: 'Strada Constantin Mille 4, București',
      latitude: 44.435449,
      longitude: 26.097076,
      genres: ['live'],
      description: 'Club on Strada Constantin Mille 4, with live shows and club nights.',
      phone: '+40 733 927 861',
      website: 'https://www.control-club.ro',
    },
  },
  omen: {
    search: 'Omen Bar Gabroveni Bucharest',
    fallback: {
      name: 'Omen Bar',
      venueType: 'bar',
      neighbourhood: 'Old Town',
      address: 'Strada Gabroveni 14, București',
      latitude: 44.4312225,
      longitude: 26.1023629,
      genres: ['live'],
      description: 'Rock bar on Strada Gabroveni 14, in Bucharest Old Town.',
      phone: '+40 721 505 851',
      website: 'https://omenbar.com',
    },
  },
}

function credit(photo) {
  const names = (photo.authorAttributions ?? []).map((author) => author.displayName?.trim()).filter(Boolean)
  return names.length > 0 ? `${names.join(', ')} · Google` : 'Google'
}

function venueTypeFromGoogle(types) {
  for (const group of TYPE_GROUPS) {
    if (types.some((type) => group.names.includes(type))) return group.type
  }
  return 'club'
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
    rating: typeof place.rating === 'number' ? place.rating : 0,
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

async function lookupVenue(spec) {
  if (!PLACES_KEY) return null
  if (spec.placeId) {
    return toPlace(await placesFetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(spec.placeId)}`, {
      headers: { 'X-Goog-FieldMask': FIELD_MASK },
    }))
  }
  const body = await placesFetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-FieldMask': FIELD_MASK.split(',').map((field) => `places.${field}`).join(','),
    },
    body: JSON.stringify({
      textQuery: spec.search,
      locationBias: { circle: { center: { latitude: spec.fallback.latitude, longitude: spec.fallback.longitude }, radius: 800 } },
      maxResultCount: 5,
    }),
  })
  const places = body.places ?? []
  const named = spec === VENUES.forge
    ? places.filter((place) => /forge/i.test(place.displayName?.text ?? ''))
    : places.filter((place) => /omen/i.test(place.displayName?.text ?? ''))
  const match = named[0] ?? null
  return match ? toPlace(match) : null
}

function venueDocument(spec, fresh) {
  const base = spec.fallback
  return {
    name: fresh?.name || base.name,
    venueType: fresh?.venueType || base.venueType,
    neighbourhood: base.neighbourhood,
    address: fresh?.address || base.address,
    latitude: fresh?.latitude ?? base.latitude,
    longitude: fresh?.longitude ?? base.longitude,
    images: fresh?.images?.length ? fresh.images : [],
    imageAttributions: fresh?.images?.length ? fresh.imageAttributions : [],
    rating: fresh?.rating ?? 0,
    priceLevel: fresh?.priceLevel ?? 2,
    hours: fresh?.hours || '',
    genres: base.genres,
    description: fresh?.description || base.description,
    phone: fresh?.phone || base.phone,
    website: fresh?.website || base.website,
    mapsUrl: fresh?.mapsUrl || '',
    googlePlaceId: fresh?.googlePlaceId || '',
  }
}

async function uploadPoster(eventId, fileUrl) {
  if (!fileUrl || !CLOUD || !PRESET || dryRun) return fileUrl
  const body = new FormData()
  body.append('file', fileUrl)
  body.append('upload_preset', PRESET)
  body.append('asset_folder', `events/${eventId}`)
  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(CLOUD)}/image/upload`, { method: 'POST', body })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.secure_url) {
    console.warn(`poster ${eventId}: ${payload?.error?.message || response.status}. Keeping the source URL.`)
    return fileUrl
  }
  return payload.secure_url
}

async function accessToken() {
  const config = JSON.parse(readFileSync(join(homedir(), '.config', 'configstore', 'firebase-tools.json'), 'utf8'))
  const refresh = config.tokens?.refresh_token
  if (!refresh) throw new Error('Firebase CLI is not signed in.')
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refresh,
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
  })
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const payload = await response.json().catch(() => null)
  if (!payload?.access_token) throw new Error('Could not refresh the Firebase CLI session.')
  return payload.access_token
}

function fieldValue(value) {
  if (typeof value === 'string') return { stringValue: value }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(fieldValue) } }
  return {
    mapValue: {
      fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, fieldValue(item)])),
    },
  }
}

async function putEvent(token, id, data) {
  const project = process.env.VITE_FIREBASE_PROJECT_ID
  const url = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/events?documentId=${encodeURIComponent(id)}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: fieldValue(data).mapValue.fields }),
  })
  if (response.ok) return
  const detail = (await response.text()).replace(/\s+/g, ' ').slice(0, 240)
  throw new Error(`${id}: ${detail}`)
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
  const [forgeHtml, controlHtml, omenListing] = await Promise.all([
    fetchText('https://www.theforge.live/evenimente'),
    fetchText('https://control-club.ro/'),
    fetchText('https://tics.ro/locatie/1457'),
  ])
  const controlHrefs = [...new Set([...controlHtml.matchAll(/href="(\/events\/[^"]+)"/g)].map((match) => match[1]))]
  const controlPages = []
  for (const href of controlHrefs) {
    controlPages.push({ href, html: await fetchText(`https://control-club.ro${href}`) })
  }
  const omenHrefs = [...omenListing.matchAll(/https:\/\/tics\.ro\/eveniment\/[a-z0-9-]+/g)].map((match) => match[0])
  const omenPages = []
  for (const href of [...new Set(omenHrefs)]) {
    omenPages.push({ href, html: await fetchText(href) })
  }

  const performanceIds = controlPages.flatMap((page) => {
    const raw = page.html.match(/data-ticket='([^']+)'/)?.[1]
    if (!raw) return []
    try {
      const id = JSON.parse(raw).performance_id
      return id ? [String(id)] : []
    } catch {
      return []
    }
  })
  const ticketPrices = await controlTicketPrices(performanceIds)
  const nights = [
    ...forgeEvents(forgeHtml),
    ...(await controlEventsFromPages(controlPages, ticketPrices)),
    ...omenEvents(omenPages),
  ].sort((a, b) => a.startsAt.localeCompare(b.startsAt))

  for (const night of nights) {
    if (night.averagePrice == null) console.log(`no public price: ${night.startsAt.slice(0, 10)} ${night.name}`)
  }

  const venues = new Map()
  for (const [key, spec] of Object.entries(VENUES)) {
    try {
      const fresh = await lookupVenue(spec)
      venues.set(key, venueDocument(spec, fresh))
      console.log(`Maps: ${venues.get(key).name} (${venues.get(key).venueType})`)
    } catch (error) {
      console.warn(`Maps lookup failed for ${key}: ${error instanceof Error ? error.message : error}`)
      venues.set(key, venueDocument(spec, null))
    }
  }

  let stored = 0
  let skipped = 0
  const token = dryRun ? '' : await accessToken()
  for (const night of nights) {
    if (night.averagePrice == null) {
      console.log(`skip ${night.id} — no ticket price on the page`)
      skipped += 1
      continue
    }
    const venue = venues.get(night.venueKey)
    const ref = doc(db, 'events', night.id)
    if (!dryRun && (await getDoc(ref)).exists()) {
      console.log(`exists ${night.id}`)
      skipped += 1
      continue
    }
    const image = await uploadPoster(night.id, night.image)
    const payload = {
      name: night.name,
      startsAt: night.startsAt,
      durationHours: night.durationHours,
      image,
      images: [],
      imageAttribution: night.imageAttribution,
      averagePrice: night.averagePrice,
      currency: 'EUR',
      genres: night.genres,
      description: night.description.slice(0, 3900),
      venue,
    }
    console.log(`${dryRun ? 'would store' : 'store'} ${night.startsAt.slice(0, 16)} ${night.averagePrice}€ ${night.genres.join('/')} ${night.name}`)
    if (dryRun) continue
    await putEvent(token, night.id, payload)
    stored += 1
  }
  console.log(dryRun ? `dry run: ${nights.length} nights, skipped ${skipped}` : `stored ${stored}, skipped ${skipped}`)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}

process.exit(0)
