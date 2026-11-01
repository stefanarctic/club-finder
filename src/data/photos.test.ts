import { describe, expect, it } from 'vitest'
import { photoUrl } from './photos'

const stored = 'https://res.cloudinary.com/demo/image/upload/v123/venues/club/cover.jpg'

describe('photoUrl', () => {
  it('inserts one Cloudinary delivery transform for the requested size', () => {
    expect(photoUrl(stored, 'thumb')).toBe(
      'https://res.cloudinary.com/demo/image/upload/c_limit,w_240,f_auto,q_auto/v123/venues/club/cover.jpg',
    )
    expect(photoUrl(stored, 'card')).toBe(
      'https://res.cloudinary.com/demo/image/upload/c_limit,w_800,f_auto,q_auto/v123/venues/club/cover.jpg',
    )
    expect(photoUrl(stored, 'cover')).toBe(
      'https://res.cloudinary.com/demo/image/upload/c_limit,w_1600,f_auto,q_auto/v123/venues/club/cover.jpg',
    )
  })

  it('replaces a transform already in front of the version instead of stacking another', () => {
    const once = photoUrl(stored, 'card')
    expect(photoUrl(once, 'thumb')).toBe(
      'https://res.cloudinary.com/demo/image/upload/c_limit,w_240,f_auto,q_auto/v123/venues/club/cover.jpg',
    )
  })

  it('leaves stored URLs that are not Cloudinary deliveries unchanged', () => {
    expect(photoUrl('/photos/club.jpg', 'cover')).toBe('/photos/club.jpg')
    expect(photoUrl('https://firebasestorage.googleapis.com/v0/b/app/o/cover.jpg?alt=media', 'thumb')).toBe(
      'https://firebasestorage.googleapis.com/v0/b/app/o/cover.jpg?alt=media',
    )
  })

  it('keeps a Places photo name off Cloudinary', () => {
    const name = 'places/ChIJ/photos/abc'
    const url = photoUrl(name, 'cover')
    expect(url ?? '').not.toContain('res.cloudinary.com')
    expect(url === undefined || url.includes(`places.googleapis.com/v1/${name}/media`)).toBe(true)
  })
})
