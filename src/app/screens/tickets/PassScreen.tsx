import { useEffect, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { Button, EmptyState } from '../../../design-system'
import { REFUND_RULE, formatPrice } from '../../../data/tickets'
import { externalMapUrl } from '../../format'
import { ScreenFrame } from '../../shell/ScreenFrame'
import { useTickets } from '../../tickets'
import { useNow } from '../../useNow'
import { PassCard } from './PassCard'

const purchasedAt = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export function PassScreen() {
  const { id } = useParams()
  const now = useNow()
  const { passes, markUsed } = useTickets()
  const pass = passes.find((item) => item.id === id)

  useEffect(() => {
    document.title = pass ? `${pass.eventName} · Ticket · Club Finder` : 'Ticket · Club Finder'
  }, [pass])

  if (!pass) {
    return (
      <ScreenFrame>
        <Link className="pass-screen__back" to="/tickets">
          <ArrowLeft />
          Tickets
        </Link>
        <h1 className="cf-visually-hidden">Pass not found</h1>
        <EmptyState
          title="That pass isn’t on this device"
          action={
            <Link className="cf-btn cf-btn--secondary cf-btn--sm" to="/tickets">
              Back to tickets
            </Link>
          }
        >
          It may have been saved in another browser.
        </EmptyState>
      </ScreenFrame>
    )
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
          <Fact label="Buyer">{pass.buyerName}</Fact>
          <Fact label="Email">{pass.buyerEmail}</Fact>
          <Fact label="Order">
            <span className="cf-mono">{pass.orderCode}</span>
          </Fact>
          <Fact label="Purchased">{purchasedAt.format(new Date(pass.purchasedAt))}</Fact>
          <Fact label="Refunds">{REFUND_RULE}</Fact>
          <Fact label="Address">
            <a href={externalMapUrl(pass.latitude, pass.longitude)} target="_blank" rel="noreferrer">
              {pass.address}
            </a>
          </Fact>
        </dl>
        {pass.usedAt === null && (
          <div className="pass-screen__use">
            <Button variant="secondary" block onClick={() => markUsed(pass.id)}>
              Mark as used
            </Button>
            <p>Marks this pass used on this device.</p>
          </div>
        )}
      </div>
    </main>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="pass-screen__fact">
      <dt className="cf-label">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
