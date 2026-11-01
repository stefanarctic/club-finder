import { collection, deleteDoc, doc, getDocs, query, setDoc, where } from 'firebase/firestore'
import { eventDocument, venueDocument } from './documents'
import { db } from './firebase'
import type { StoredEvent, Venue } from './types'

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const IMAGE_EXTENSION = /\.(jpe?g|png|webp|gif|heic|heif)$/i

function requireDb() {
  if (!db) throw new Error('Firebase is not configured.')
  return db
}

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || IMAGE_EXTENSION.test(file.name)
}

export async function saveVenue(venue: Venue): Promise<void> {
  await setDoc(doc(requireDb(), 'venues', venue.id), venueDocument(venue))
}

export async function deleteVenue(id: string): Promise<void> {
  const database = requireDb()
  const nights = await getDocs(query(collection(database, 'events'), where('venueId', '==', id)))
  await Promise.all(nights.docs.map((night) => deleteDoc(night.ref)))
  await deleteDoc(doc(database, 'venues', id))
}

export async function saveEvent(event: StoredEvent): Promise<void> {
  await setDoc(doc(requireDb(), 'events', event.id), eventDocument(event))
}

export async function deleteEvent(id: string): Promise<void> {
  await deleteDoc(doc(requireDb(), 'events', id))
}

export async function uploadImage(folder: 'venues' | 'events', ownerId: string, file: File): Promise<string> {
  const cloud = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
  const preset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
  if (!cloud || !preset) {
    throw new Error('Image uploads need VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET.')
  }
  if (!isImageFile(file)) throw new Error('Choose an image file.')
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Images must be 8 MB or smaller.')

  const body = new FormData()
  body.append('file', file)
  body.append('upload_preset', preset)
  body.append('asset_folder', `${folder}/${ownerId}`)

  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/upload`, {
    method: 'POST',
    body,
  })
  const payload = (await response.json().catch(() => null)) as { secure_url?: string; error?: { message?: string } } | null
  if (!response.ok || !payload?.secure_url) {
    throw new Error(payload?.error?.message || 'Could not upload the image.')
  }
  return payload.secure_url
}
