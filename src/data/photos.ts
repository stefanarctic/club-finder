const PLACES_PHOTO = /^places\/[^/]+\/photos\/.+/

/** Turns a stored image into something `<img>` can request. Places names stay on Google's servers. */
export function photoUrl(src: string | undefined): string | undefined {
  if (!src) return undefined
  if (!src.startsWith('places/')) return src
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  if (!key || !PLACES_PHOTO.test(src)) return undefined
  const params = new URLSearchParams({ maxHeightPx: '1200', key })
  return `https://places.googleapis.com/v1/${src}/media?${params}`
}

export function photoCredit(src: string | undefined, attribution: string | undefined): string | undefined {
  const credit = attribution?.trim()
  if (credit) return credit
  if (src?.startsWith('places/')) return 'Google'
  return undefined
}
