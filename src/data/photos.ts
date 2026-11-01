const PLACES_PHOTO = /^places\/[^/]+\/photos\/.+/
const UPLOAD_MARKER = '/image/upload/'

export type PhotoSize = 'thumb' | 'card' | 'cover'

const WIDTH: Record<PhotoSize, number> = {
  thumb: 240,
  card: 800,
  cover: 1600,
}

/** Inserts one delivery transform. A transform already in front of the version is replaced. */
function cloudinaryDelivery(src: string, transform: string): string {
  const at = src.indexOf(UPLOAD_MARKER)
  if (!src.startsWith('https://res.cloudinary.com/') || at < 0) return src
  const prefix = src.slice(0, at + UPLOAD_MARKER.length)
  const rest = src.slice(at + UPLOAD_MARKER.length)
  const version = rest.match(/(^|\/)(v\d+\/)/)
  if (!version || version.index === undefined) {
    const slash = rest.indexOf('/')
    const first = slash === -1 ? rest : rest.slice(0, slash)
    if (first.includes(',')) return `${prefix}${transform}${rest.slice(slash)}`
    if (rest.startsWith(`${transform}/`)) return src
    return `${prefix}${transform}/${rest}`
  }
  const start = version.index === 0 ? 0 : version.index + 1
  return `${prefix}${transform}/${rest.slice(start)}`
}

/** Turns a stored image into something `<img>` can request. Places names stay on Google's servers. */
export function photoUrl(src: string | undefined, size: PhotoSize = 'card'): string | undefined {
  if (!src) return undefined
  if (src.startsWith('places/')) {
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    if (!key || !PLACES_PHOTO.test(src)) return undefined
    const params = new URLSearchParams({ maxHeightPx: '1200', key })
    return `https://places.googleapis.com/v1/${src}/media?${params}`
  }
  if (src.startsWith('https://res.cloudinary.com/')) {
    return cloudinaryDelivery(src, `c_limit,w_${WIDTH[size]},f_auto,q_auto`)
  }
  return src
}

export function photoCredit(src: string | undefined, attribution: string | undefined): string | undefined {
  const credit = attribution?.trim()
  if (credit) return credit
  if (src?.startsWith('places/')) return 'Google'
  return undefined
}
