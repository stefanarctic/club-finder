import { collection, deleteDoc, doc, getDocs, query, setDoc, where } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { eventDocument, venueDocument } from './documents'
import { db, storage } from './firebase'
import type { StoredEvent, Venue } from './types'

function requireDb() {
  if (!db) throw new Error('Firebase is not configured.')
  return db
}

function requireStorage() {
  if (!storage) throw new Error('Firebase is not configured.')
  return storage
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
  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${folder}/${ownerId}/${crypto.randomUUID()}.${extension}`
  const stored = ref(requireStorage(), path)
  await uploadBytes(stored, file, { contentType: file.type || 'image/jpeg' })
  return getDownloadURL(stored)
}
