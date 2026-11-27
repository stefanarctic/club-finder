import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, Minus, Plus, X } from 'lucide-react'
import { Button, IconButton, cx } from '../../../design-system'
import type { ScheduledEvent } from '../../../data/schedule'
import { MAX_PASSES_PER_ORDER, REFUND_RULE, formatPrice, orderQuote, passRef, type AvailableTier } from '../../../data/tickets'
import { useAccount } from '../../auth'
import { useTickets } from '../../tickets'
import { useNow } from '../../useNow'
import { PassCard } from '../tickets/PassCard'
import './TicketSheet.css'

type Step = 'choose' | 'checkout' | 'done'

const stepLabel: Record<Step, string> = {
  choose: 'Tickets',
  checkout: 'Checkout',
  done: 'Confirmed',
}

export function TicketSheet({
  night,
  tiers,
  onClose,
}: {
  night: ScheduledEvent
  tiers: AvailableTier[]
  onClose: () => void
}) {
  const now = useNow()
  const { user, account } = useAccount()
  const { purchase, passes } = useTickets()
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const [step, setStep] = useState<Step>('choose')
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  /** One id per checkout. A double tap or a retry after a dropped connection lands on the same order. */
  const [requestId, setRequestId] = useState('')
  const [issuedIds, setIssuedIds] = useState<string[]>([])

  const quote = orderQuote(tiers, quantities)
  const issued = issuedIds.flatMap((id) => passes.filter((pass) => pass.id === id))
  const buyerName = account?.displayName ?? user?.displayName ?? ''
  const buyerEmail = account?.email ?? user?.email ?? ''

  useEffect(() => {
    titleRef.current?.focus()
  }, [step])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        if (busy) return
        if (step === 'checkout') setStep('choose')
        else onClose()
        return
      }
      if (event.key !== 'Tab') return
      const dialog = dialogRef.current
      if (!dialog) return
      const items = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled])')]
      const first = items[0]
      const last = items[items.length - 1]
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [step, busy, onClose])

  const setQty = (id: string, next: number) => {
    setError(null)
    setQuantities((current) => ({ ...current, [id]: Math.max(0, next) }))
  }

  const toCheckout = () => {
    setError(null)
    setRequestId(crypto.randomUUID())
    setStep('checkout')
  }

  const submit = async (formEvent: FormEvent) => {
    formEvent.preventDefault()
    if (busy || !user) return
    setBusy(true)
    setError(null)
    const result = await purchase({
      eventId: night.id,
      requestId,
      lines: quote.lines.map((line) => ({ tierId: line.tier.id, quantity: line.quantity })),
    })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setIssuedIds(result.ticketIds)
    setStep('done')
  }

  const closeOrBack = () => {
    if (busy) return
    if (step === 'checkout') {
      setError(null)
      setStep('choose')
      return
    }
    onClose()
  }

  return (
    <div
      ref={dialogRef}
      className="ticket-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ticket-sheet-title"
    >
      <header className="ticket-sheet__header">
        <div className="ticket-sheet__bar">
          <IconButton label={step === 'checkout' ? 'Back to tickets' : 'Close'} variant="secondary" onClick={closeOrBack}>
            {step === 'checkout' ? <ArrowLeft /> : <X />}
          </IconButton>
          <div className="ticket-sheet__heading">
            <p className="cf-label">{stepLabel[step]}</p>
            {step === 'done' ? (
              <p className="ticket-sheet__event">{night.name}</p>
            ) : (
              <h2 id="ticket-sheet-title" ref={titleRef} tabIndex={-1} className="ticket-sheet__event">
                {night.name}
              </h2>
            )}
          </div>
          <span />
        </div>
      </header>

      {step === 'choose' && (
        <div className="ticket-sheet__body">
          <ul className="ticket-sheet__tiers">
            {tiers.map((tier) => {
              const qty = quantities[tier.id] ?? 0
              const soldOut = tier.remaining === 0
              return (
                <li key={tier.id} className={cx('ticket-sheet__tier', soldOut && 'is-out')}>
                  <div className="ticket-sheet__tier-copy">
                    <p className="ticket-sheet__tier-name">{tier.name}</p>
                    <p className="ticket-sheet__tier-note">
                      {tier.note}
                      {' · '}
                      {soldOut ? 'Sold out' : `${tier.remaining} left`}
                    </p>
                  </div>
                  <p className="ticket-sheet__tier-price cf-mono">{formatPrice(tier.price, tier.currency)}</p>
                  {soldOut ? (
                    <span className="ticket-sheet__out">Sold out</span>
                  ) : (
                    <div className="ticket-sheet__stepper">
                      <button
                        type="button"
                        aria-label={`Remove one ${tier.name}`}
                        disabled={qty === 0}
                        onClick={() => setQty(tier.id, qty - 1)}
                      >
                        <Minus />
                      </button>
                      <span className="cf-mono">{qty}</span>
                      <button
                        type="button"
                        aria-label={`Add one ${tier.name}`}
                        disabled={qty >= tier.remaining || quote.count >= MAX_PASSES_PER_ORDER}
                        onClick={() => setQty(tier.id, qty + 1)}
                      >
                        <Plus />
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {step === 'checkout' && (
        <form id="ticket-checkout" className="ticket-sheet__body" onSubmit={submit}>
          <div className="ticket-sheet__summary">
            {quote.lines.map((line) => (
              <div key={line.tier.id} className="ticket-sheet__line">
                <span>
                  {line.tier.name} × {line.quantity}
                </span>
                <span className="cf-mono">{formatPrice(line.tier.price * line.quantity, line.tier.currency)}</span>
              </div>
            ))}
            {quote.fee > 0 && (
              <div className="ticket-sheet__line">
                <span>Service fee</span>
                <span className="cf-mono">{formatPrice(quote.fee)}</span>
              </div>
            )}
            <div className="ticket-sheet__total-row">
              <span className="cf-label">Total</span>
              <p className="ticket-sheet__total cf-display">{formatPrice(quote.total)}</p>
            </div>
          </div>
          {user ? (
            <>
              <div className="ticket-sheet__field">
                <span className="cf-label">Name at the door</span>
                <p>{buyerName || buyerEmail}</p>
              </div>
              <div className="ticket-sheet__field">
                <span className="cf-label">Account</span>
                <p>{buyerEmail}</p>
              </div>
            </>
          ) : (
            <div className="ticket-sheet__field">
              <span className="cf-label">Account</span>
              <p>Passes are tied to your account, so only you can show them. Sign in to continue.</p>
              <Link className="cf-btn cf-btn--secondary cf-btn--md cf-btn--block" to="/profile">
                Sign in
              </Link>
            </div>
          )}
          {error && (
            <p className="ticket-sheet__error" role="alert">
              {error}
            </p>
          )}
          <p className="ticket-sheet__rule">{REFUND_RULE}</p>
        </form>
      )}

      {step === 'done' && (
        <div className="ticket-sheet__body">
          <div className="ticket-sheet__done">
            <h2 id="ticket-sheet-title" ref={titleRef} tabIndex={-1} className="ticket-sheet__done-title cf-display">
              You're in
            </h2>
            <p>
              {issuedIds.length === 1 ? 'One pass' : `${issuedIds.length} passes`} for {night.name}. Open a pass at the door to
              show its code.
            </p>
          </div>
          {issued[0] ? <PassCard pass={issued[0]} now={now} /> : <p className="ticket-sheet__rule">Loading your passes…</p>}
          {issued.length > 1 && (
            <ul className="ticket-sheet__codes">
              {issued.map((pass) => (
                <li key={pass.id}>
                  <span>{pass.tierName}</span>
                  <span className="cf-mono">{passRef(pass.id)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <footer className="ticket-sheet__footer">
        <div className="ticket-sheet__footer-inner">
          {step === 'choose' && (
            <>
              <div className="ticket-sheet__tally">
                <p>{quote.count === 0 ? 'None selected' : `${quote.count} ${quote.count === 1 ? 'pass' : 'passes'}`}</p>
                <p className="ticket-sheet__sum cf-display">{quote.count === 0 ? '—' : formatPrice(quote.total)}</p>
                {quote.fee > 0 && <p className="ticket-sheet__incl">Includes {quote.fee} EUR service fee</p>}
                {quote.count >= MAX_PASSES_PER_ORDER && <p className="ticket-sheet__incl">8 passes is the limit for one order.</p>}
              </div>
              <Button disabled={quote.count === 0} onClick={toCheckout}>
                Continue
              </Button>
            </>
          )}
          {step === 'checkout' && (
            <>
              <Button type="submit" form="ticket-checkout" block disabled={!user || busy}>
                {busy ? 'Issuing passes…' : quote.total === 0 ? 'Get passes' : `Get passes · ${quote.total} EUR`}
              </Button>
              <p className="ticket-sheet__honest">Saved to your account. No payment is taken yet.</p>
            </>
          )}
          {step === 'done' && (
            <>
              <Link className="cf-btn cf-btn--primary cf-btn--md cf-btn--block" to="/tickets">
                View passes
              </Link>
              <Button variant="secondary" block onClick={onClose}>
                Back to the night
              </Button>
            </>
          )}
        </div>
      </footer>
    </div>
  )
}
