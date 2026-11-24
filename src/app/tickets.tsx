import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  issuePasses,
  readTicketStore,
  tierRemaining,
  tiersFor,
  writeTicketStore,
  type AvailableTier,
  type Pass,
  type PurchaseInput,
  type TicketStore,
} from '../data/tickets'

type TicketsApi = {
  passes: Pass[]
  tiersFor: (event: { id: string; averagePrice: number; currency: 'EUR' }) => AvailableTier[]
  purchase: (input: PurchaseInput) => { ok: true; passes: Pass[] } | { ok: false; error: string }
  markUsed: (passId: string) => void
}

const TicketsContext = createContext<TicketsApi | null>(null)

export function TicketsProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<TicketStore>(readTicketStore)

  useEffect(() => {
    writeTicketStore(store)
  }, [store])

  const purchase = useCallback<TicketsApi['purchase']>(
    (input) => {
      const result = issuePasses(store, input)
      if (!result.ok) return result
      setStore(result.store)
      return { ok: true, passes: result.passes }
    },
    [store],
  )

  const markUsed = useCallback((passId: string) => {
    const usedAt = new Date().toISOString()
    setStore((current) => ({
      ...current,
      passes: current.passes.map((pass) => (pass.id === passId && pass.usedAt === null ? { ...pass, usedAt } : pass)),
    }))
  }, [])

  const api = useMemo<TicketsApi>(
    () => ({
      passes: store.passes,
      tiersFor(event) {
        return tiersFor(event).map((tier) => ({ ...tier, remaining: tierRemaining(tier, store.sold) }))
      },
      purchase,
      markUsed,
    }),
    [store, purchase, markUsed],
  )

  return <TicketsContext.Provider value={api}>{children}</TicketsContext.Provider>
}

export function useTickets(): TicketsApi {
  const api = useContext(TicketsContext)
  if (!api) throw new Error('useTickets must be used inside <TicketsProvider>')
  return api
}
