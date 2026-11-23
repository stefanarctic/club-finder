import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut, type User } from 'firebase/auth'
import { createAccount, setAccountRole, updateAccount, watchAccount, watchAccounts } from '../data/accounts'
import { auth } from '../data/firebase'
import type { Account, Budget, Genre } from '../data/types'
import { useSession } from './session'

type AuthApi = {
  ready: boolean
  user: User | null
  account: Account | null
  people: Account[]
  signIn: (email: string, password: string) => Promise<void>
  signUp: (input: { name: string; email: string; password: string; genres: Genre[]; budget: Budget | null }) => Promise<void>
  signOut: () => Promise<void>
  saveProfile: (patch: { displayName: string; photoURL: string }) => Promise<void>
  setRole: (uid: string, role: 'user' | 'organizer') => Promise<void>
}

const AuthContext = createContext<AuthApi | null>(null)

export function canManage(account: Account | null): boolean {
  return account?.role === 'organizer' || account?.role === 'admin'
}

export function canEditEvent(account: Account | null, createdBy: string | undefined): boolean {
  if (!account) return false
  if (account.role === 'admin') return true
  return account.role === 'organizer' && createdBy === account.id
}

function sameGenres(a: Genre[], b: Genre[]): boolean {
  return a.length === b.length && a.every((genre, index) => genre === b[index])
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const session = useSession()
  const [ready, setReady] = useState(!auth)
  const [user, setUser] = useState<User | null>(null)
  const [account, setAccount] = useState<Account | null>(null)
  const [people, setPeople] = useState<Account[]>([])
  const skipWrite = useRef(false)
  const accountRef = useRef<Account | null>(null)
  accountRef.current = account

  useEffect(() => {
    if (!auth) return
    return onAuthStateChanged(auth, (next) => {
      setUser(next)
      setReady(true)
    })
  }, [])

  useEffect(() => {
    if (!user) {
      setAccount(null)
      return
    }
    return watchAccount(
      user.uid,
      (next) => setAccount(next),
      () => setAccount(null),
    )
  }, [user])

  useEffect(() => {
    if (account?.role !== 'admin') {
      setPeople([])
      return
    }
    return watchAccounts(
      (next) => setPeople(next),
      () => setPeople([]),
    )
  }, [account?.role])

  useEffect(() => {
    if (!account) return
    skipWrite.current = true
    session.setInterests(account.genres, account.budget)
    // Hydrate once per signed-in profile. Later edits flow from the session back to the account.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id])

  useEffect(() => {
    const current = accountRef.current
    if (!current) return
    if (skipWrite.current) {
      skipWrite.current = false
      return
    }
    if (sameGenres(current.genres, session.genres) && current.budget === session.budget) return
    const timer = window.setTimeout(() => {
      void updateAccount(current.id, { genres: session.genres, budget: session.budget }).catch(() => {})
    }, 400)
    return () => window.clearTimeout(timer)
  }, [session.genres, session.budget])

  const api = useMemo<AuthApi>(() => {
    return {
      ready,
      user,
      account,
      people,
      async signIn(email, password) {
        if (!auth) throw new Error('Firebase isn’t configured.')
        await signInWithEmailAndPassword(auth, email.trim(), password)
      },
      async signUp({ name, email, password, genres, budget }) {
        if (!auth) throw new Error('Firebase isn’t configured.')
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password)
        await createAccount({
          id: credential.user.uid,
          displayName: name.trim(),
          email: credential.user.email ?? email.trim(),
          photoURL: '',
          role: 'user',
          genres,
          budget,
        })
      },
      async signOut() {
        if (!auth) return
        await firebaseSignOut(auth)
      },
      async saveProfile(patch) {
        if (!user) throw new Error('Sign in first.')
        await updateAccount(user.uid, patch)
      },
      async setRole(uid, role) {
        await setAccountRole(uid, role)
      },
    }
  }, [ready, user, account, people])

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>
}

export function useAccount(): AuthApi {
  const api = useContext(AuthContext)
  if (!api) throw new Error('useAccount must be used inside <AuthProvider>')
  return api
}

export function authError(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code: string }).code) : ''
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found' || code === 'auth/invalid-login-credentials') {
    return 'That email or password doesn’t match an account.'
  }
  if (code === 'auth/email-already-in-use') return 'An account already uses that email.'
  if (code === 'auth/weak-password') return 'Use at least 6 characters.'
  if (code === 'auth/invalid-email') return 'Enter a valid email.'
  if (code === 'auth/too-many-requests') return 'Too many attempts. Wait a moment and try again.'
  return error instanceof Error ? error.message : 'Something went wrong.'
}
