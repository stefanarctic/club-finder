import { useEffect, useMemo } from 'react'
import { Cover, Tag } from '../../../design-system'
import { useLiveCatalog } from '../../../data/LiveCatalog'
import { photoUrl } from '../../../data/photos'
import { isUpcoming, type ScheduledEvent } from '../../../data/schedule'
import type { Venue } from '../../../data/types'
import { startLabel } from '../../format'
import { ScreenFrame } from '../../shell/ScreenFrame'
import { useNow } from '../../useNow'
import './TicketsScreen.css'

export function TicketsScreen() {
  const now = useNow()
  const live = useLiveCatalog()
  const passes = useMemo(() => samplePasses(live.venues, live.events, now), [live.venues, live.events, now])

  useEffect(() => {
    document.title = 'Club Finder · Tickets'
  }, [])

  return (
    <ScreenFrame title="Tickets">
      <ul className="tickets">
        {passes.map(({ event, venue }) => (
          <li key={event.id}>
            <article className="pass">
              <div className="pass__top">
                <Cover seed={event.id} src={photoUrl(event.image)} alt="" className="pass__cover" />
                <div className="pass__facts">
                  <Tag tone="accent">Sample</Tag>
                  <h2 className="pass__name cf-heading">{event.name}</h2>
                  <p className="pass__venue">{venue.name}</p>
                  <p className="cf-mono pass__time">{startLabel(event, now)}</p>
                </div>
              </div>
              <div className="pass__stub">
                <SampleMark seed={event.id} />
                <p className="pass__disclaimer">Sample — not a real ticket</p>
              </div>
            </article>
          </li>
        ))}
      </ul>
      <p className="screen__note">Tickets will show up here once ticketing opens.</p>
    </ScreenFrame>
  )
}

function samplePasses(venueList: Venue[], events: ScheduledEvent[], now: Date): { event: ScheduledEvent; venue: Venue }[] {
  const venues = new Map(venueList.map((venue) => [venue.id, venue]))
  const passes: { event: ScheduledEvent; venue: Venue }[] = []
  for (const event of events) {
    const venue = venues.get(event.venueId)
    if (!venue || !isUpcoming(event, now)) continue
    passes.push({ event, venue })
    if (passes.length === 2) break
  }
  return passes
}

/** A loose mosaic. It is not a QR code and nothing here is scannable. */
function SampleMark({ seed }: { seed: string }) {
  const on = cells(seed)
  return (
    <div className="pass__mark" aria-hidden>
      {on.map((filled, index) => (
        <span key={index} className={filled ? 'is-on' : undefined} />
      ))}
    </div>
  )
}

function cells(seed: string): boolean[] {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return Array.from({ length: 36 }, (_, index) => {
    hash = Math.imul(hash ^ (index + 1), 16777619)
    return (hash >>> 0) % 3 !== 0
  })
}
