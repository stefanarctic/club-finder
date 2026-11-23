import { collection, doc, onSnapshot, setDoc, updateDoc, type Unsubscribe } from 'firebase/firestore'
import { db } from './firebase'
import { BUDGETS, GENRES, ROLES, type Account, type Genre, type Role } from './types'

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function parseAccount(id: string, data: unknown): Account | null {
  if (!data || typeof data !== 'object') return null
  const raw = data as Record<string, unknown>
  const email = text(raw.email)
  const role = ROLES.find((item) => item === raw.role)
  if (!email || !role) return null
  const budget = BUDGETS.find((item) => item === raw.budget) ?? null
  return {
    id,
    displayName: text(raw.displayName) || email,
    email,
    photoURL: text(raw.photoURL),
    role,
    genres: Array.isArray(raw.genres) ? raw.genres.filter((item): item is Genre => GENRES.includes(item as Genre)) : [],
    budget,
  }
}

function requireDb() {
  if (!db) throw new Error('Firebase is not configured.')
  return db
}

export function watchAccount(
  uid: string,
  onData: (account: Account | null) => void,
  onError: (message: string) => void,
): Unsubscribe {
  return onSnapshot(
    doc(requireDb(), 'users', uid),
    (snap) => onData(snap.exists() ? parseAccount(snap.id, snap.data()) : null),
    (error) => onError(error.message),
  )
}

export function watchAccounts(onData: (accounts: Account[]) => void, onError: (message: string) => void): Unsubscribe {
  return onSnapshot(
    collection(requireDb(), 'users'),
    (snap) => {
      onData(
        snap.docs
          .flatMap((item) => {
            const account = parseAccount(item.id, item.data())
            return account ? [account] : []
          })
          .sort((a, b) => a.displayName.localeCompare(b.displayName)),
      )
    },
    (error) => onError(error.message),
  )
}

export async function createAccount(account: Account): Promise<void> {
  await setDoc(doc(requireDb(), 'users', account.id), {
    displayName: account.displayName.trim(),
    email: account.email.trim(),
    photoURL: account.photoURL.trim(),
    role: 'user' satisfies Role,
    genres: account.genres,
    budget: account.budget,
  })
}

export async function updateAccount(
  uid: string,
  patch: Partial<Pick<Account, 'displayName' | 'photoURL' | 'genres' | 'budget'>>,
): Promise<void> {
  const next: Record<string, unknown> = {}
  if (patch.displayName != null) next.displayName = patch.displayName.trim()
  if (patch.photoURL != null) next.photoURL = patch.photoURL.trim()
  if (patch.genres) next.genres = patch.genres
  if ('budget' in patch) next.budget = patch.budget
  await updateDoc(doc(requireDb(), 'users', uid), next)
}

export async function setAccountRole(uid: string, role: 'user' | 'organizer'): Promise<void> {
  await updateDoc(doc(requireDb(), 'users', uid), { role })
}
