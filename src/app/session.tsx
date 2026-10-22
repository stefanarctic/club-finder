import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { catalog } from '../data/catalog'
import { isInsideCity } from '../data/geo'
import { BUDGETS, GENRES, type Budget, type Genre, type LatLng } from '../data/types'

/*
 * Lives for the browser session (sessionStorage): a refresh in the same tab keeps the
 * choice and opens the map, a new session asks for location again from the map.
 */

export type FallbackReason = 'skipped' | 'outside' | 'denied' | 'unavailable'

export type LocationChoice = { kind: 'user'; position: LatLng } | { kind: 'fallback'; reason: FallbackReason }

export type SessionState = {
  location: LocationChoice | null
  interestsDone: boolean
  genres: Genre[]
  budget: Budget | null
  bannerDismissed: boolean
}

const STORAGE_KEY = 'club-finder:session:v1'

const initialState: SessionState = {
  location: null,
  interestsDone: false,
  genres: [],
  budget: null,
  bannerDismissed: false,
}

function readStored(): SessionState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return initialState
    const parsed = JSON.parse(raw) as Partial<SessionState>
    return {
      ...initialState,
      ...parsed,
      genres: (parsed.genres ?? []).filter((g): g is Genre => GENRES.includes(g)),
      budget: parsed.budget && BUDGETS.includes(parsed.budget) ? parsed.budget : null,
    }
  } catch {
    return initialState
  }
}

type SessionApi = SessionState & {
  /** The point distances are measured from: the guest, or the city's default center. */
  origin: LatLng
  /** The guest's real position, only when it falls inside the city. */
  userPosition: LatLng | null
  setLocation: (position: LatLng | null, reason?: Exclude<FallbackReason, 'outside'>) => void
  setInterests: (genres: Genre[], budget: Budget | null) => void
  setGenres: (genres: Genre[] | ((current: Genre[]) => Genre[])) => void
  setBudget: (budget: Budget | null) => void
  dismissBanner: () => void
}

const SessionContext = createContext<SessionApi | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(readStored)

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const setLocation = useCallback<SessionApi['setLocation']>((position, reason = 'skipped') => {
    const location: LocationChoice = position
      ? isInsideCity(position, catalog.city)
        ? { kind: 'user', position }
        : { kind: 'fallback', reason: 'outside' }
      : { kind: 'fallback', reason }
    setState((s) => ({ ...s, location, bannerDismissed: false }))
  }, [])

  const setInterests = useCallback((genres: Genre[], budget: Budget | null) => {
    setState((s) => ({ ...s, genres, budget, interestsDone: true }))
  }, [])

  const setGenres = useCallback<SessionApi['setGenres']>(
    (genres) => setState((s) => ({ ...s, genres: typeof genres === 'function' ? genres(s.genres) : genres })),
    [],
  )
  const setBudget = useCallback((budget: Budget | null) => setState((s) => ({ ...s, budget })), [])
  const dismissBanner = useCallback(() => setState((s) => ({ ...s, bannerDismissed: true })), [])

  const api = useMemo<SessionApi>(() => {
    const userPosition = state.location?.kind === 'user' ? state.location.position : null
    return {
      ...state,
      userPosition,
      origin: userPosition ?? catalog.city.defaultCenter,
      setLocation,
      setInterests,
      setGenres,
      setBudget,
      dismissBanner,
    }
  }, [state, setLocation, setInterests, setGenres, setBudget, dismissBanner])

  return <SessionContext.Provider value={api}>{children}</SessionContext.Provider>
}

export function useSession(): SessionApi {
  const api = useContext(SessionContext)
  if (!api) throw new Error('useSession must be used inside <SessionProvider>')
  return api
}
