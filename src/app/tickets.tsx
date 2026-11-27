import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../data/firebase'
import { clearKeyCaches, emptyKeyCache, readKeyCache, writeKeyCache, type KeyCache, type TicketKey } from '../data/ticketCodes'
import {
  parsePass,
  parseStock,
  tierRemaining,
  tiersFor,
  type AvailableTier,
  type EventStock,
  type Pass,
} from '../data/tickets'
import { useAccount } from './auth'

/** Keys stay wanted a while after the night, matching the server's grace period. */
const KEY_GRACE_MS = 48 * 60 * 60 * 1000

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

type TicketsApi = {
  signedIn: boolean
  passes: Pass[]
  /** Server-side stock per event, public. */
  stock: Record<string, EventStock>
  tiersFor: (event: { id: string; averagePrice: number }) => AvailableTier[]
  purchase: (input: { eventId: string; requestId: string; lines: { tierId: string; quantity: number }[] }) => Promise<Result<{ ticketIds: string[] }>>
  keyFor: (pass: Pass) => TicketKey | null
  /** Server time minus device time. */
  clockOffsetMs: number
  keysError: string | null
  refreshKeys: () => void
  resetKey: (ticketId: string) => Promise<Result>
}

type KeysResponse = { serverTime: number; keys: ({ ticketId: string } & TicketKey)[] }
type ResetResponse = { serverTime: number } & { ticketId: string } & TicketKey

const TicketsContext = createContext<TicketsApi | null>(null)

export function callableError(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code: unknown }).code) : ''
  if (code === 'functions/internal' || code === 'functions/unavailable' || code === 'functions/deadline-exceeded') {
    return typeof navigator !== 'undefined' && !navigator.onLine ? 'You’re offline. Try again with signal.' : 'Something went wrong. Try again.'
  }
  if (code === 'functions/unauthenticated' && error instanceof Error && error.message.includes('App Check')) {
    return 'This browser couldn’t be verified. Reload and try again.'
  }
  return error instanceof Error && error.message ? error.message : 'Something went wrong. Try again.'
}

export function TicketsProvider({ children }: { children: ReactNode }) {
  const { ready, user } = useAccount()
  const uid = user?.uid ?? null
  const [passes, setPasses] = useState<Pass[]>([])
  const [stock, setStock] = useState<Record<string, EventStock>>({})
  const [cache, setCache] = useState<KeyCache>(emptyKeyCache)
  const [keysError, setKeysError] = useState<string | null>(null)
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine)
  const [refreshTick, setRefreshTick] = useState(0)
  const attempted = useRef<string | null>(null)
  const uidRef = useRef(uid)
  uidRef.current = uid

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  useEffect(() => {
    if (!db) return
    return onSnapshot(
      collection(db, 'ticketStock'),
      (snap) => setStock(Object.fromEntries(snap.docs.map((item) => [item.id, parseStock(item.data())]))),
      () => setStock({}),
    )
  }, [])

  useEffect(() => {
    attempted.current = null
    setKeysError(null)
    if (!uid) {
      setPasses([])
      setCache(emptyKeyCache())
      if (ready) clearKeyCaches()
      return
    }
    setCache(readKeyCache(uid))
    if (!db) return
    return onSnapshot(
      query(collection(db, 'tickets'), where('uid', '==', uid)),
      (snap) => {
        setPasses(
          snap.docs.flatMap((item) => {
            const pass = parsePass(item.id, item.data())
            return pass ? [pass] : []
          }),
        )
      },
      () => setPasses([]),
    )
  }, [uid, ready])

  const storeCache = useCallback(
    (update: (current: KeyCache) => KeyCache) => {
      setCache((current) => {
        const next = update(current)
        if (uid) writeKeyCache(uid, next)
        return next
      })
    },
    [uid],
  )

  // Fetch keys whenever a live pass has none on this device, or its key was reset elsewhere.
  useEffect(() => {
    if (!uid || !functions || !online) return
    const now = Date.now()
    const missing = passes.filter(
      (pass) => pass.status === 'valid' && Date.parse(pass.endsAt) + KEY_GRACE_MS > now && cache.keys[pass.id]?.keyVersion !== pass.keyVersion,
    )
    if (missing.length === 0) return
    const signature = `${refreshTick}|${missing.map((pass) => `${pass.id}:${pass.keyVersion}`).join(',')}`
    if (attempted.current === signature) return
    attempted.current = signature

    const call = httpsCallable<void, KeysResponse>(functions, 'getTicketKeys')
    const sentAt = Date.now()
    call()
      .then(({ data }) => {
        if (uidRef.current !== uid) return
        const receivedAt = Date.now()
        const keys: Record<string, TicketKey> = {}
        for (const entry of data.keys) keys[entry.ticketId] = { keyVersion: entry.keyVersion, key: entry.key }
        storeCache(() => ({ offsetMs: data.serverTime - (sentAt + receivedAt) / 2, keys }))
        setKeysError(null)
      })
      .catch((error) => {
        if (uidRef.current === uid) setKeysError(callableError(error))
      })
  }, [uid, online, passes, cache, refreshTick, storeCache])

  const purchase = useCallback<TicketsApi['purchase']>(async ({ eventId, requestId, lines }) => {
    if (!functions) return { ok: false, error: 'Ticket sales aren’t set up yet.' }
    try {
      const call = httpsCallable<{ eventId: string; requestId: string; lines: { tierId: string; quantity: number }[] }, { orderId: string; ticketIds: string[] }>(
        functions,
        'issueTickets',
      )
      const { data } = await call({ eventId, requestId, lines })
      return { ok: true, ticketIds: data.ticketIds }
    } catch (error) {
      return { ok: false, error: callableError(error) }
    }
  }, [])

  const resetKey = useCallback<TicketsApi['resetKey']>(
    async (ticketId) => {
      if (!functions) return { ok: false, error: 'Ticket sales aren’t set up yet.' }
      try {
        const { data } = await httpsCallable<{ ticketId: string }, ResetResponse>(functions, 'resetTicketKey')({ ticketId })
        storeCache((current) => ({ ...current, keys: { ...current.keys, [ticketId]: { keyVersion: data.keyVersion, key: data.key } } }))
        return { ok: true }
      } catch (error) {
        return { ok: false, error: callableError(error) }
      }
    },
    [storeCache],
  )

  const api = useMemo<TicketsApi>(
    () => ({
      signedIn: uid !== null,
      passes,
      stock,
      tiersFor(event) {
        const current = stock[event.id] ?? null
        return tiersFor(event).map((tier) => ({ ...tier, remaining: tierRemaining(tier, current) }))
      },
      purchase,
      keyFor(pass) {
        const entry = cache.keys[pass.id]
        return entry && entry.keyVersion === pass.keyVersion ? entry : null
      },
      clockOffsetMs: cache.offsetMs,
      keysError,
      refreshKeys: () => setRefreshTick((tick) => tick + 1),
      resetKey,
    }),
    [uid, passes, stock, purchase, cache, keysError, resetKey],
  )

  return <TicketsContext.Provider value={api}>{children}</TicketsContext.Provider>
}

export function useTickets(): TicketsApi {
  const api = useContext(TicketsContext)
  if (!api) throw new Error('useTickets must be used inside <TicketsProvider>')
  return api
}
