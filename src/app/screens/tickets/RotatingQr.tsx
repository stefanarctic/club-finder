import { useEffect, useMemo, useState } from 'react'
import { encode } from 'uqr'
import { CODE_PERIOD_MS, codeCounter, codeRemainingMs } from '../../../../shared/ticketing'
import { buildPayload } from '../../../data/ticketCodes'
import type { Pass } from '../../../data/tickets'
import { useTickets } from '../../tickets'
import { useNow } from '../../useNow'

const RING = 2 * Math.PI * 46

/**
 * The live admission code. It changes every 2 minutes and is computed on this device from the pass key,
 * so a screenshot stops working within a minute. The preview in the wallet list is decorative and not scannable.
 */
export function RotatingQr({ pass, mode }: { pass: Pass; mode: 'live' | 'preview' }) {
  if (mode === 'preview') return <QrPreview seed={pass.id} />
  return <LiveQr pass={pass} />
}

function LiveQr({ pass }: { pass: Pass }) {
  const { keyFor, clockOffsetMs, keysError, refreshKeys } = useTickets()
  const key = keyFor(pass)
  const now = useNow(1000).getTime() + clockOffsetMs
  const counter = codeCounter(now)
  const [payload, setPayload] = useState<{ counter: number; text: string } | null>(null)

  useEffect(() => {
    if (!key) {
      setPayload(null)
      return
    }
    let current = true
    void buildPayload(pass.id, key.key, counter).then((text) => {
      if (current) setPayload({ counter, text })
    })
    return () => {
      current = false
    }
  }, [pass.id, key, counter])

  if (!key) {
    return (
      <div className="pass-qr pass-qr--empty" role="status">
        {keysError ? (
          <>
            <p>{keysError}</p>
            <button type="button" className="cf-btn cf-btn--secondary cf-btn--sm" onClick={refreshKeys}>
              Try again
            </button>
          </>
        ) : (
          <p>{navigator.onLine ? 'Loading your code…' : 'Connect once to load this pass on this device.'}</p>
        )}
      </div>
    )
  }

  const left = codeRemainingMs(now) / CODE_PERIOD_MS
  const fresh = payload?.counter === counter

  return (
    <div className="pass-qr">
      <div className="pass-qr__frame">
        {payload && <QrSvg text={payload.text} label="Admission code. Show this at the door." stale={!fresh} />}
      </div>
      <div className="pass-qr__timer" aria-hidden>
        <svg viewBox="0 0 100 100">
          <circle className="pass-qr__track" cx="50" cy="50" r="46" />
          <circle className="pass-qr__ring" cx="50" cy="50" r="46" strokeDasharray={RING} strokeDashoffset={RING * (1 - left)} />
        </svg>
        <span className="cf-mono">{Math.ceil(codeRemainingMs(now) / 1000)}</span>
      </div>
    </div>
  )
}

function QrSvg({ text, label, stale }: { text: string; label: string; stale?: boolean }) {
  const path = useMemo(() => modulesPath(text), [text])
  return (
    <svg className={stale ? 'pass-qr__code is-stale' : 'pass-qr__code'} viewBox={`0 0 ${path.size} ${path.size}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={path.size} height={path.size} fill="#fff" />
      <path d={path.d} fill="#000" />
    </svg>
  )
}

function QrPreview({ seed }: { seed: string }) {
  const path = useMemo(() => modulesPath(`preview:${seed}`), [seed])
  return (
    <div className="pass-qr pass-qr--preview" aria-hidden>
      <svg className="pass-qr__code" viewBox={`0 0 ${path.size} ${path.size}`} shapeRendering="crispEdges">
        <rect width={path.size} height={path.size} fill="#fff" />
        <path d={path.d} fill="#000" />
      </svg>
    </div>
  )
}

function modulesPath(text: string): { size: number; d: string } {
  const qr = encode(text, { ecc: 'M', border: 2 })
  let d = ''
  qr.data.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) d += `M${x} ${y}h1v1h-1z`
    })
  })
  return { size: qr.size, d }
}
