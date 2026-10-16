import type { ReactNode } from 'react'
import { mapTheme } from '../design-system'

/** Static SVG stand-in for the MapLibre basemap, painted with the real map palette. */
export function FakeMap({ children, className }: { children?: ReactNode; className?: string }) {
  const t = mapTheme
  return (
    <div className={className} style={{ position: 'relative', overflow: 'hidden', background: t.land }}>
      <svg
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        aria-hidden
      >
        <rect width="400" height="300" fill={t.land} />
        <path d="M250 20 q40 10 60 40 t20 60 l-40 10 q-30 -30 -50 -40 z" fill={t.park} />
        <ellipse cx="300" cy="50" rx="34" ry="16" fill={t.water} stroke={t.waterOutline} />
        <path d="M60 210 q30 -20 70 -6 l10 40 q-50 20 -80 -6 z" fill={t.park} />
        {Array.from({ length: 70 }).map((_, i) => (
          <rect
            key={i}
            x={(i * 53) % 390}
            y={(i * 37) % 290}
            width={10 + (i % 4) * 4}
            height={8 + (i % 3) * 5}
            rx="1"
            fill={t.building}
            stroke={t.buildingOutline}
            strokeWidth="0.5"
          />
        ))}
        <g stroke={t.roadMinor} strokeWidth="2" fill="none">
          <path d="M0 60 L400 90" />
          <path d="M0 240 L400 200" />
          <path d="M80 0 L120 300" />
          <path d="M330 0 L300 300" />
          <path d="M0 130 Q200 110 400 150" />
          <path d="M160 0 Q190 150 170 300" />
        </g>
        <path
          d="M-10 190 C 60 175, 110 200, 170 180 S 290 160, 410 175"
          stroke={t.water}
          strokeWidth="9"
          fill="none"
          strokeLinecap="round"
        />
        <g stroke={t.roadMajor} strokeWidth="4" fill="none" strokeLinecap="round">
          <path d="M0 160 L400 120" />
          <path d="M220 0 L240 300" />
          <circle cx="215" cy="165" r="38" />
        </g>
        <path d="M0 20 L400 280" stroke={t.roadHighway} strokeWidth="5" fill="none" opacity="0.7" />
        <text x="226" y="186" fill={t.labelMajor} fontSize="8" fontFamily="Instrument Sans Variable" letterSpacing="1">
          PIAȚA UNIRII
        </text>
        <text x="30" y="198" fill={t.waterLabel} fontSize="7" fontStyle="italic" fontFamily="Instrument Sans Variable">
          Dâmbovița
        </text>
        <text x="262" y="92" fill={t.label} fontSize="7" fontFamily="Instrument Sans Variable">
          Floreasca
        </text>
        <text x="40" y="100" fill={t.label} fontSize="7" fontFamily="Instrument Sans Variable">
          Cotroceni
        </text>
      </svg>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 40%, transparent 40%, rgb(5 4 7 / 0.75))',
          pointerEvents: 'none',
        }}
      />
      {children}
    </div>
  )
}

type MarkerProps = { x: string; y: string; anchor?: 'bottom' | 'center'; children: ReactNode }

export function Marker({ x, y, anchor = 'bottom', children }: MarkerProps) {
  const transform = anchor === 'bottom' ? 'translate(-50%, -100%)' : 'translate(-50%, -50%)'
  return <div style={{ position: 'absolute', left: x, top: y, transform }}>{children}</div>
}
