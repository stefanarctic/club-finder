import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import QrScanner from 'qr-scanner'
import { ArrowLeft } from 'lucide-react'
import { EmptyState, cx } from '../../../design-system'
import type { RedeemReason, RedeemResult } from '../../../../shared/ticketing'
import { redeemTicket } from '../../../data/doorStaff'
import { useLiveCatalog } from '../../../data/LiveCatalog'
import { canEditEvent, useAccount, useStaffAssignment } from '../../auth'
import { ScreenFrame } from '../../shell/ScreenFrame'
import { callableError, useTickets } from '../../tickets'
import './ScanScreen.css'

/** The same code read again this soon is the camera seeing it twice, not a second guest. */
const REPEAT_WINDOW_MS = 3000
const RESULT_MS = 2600

const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

type Shown = { tone: 'ok' | 'bad'; title: string; detail: string }

const copy: Record<Exclude<RedeemReason, 'accepted' | 'already_used'>, { title: string; detail: string }> = {
  expired_code: { title: 'Code expired', detail: 'Ask them to open the pass in the app. Screenshots stop working after a minute.' },
  bad_signature: { title: 'Not a valid pass', detail: 'This code wasn’t issued by Club Finder, or the pass was reset.' },
  bad_format: { title: 'Not a Club Finder code', detail: 'Only codes from the Club Finder app scan here.' },
  wrong_event: { title: 'Wrong night', detail: 'This pass is for a different event.' },
  not_open: { title: 'Doors aren’t open yet', detail: 'Scanning opens six hours before the start.' },
  closed: { title: 'This night has ended', detail: 'Passes can’t be scanned after the end time.' },
  not_found: { title: 'Pass not found', detail: 'No pass matches this code.' },
}

function describe(result: RedeemResult): Shown {
  if (result.result === 'accepted') {
    return { tone: 'ok', title: 'Let them in', detail: [result.tierName, result.buyerName && `Name: ${result.buyerName}`].filter(Boolean).join(' · ') }
  }
  if (result.result === 'already_used') {
    const when = result.usedAt ? clock.format(new Date(result.usedAt)) : null
    return {
      tone: 'bad',
      title: 'Already scanned',
      detail: [when && `In at ${when}`, result.usedByName && `by ${result.usedByName}`, result.buyerName && `· ${result.buyerName}`].filter(Boolean).join(' '),
    }
  }
  return { tone: 'bad', ...copy[result.result] }
}

export function ScanScreen() {
  const { eventId = '' } = useParams()
  const { ready, user, account } = useAccount()
  const live = useLiveCatalog()
  const { stock } = useTickets()
  const event = live.storedEvents.find((item) => item.id === eventId)
  const onDoorList = useStaffAssignment(eventId)
  const allowed = canEditEvent(account, event?.createdBy) || onDoorList

  useEffect(() => {
    document.title = event ? `Scan · ${event.name} · Club Finder` : 'Scan · Club Finder'
  }, [event])

  const back = (
    <Link className="pass-screen__back" to={event ? `/events/${event.id}` : '/'}>
      <ArrowLeft />
      {event ? event.name : 'Back'}
    </Link>
  )

  if (!ready || live.status === 'loading') {
    return (
      <ScreenFrame title="Scan tickets">
        <EmptyState title="Opening the door list">One moment.</EmptyState>
      </ScreenFrame>
    )
  }

  if (!user || !event || !allowed) {
    return (
      <ScreenFrame title="Scan tickets">
        {back}
        <EmptyState
          title={!user ? 'Sign in to scan' : !event ? 'That night doesn’t exist' : 'You’re not on the door list'}
          action={
            !user ? (
              <Link className="cf-btn cf-btn--primary cf-btn--md" to="/profile">
                Sign in
              </Link>
            ) : undefined
          }
        >
          {!user
            ? 'Scanning needs the organizer’s account or a door staff account.'
            : 'Ask the organizer to add your account email to the door list for this night.'}
        </EmptyState>
      </ScreenFrame>
    )
  }

  const counts = stock[eventId]
  const sold = counts ? Object.values(counts.tiers).reduce((sum, tier) => sum + (tier?.sold ?? 0), 0) : 0
  const used = counts?.used ?? 0

  return (
    <ScreenFrame title="Scan tickets">
      {back}
      <p className="scan__count">
        <span className="cf-display">{used}</span> in <span className="scan__of">of {sold} sold</span>
      </p>
      <Scanner eventId={eventId} />
    </ScreenFrame>
  )
}

function Scanner({ eventId }: { eventId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [shown, setShown] = useState<Shown | null>(null)
  const busy = useRef(false)
  const last = useRef<{ text: string; at: number } | null>(null)
  const dismissTimer = useRef<number | undefined>(undefined)

  const dismiss = () => {
    window.clearTimeout(dismissTimer.current)
    setShown(null)
    busy.current = false
  }

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onDecode = async ({ data }: QrScanner.ScanResult) => {
      const at = Date.now()
      if (busy.current) return
      if (last.current && last.current.text === data && at - last.current.at < REPEAT_WINDOW_MS) return
      last.current = { text: data, at }
      busy.current = true
      setChecking(true)
      let next: Shown
      try {
        next = describe(await redeemTicket(eventId, data))
      } catch (error) {
        next = { tone: 'bad', title: 'Couldn’t check this pass', detail: callableError(error) }
      }
      setChecking(false)
      setShown(next)
      navigator.vibrate?.(next.tone === 'ok' ? 80 : [180, 80, 180])
      window.clearTimeout(dismissTimer.current)
      dismissTimer.current = window.setTimeout(() => {
        setShown(null)
        busy.current = false
        last.current = { text: data, at: Date.now() }
      }, RESULT_MS)
    }

    const scanner = new QrScanner(video, (result) => void onDecode(result), {
      returnDetailedScanResult: true,
      preferredCamera: 'environment',
      maxScansPerSecond: 8,
      highlightScanRegion: true,
    })
    scanner.start().catch((error: unknown) => {
      setCameraError(
        String(error).includes('NotAllowed') || String(error).includes('Permission')
          ? 'Camera access is blocked. Allow the camera for this site and reload.'
          : 'No camera is available on this device.',
      )
    })
    return () => {
      window.clearTimeout(dismissTimer.current)
      scanner.destroy()
    }
  }, [eventId])

  return (
    <div className="scan">
      <div className="scan__viewport">
        <video ref={videoRef} className="scan__video" muted playsInline />
        {cameraError && <p className="scan__camera-error">{cameraError}</p>}
        {checking && <p className="scan__checking" role="status">Checking…</p>}
      </div>
      {shown && (
        <button type="button" className={cx('scan__result', shown.tone === 'ok' ? 'is-ok' : 'is-bad')} onClick={dismiss} role="alert">
          <span className="scan__result-title cf-display">{shown.title}</span>
          {shown.detail && <span className="scan__result-detail">{shown.detail}</span>}
          <span className="scan__result-hint">Tap to scan the next one</span>
        </button>
      )}
      <p className="scan__note">Point the camera at the pass. Each pass gets in once.</p>
    </div>
  )
}
