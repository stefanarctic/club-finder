import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { isLinkedEvent, parseEventPlace, parseStoredEvent } from './documents'
import { db, firebaseConfigured } from './firebase'
import { scheduleStoredEvents } from './schedule'
import type { ScheduledEvent } from './schedule'
import type { EventPlace, StoredEvent } from './types'

export type CatalogStatus = 'unconfigured' | 'loading' | 'ready' | 'error'

type LiveCatalogValue = {
  configured: boolean
  status: CatalogStatus
  error: string | null
  /** Every stored event, including ones that have already ended. */
  events: ScheduledEvent[]
  storedEvents: StoredEvent[]
}

const empty: LiveCatalogValue = {
  configured: firebaseConfigured,
  status: firebaseConfigured ? 'loading' : 'unconfigured',
  error: null,
  events: [],
  storedEvents: [],
}

const LiveCatalogContext = createContext<LiveCatalogValue>(empty)

export function LiveCatalogProvider({ children }: { children: ReactNode }) {
  const [nights, setNights] = useState<ReturnType<typeof parseStoredEvent>[] | null>(null)
  const [places, setPlaces] = useState<Map<string, EventPlace> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!db) return
    const database = db
    const unsubEvents = onSnapshot(
      collection(database, 'events'),
      (snap) => {
        setError(null)
        setNights(snap.docs.map((item) => parseStoredEvent(item.id, item.data())))
      },
      (err) => setError(err.message),
    )
    const unsubVenues = onSnapshot(
      collection(database, 'venues'),
      (snap) => {
        setPlaces(
          new Map(
            snap.docs.flatMap((item) => {
              const place = parseEventPlace(item.data())
              return place ? [[item.id, place] as const] : []
            }),
          ),
        )
      },
      () => setPlaces(new Map()),
    )
    return () => {
      unsubEvents()
      unsubVenues()
    }
  }, [])

  const storedEvents = useMemo<StoredEvent[] | null>(() => {
    if (nights == null || places == null) return null
    return nights
      .flatMap((night) => {
        if (!night) return []
        if (!isLinkedEvent(night)) return [night]
        const place = places.get(night.venueId)
        if (!place) return []
        const { venueId: _venueId, ...fields } = night
        return [{ ...fields, venue: { ...place, googlePlaceId: place.googlePlaceId || undefined } }]
      })
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  }, [nights, places])

  const value = useMemo<LiveCatalogValue>(() => {
    if (!firebaseConfigured) return empty
    if (error && storedEvents == null) {
      return { ...empty, configured: true, status: 'error', error }
    }
    if (storedEvents == null) {
      return { ...empty, configured: true, status: error ? 'error' : 'loading', error }
    }
    return {
      configured: true,
      status: 'ready',
      error: null,
      storedEvents,
      events: scheduleStoredEvents(storedEvents),
    }
  }, [storedEvents, error])

  return <LiveCatalogContext.Provider value={value}>{children}</LiveCatalogContext.Provider>
}

export function useLiveCatalog(): LiveCatalogValue {
  return useContext(LiveCatalogContext)
}
