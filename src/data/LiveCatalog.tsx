import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { parseStoredEvent, parseVenue } from './documents'
import { db, firebaseConfigured } from './firebase'
import { scheduleStoredEvents } from './schedule'
import type { ScheduledEvent } from './schedule'
import type { StoredEvent, Venue } from './types'

export type CatalogStatus = 'unconfigured' | 'loading' | 'ready' | 'error'

type LiveCatalogValue = {
  configured: boolean
  status: CatalogStatus
  error: string | null
  venues: Venue[]
  /** Every stored event, including ones that have already ended. */
  events: ScheduledEvent[]
  storedEvents: StoredEvent[]
}

const empty: LiveCatalogValue = {
  configured: firebaseConfigured,
  status: firebaseConfigured ? 'loading' : 'unconfigured',
  error: null,
  venues: [],
  events: [],
  storedEvents: [],
}

const LiveCatalogContext = createContext<LiveCatalogValue>(empty)

export function LiveCatalogProvider({ children }: { children: ReactNode }) {
  const [venues, setVenues] = useState<Venue[] | null>(null)
  const [storedEvents, setStoredEvents] = useState<StoredEvent[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!db) return
    const database = db
    const unsubVenues = onSnapshot(
      collection(database, 'venues'),
      (snap) => {
        setVenues(
          snap.docs
            .flatMap((item) => {
              const venue = parseVenue(item.id, item.data())
              return venue ? [venue] : []
            })
            .sort((a, b) => a.name.localeCompare(b.name)),
        )
      },
      (err) => setError(err.message),
    )
    const unsubEvents = onSnapshot(
      collection(database, 'events'),
      (snap) => {
        setStoredEvents(
          snap.docs
            .flatMap((item) => {
              const event = parseStoredEvent(item.id, item.data())
              return event ? [event] : []
            })
            .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
        )
      },
      (err) => setError(err.message),
    )
    return () => {
      unsubVenues()
      unsubEvents()
    }
  }, [])

  const value = useMemo<LiveCatalogValue>(() => {
    if (!firebaseConfigured) return empty
    if (error && venues == null && storedEvents == null) {
      return { ...empty, configured: true, status: 'error', error }
    }
    if (venues == null || storedEvents == null) {
      return { ...empty, configured: true, status: error ? 'error' : 'loading', error }
    }
    return {
      configured: true,
      status: error ? 'error' : 'ready',
      error,
      venues,
      storedEvents,
      events: scheduleStoredEvents(storedEvents),
    }
  }, [venues, storedEvents, error])

  return <LiveCatalogContext.Provider value={value}>{children}</LiveCatalogContext.Provider>
}

export function useLiveCatalog(): LiveCatalogValue {
  return useContext(LiveCatalogContext)
}
