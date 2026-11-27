import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { EmptyState, SegmentedControl } from '../../../design-system'
import { passPile, type Pass, type PassPile } from '../../../data/tickets'
import { ScreenFrame } from '../../shell/ScreenFrame'
import { useTickets } from '../../tickets'
import { useNow } from '../../useNow'
import { PassCard } from './PassCard'

const piles: { value: PassPile; label: string }[] = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'used', label: 'Used' },
  { value: 'past', label: 'Past' },
]

const emptyCopy: Record<PassPile, { title: string; body: string }> = {
  upcoming: { title: 'No passes yet', body: 'When you get tickets, they show up here.' },
  used: { title: 'No used passes', body: 'A pass moves here once it’s scanned at the door.' },
  past: { title: 'No past nights', body: 'Passes stay here after the night ends.' },
}

export function TicketsScreen() {
  const now = useNow()
  const { signedIn, passes } = useTickets()
  const [pile, setPile] = useState<PassPile>('upcoming')

  useEffect(() => {
    document.title = 'Club Finder · Tickets'
  }, [])

  if (!signedIn) {
    return (
      <ScreenFrame title="Tickets">
        <div className="tickets__empty">
          <EmptyState
            title="Sign in to see your passes"
            action={
              <Link className="cf-btn cf-btn--primary cf-btn--md" to="/profile">
                Sign in
              </Link>
            }
          >
            Passes are kept on your account, so they follow you to any device.
          </EmptyState>
        </div>
      </ScreenFrame>
    )
  }

  const visible = passes
    .filter((pass) => passPile(pass, now) === pile)
    .sort((a, b) => (pile === 'past' ? startTime(b) - startTime(a) : startTime(a) - startTime(b)))
  const empty = emptyCopy[pile]

  return (
    <ScreenFrame title="Tickets">
      <SegmentedControl className="tickets__switch" label="Passes" size="sm" options={piles} value={pile} onChange={setPile} />
      {visible.length === 0 ? (
        <div className="tickets__empty">
          <EmptyState
            title={empty.title}
            action={
              pile === 'upcoming' ? (
                <Link className="cf-btn cf-btn--primary cf-btn--md" to="/">
                  Find a night
                </Link>
              ) : undefined
            }
          >
            {empty.body}
          </EmptyState>
        </div>
      ) : (
        <ul className="tickets">
          {visible.map((pass) => (
            <li key={pass.id}>
              <Link className="tickets__link" to={`/tickets/${pass.id}`}>
                <PassCard pass={pass} now={now} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ScreenFrame>
  )
}

function startTime(pass: Pass): number {
  return new Date(pass.startsAt).getTime()
}
