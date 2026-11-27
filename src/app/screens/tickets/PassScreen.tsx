import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { Button, EmptyState } from '../../../design-system'
import { REFUND_RULE, formatPrice, passRef } from '../../../data/tickets'
import { useAccount } from '../../auth'
import { externalMapUrl } from '../../format'
import { ScreenFrame } from '../../shell/ScreenFrame'
import { useTickets } from '../../tickets'
import { useNow } from '../../useNow'
import { PassCard } from './PassCard'

const stamp = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export function PassScreen() {
  const { id } = useParams()
  const now = useNow()
  const { ready } = useAccount()
  const { signedIn, passes, resetKey } = useTickets()
  const pass = passes.find((item) => item.id === id)
  const live = pass !== undefined && pass.status === 'valid' && new Date(pass.endsAt).getTime() > now.getTime()
  const [resetting, setResetting] = useState(false)
  const [resetNote, setResetNote] = useState<string | null>(null)

  useEffect(() => {
    document.title = pass ? `${pass.eventName} · Ticket · Club Finder` : 'Ticket · Club Finder'
  }, [pass])

  useWakeLock(live)

  if (!pass) {
    return (
      <ScreenFrame>
        <Link className="pass-screen__back" to="/tickets">
          <ArrowLeft />
          Tickets
        </Link>
        <h1 className="cf-visually-hidden">Pass not found</h1>
        <EmptyState
          title={!ready ? 'Opening your pass' : signedIn ? 'That pass isn’t on this account' : 'Sign in to see your passes'}
          action={
            <Link className="cf-btn cf-btn--secondary cf-btn--sm" to={signedIn ? '/tickets' : '/profile'}>
              {signedIn ? 'Back to tickets' : 'Sign in'}
            </Link>
          }
        >
          {signedIn ? 'It may belong to a different account.' : 'Passes live on your account, so they follow you to any device.'}
        </EmptyState>
      </ScreenFrame>
    )
  }

  const reset = async () => {
    if (!window.confirm('Make a new code for this pass? Any copy of the old one, on another phone or in a screenshot, stops working.')) return
    setResetting(true)
    setResetNote(null)
    const result = await resetKey(pass.id)
    setResetting(false)
    setResetNote(result.ok ? 'New code ready. Old copies no longer scan.' : result.error)
  }

  return (
    <main className="screen">
      <div className="screen__column">
        <Link className="pass-screen__back" to="/tickets">
          <ArrowLeft />
          Tickets
        </Link>
        <PassCard pass={pass} now={now} size="full" heading="h1" />
        <dl className="pass-screen__facts">
          {pass.status === 'used' && pass.usedAt && <Fact label="Scanned in">{stamp.format(new Date(pass.usedAt))}</Fact>}
          <Fact label="Tier">{pass.tierName}</Fact>
          <Fact label="Admission">{formatPrice(pass.price, pass.currency)}</Fact>
          {pass.fee > 0 && (
            <Fact label="Service fee">
              {formatPrice(pass.fee, pass.currency)}
              {pass.orderCount > 1 && (
                <span className="pass-screen__hint"> Charged once for this order of {pass.orderCount}.</span>
              )}
            </Fact>
          )}
          <Fact label="Name at the door">{pass.buyerName}</Fact>
          {pass.buyerEmail && <Fact label="Email">{pass.buyerEmail}</Fact>}
          <Fact label="Pass">
            <span className="cf-mono">{passRef(pass.id)}</span>
          </Fact>
          <Fact label="Purchased">{stamp.format(new Date(pass.purchasedAt))}</Fact>
          <Fact label="Refunds">{REFUND_RULE}</Fact>
          <Fact label="Address">
            <a href={externalMapUrl(pass.latitude, pass.longitude)} target="_blank" rel="noreferrer">
              {pass.address || pass.venueName}
            </a>
          </Fact>
        </dl>
        {live && (
          <div className="pass-screen__use">
            <Button variant="secondary" block disabled={resetting} onClick={reset}>
              {resetting ? 'Making a new code…' : 'Reset QR code'}
            </Button>
            <p role="status">
              {resetNote ?? 'Only door staff can mark a pass used. If someone else saw or copied your code, reset it.'}
            </p>
          </div>
        )}
      </div>
    </main>
  )
}

/** Keeps the screen on while a live code is showing, where the browser allows it. */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let released = false
    const request = () => {
      if (document.visibilityState !== 'visible') return
      navigator.wakeLock
        .request('screen')
        .then((sentinel) => {
          if (released) void sentinel.release()
          else lock = sentinel
        })
        .catch(() => {})
    }
    request()
    document.addEventListener('visibilitychange', request)
    return () => {
      released = true
      document.removeEventListener('visibilitychange', request)
      void lock?.release()
    }
  }, [active])
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="pass-screen__fact">
      <dt className="cf-label">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
