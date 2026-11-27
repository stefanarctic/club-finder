import { collection, doc, onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import type { RedeemResult } from '../../shared/ticketing'
import { db, functions } from './firebase'

export type DoorStaff = { uid: string; email: string; displayName: string }

/** Whether this account is on the door list for a night. Only the person themselves and the organizer can read it. */
export function watchStaffAssignment(eventId: string, uid: string, onData: (onList: boolean) => void): Unsubscribe {
  if (!db) {
    onData(false)
    return () => {}
  }
  return onSnapshot(
    doc(db, 'events', eventId, 'staff', uid),
    (snap) => onData(snap.exists()),
    () => onData(false),
  )
}

export function watchDoorStaff(eventId: string, onData: (staff: DoorStaff[]) => void, onError: (message: string) => void): Unsubscribe {
  if (!db) {
    onData([])
    return () => {}
  }
  return onSnapshot(
    collection(db, 'events', eventId, 'staff'),
    (snap) => {
      onData(
        snap.docs
          .map((item) => {
            const data = item.data()
            const email = typeof data.email === 'string' ? data.email : ''
            const displayName = typeof data.displayName === 'string' && data.displayName ? data.displayName : email
            return { uid: item.id, email, displayName }
          })
          .sort((a, b) => a.displayName.localeCompare(b.displayName)),
      )
    },
    (error) => onError(error.message),
  )
}

export async function setDoorStaff(eventId: string, email: string, add: boolean): Promise<void> {
  if (!functions) throw new Error('Firebase isn’t configured.')
  await httpsCallable<{ eventId: string; email: string; add: boolean }, { ok: true }>(functions, 'setDoorStaff')({ eventId, email, add })
}

export async function redeemTicket(eventId: string, payload: string): Promise<RedeemResult> {
  if (!functions) throw new Error('Firebase isn’t configured.')
  const { data } = await httpsCallable<{ eventId: string; payload: string }, RedeemResult>(functions, 'redeemTicket')({ eventId, payload })
  return data
}
