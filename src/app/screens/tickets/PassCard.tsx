import type { ElementType } from 'react'
import { Cover, Tag, cx } from '../../../design-system'
import { photoUrl } from '../../../data/photos'
import { isSameLocalDay } from '../../../data/schedule'
import { passRef, type Pass } from '../../../data/tickets'
import { timeSpanLabel } from '../../format'
import { RotatingQr } from './RotatingQr'
import './TicketsScreen.css'

export function PassCard({
  pass,
  now,
  size = 'card',
  heading = 'h2',
}: {
  pass: Pass
  now: Date
  size?: 'card' | 'full'
  heading?: 'h1' | 'h2'
}) {
  const startsAt = new Date(pass.startsAt)
  const endsAt = new Date(pass.endsAt)
  const ended = endsAt.getTime() <= now.getTime()
  const used = pass.status === 'used'
  const tonight = !ended && !used && isSameLocalDay(startsAt, now)
  const live = size === 'full' && !used && !ended
  const Title = heading as ElementType

  return (
    <article className={cx('pass', size === 'full' && 'pass--full', live && 'is-live', tonight && 'is-tonight', used && 'is-used', ended && 'is-past')}>
      <div className="pass__hero">
        <Cover seed={pass.eventId} src={photoUrl(pass.image, 'card')} alt="" className="pass__cover" />
        <div className="pass__scrim" />
        <div className="pass__copy">
          <div className="pass__tags">
            {tonight && <Tag tone="tonight">Tonight</Tag>}
            {used && <Tag tone="neutral">Used</Tag>}
            {ended && !used && <Tag tone="neutral">Ended</Tag>}
            <Tag tone="accent">{pass.tierName}</Tag>
          </div>
          <Title className="pass__name cf-display">{pass.eventName}</Title>
          <p className="pass__meta">
            {pass.venueName}
            <span className="cf-mono"> {timeSpanLabel({ startsAt, endsAt }, now)}</span>
          </p>
        </div>
      </div>
      <div className="pass__perf" aria-hidden>
        <span className="pass__notch pass__notch--left" />
        <span className="pass__notch pass__notch--right" />
      </div>
      <div className="pass__stub">
        <div className="pass__seal">
          <RotatingQr pass={pass} mode={live ? 'live' : 'preview'} />
        </div>
        <div className="pass__admit">
          <p className="cf-label">Admit one</p>
          <p className="pass__code cf-mono">{passRef(pass.id)}</p>
          {live && <p className="pass__hint">Turn your brightness up. The code changes every 2 minutes.</p>}
          {size === 'card' && !used && !ended && <p className="pass__hint">Open to show the code</p>}
        </div>
        {used && <p className="pass__stamp">Used</p>}
      </div>
    </article>
  )
}
