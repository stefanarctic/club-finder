import { useState, type ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Crosshair,
  ExternalLink,
  LocateFixed,
  MapPin,
  Navigation,
  Share2,
  SlidersHorizontal,
  Star,
  Ticket,
  Wallet,
} from 'lucide-react'
import {
  Banner,
  Button,
  Chip,
  ClusterPin,
  Cover,
  EmptyState,
  EventCard,
  EventCardSkeleton,
  IconButton,
  InfoRow,
  PriceLevel,
  Rating,
  SectionHeader,
  SegmentedControl,
  Switch,
  Tag,
  UserDot,
  VenuePin,
} from '../design-system'
import { FakeMap, Marker } from './FakeMap'
import { genres, tonightEvents, upcomingEvents } from './sampleData'
import './Showcase.css'

type TimeRange = 'tonight' | 'weekend' | 'all'
type Sort = 'forYou' | 'soonest' | 'nearest' | 'price'

const timeRangeOptions: { value: TimeRange; label: string }[] = [
  { value: 'tonight', label: 'Tonight' },
  { value: 'weekend', label: 'This weekend' },
  { value: 'all', label: 'All upcoming' },
]

const sortOptions: { value: Sort; label: string }[] = [
  { value: 'forYou', label: 'For you' },
  { value: 'soonest', label: 'Soonest' },
  { value: 'nearest', label: 'Nearest' },
  { value: 'price', label: 'Price' },
]

const swatches = {
  surfaces: [
    ['bg-app', '--cf-ink-0', '#050407'],
    ['bg-surface', '--cf-ink-1', '#0a0910'],
    ['bg-raised', '--cf-ink-2', '#100e18'],
    ['bg-overlay', '--cf-ink-3', '#171421'],
    ['bg-hover', '--cf-ink-4', '#201c2d'],
    ['bg-pressed', '--cf-ink-5', '#2b2640'],
  ],
  uv: [
    ['50', '#f4efff'],
    ['100', '#e6dbff'],
    ['200', '#cfb8ff'],
    ['300', '#b48fff'],
    ['400', '#9b68ff'],
    ['500', '#8445ff'],
    ['600', '#6e2bf0'],
    ['700', '#5a1fc7'],
    ['800', '#41168f'],
    ['900', '#2a0e5c'],
    ['950', '#16073a'],
  ],
  text: [
    ['text-primary', 'var(--cf-text-primary)', '18.5:1'],
    ['text-secondary', 'var(--cf-text-secondary)', '10.1:1'],
    ['text-tertiary', 'var(--cf-text-tertiary)', '5.3:1'],
    ['text-accent', 'var(--cf-text-accent)', '8.1:1'],
    ['text-disabled', 'var(--cf-text-disabled)', 'decorative'],
  ],
} as const

const nav = [
  ['color', 'Color'],
  ['type', 'Type'],
  ['shape', 'Shape & depth'],
  ['controls', 'Controls'],
  ['map', 'Map'],
  ['cards', 'Cards'],
  ['screens', 'Screens'],
] as const

export function Showcase() {
  const [picked, setPicked] = useState<string[]>(['techno', 'house'])
  const [budget, setBudget] = useState<string | null>('50–100')
  const [range, setRange] = useState<TimeRange>('all')
  const [sort, setSort] = useState<Sort>('forYou')
  const [filterMap, setFilterMap] = useState(false)
  const [selectedId, setSelectedId] = useState('evt-control-basement')
  const [bannerOpen, setBannerOpen] = useState(true)

  const toggleGenre = (genre: string, on: boolean) =>
    setPicked((prev) => (on ? [...prev, genre].slice(0, 3) : prev.filter((g) => g !== genre)))

  return (
    <div className="sc cf-atmosphere">
      <header className="sc-top">
        <a href="#top" className="sc-brand">
          <span className="sc-brand__mark" aria-hidden />
          Club Finder
        </a>
        <nav className="sc-nav" aria-label="Sections">
          {nav.map(([id, label]) => (
            <a key={id} href={`#${id}`}>
              {label}
            </a>
          ))}
        </nav>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section id="top" className="sc-hero">
        <p className="cf-label sc-hero__eyebrow">Design system · v0.1 · Night mode</p>
        <h1 className="cf-display sc-hero__title">
          Black
          <br />
          <span className="sc-hero__uv">light</span>
        </h1>
        <div className="sc-hero__aside">
          <p className="sc-hero__lede">
            Violet-tinted blacks, one ultraviolet accent, and a glow reserved for the only thing that should shout:{' '}
            <em>it’s on tonight.</em>
          </p>
          <div className="sc-hero__pins" aria-hidden>
            <VenuePin />
            <VenuePin tonight />
            <ClusterPin count={7} tonightCount={2} />
          </div>
        </div>
      </section>

      {/* ── Color ──────────────────────────────────────────────────────── */}
      <Section id="color" index="01" title="Color" intro="Components only consume semantic tokens. Primitives are listed so you know what the semantics resolve to.">
        <h3 className="sc-sub">Surfaces — darkest is the floor, each step is one layer closer</h3>
        <div className="sc-surfaces">
          {swatches.surfaces.map(([name, token, hex], i) => (
            <div key={name} className="sc-surface" style={{ background: hex, zIndex: 6 - i }}>
              <span className="sc-swatch__name">{name}</span>
              <span className="sc-swatch__meta cf-mono">
                {token} · {hex}
              </span>
            </div>
          ))}
        </div>

        <h3 className="sc-sub">Ultraviolet — 500 is the accent, 200 is the tonight outline, 300 is accent text</h3>
        <div className="sc-uv">
          {swatches.uv.map(([step, hex]) => (
            <div
              key={step}
              className={`sc-uv__chip${step === '500' ? ' is-brand' : ''}`}
              style={{ background: hex, color: Number(step) <= 300 ? '#16073a' : '#f4efff' }}
            >
              <span className="cf-mono">{step}</span>
              <span className="cf-mono sc-uv__hex">{hex}</span>
            </div>
          ))}
        </div>

        <div className="sc-grid-2">
          <div>
            <h3 className="sc-sub">Text — contrast against bg-app</h3>
            <ul className="sc-text-list">
              {swatches.text.map(([name, value, ratio]) => (
                <li key={name}>
                  <span style={{ color: value }} className="sc-text-sample">
                    Basement Frequencies
                  </span>
                  <span className="cf-mono sc-swatch__meta">
                    {name} · {ratio}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="sc-sub">Signals</h3>
            <div className="sc-signals">
              <div className="sc-signal sc-signal--tonight">
                <span className="sc-signal__dot" />
                <div>
                  <strong>Tonight</strong>
                  <p>Same-day pins, Tonight group, card badge. The only glow in the system.</p>
                </div>
              </div>
              <div className="sc-signal sc-signal--live">
                <span className="sc-signal__dot" />
                <div>
                  <strong>On now</strong>
                  <p>Started, not ended. Mint so it never reads as “tonight”.</p>
                </div>
              </div>
              <div className="sc-signal sc-signal--warning">
                <span className="sc-signal__dot" />
                <div>
                  <strong>Warning</strong>
                  <p>Location fallback banner. Never decorative.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Type ───────────────────────────────────────────────────────── */}
      <Section id="type" index="02" title="Type" intro="Condensed poster display for moments, a clean grotesk for reading, mono for the facts that rank an event.">
        <div className="sc-type">
          <div className="sc-type__row">
            <span className="cf-label">Display · Bricolage Grotesque 78% / 760</span>
            <p className="cf-display" style={{ fontSize: 'var(--cf-text-5xl)' }}>
              Where’s the night?
            </p>
          </div>
          <div className="sc-type__row">
            <span className="cf-label">Heading · Bricolage Grotesque 88% / 680</span>
            <p className="cf-heading" style={{ fontSize: 'var(--cf-text-2xl)' }}>
              Velvet Room: All Night Long
            </p>
          </div>
          <div className="sc-type__row">
            <span className="cf-label">Body · Instrument Sans 15 / 1.5</span>
            <p style={{ maxWidth: '60ch' }} className="cf-muted">
              A converted printworks basement with a single long room, a Funktion-One stack and a strict no-photo policy.
              Placeholder copy — names and descriptions in the demo are invented.
            </p>
          </div>
          <div className="sc-type__row">
            <span className="cf-label">Mono · JetBrains Mono — reasons, times, prices</span>
            <p className="cf-mono" style={{ fontSize: 'var(--cf-text-sm)' }}>
              1.4 km <span style={{ color: 'var(--cf-uv-400)' }}>·</span> tonight{' '}
              <span style={{ color: 'var(--cf-uv-400)' }}>·</span> techno{' '}
              <span style={{ color: 'var(--cf-uv-400)' }}>·</span> about 80 EUR
            </p>
          </div>
          <div className="sc-type__row">
            <span className="cf-label">Label · Mono 11 / caps / 0.08em</span>
            <p className="cf-label">Night-out price level</p>
          </div>
        </div>
        <div className="sc-scale">
          {['2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl'].map((step) => (
            <div key={step} className="sc-scale__step">
              <span className="cf-mono sc-swatch__meta">{step}</span>
              <span style={{ fontSize: `var(--cf-text-${step})` }} className="cf-heading">
                Aa
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Shape ──────────────────────────────────────────────────────── */}
      <Section id="shape" index="03" title="Shape & depth" intro="Shadows vanish on black, so depth comes from a lit top edge and a deep drop. Radius grows with the size of the thing.">
        <div className="sc-grid-3">
          <div>
            <h3 className="sc-sub">Spacing · 4px base</h3>
            <div className="sc-spacing">
              {[1, 2, 3, 4, 6, 8, 10, 14].map((n) => (
                <div key={n} className="sc-spacing__row">
                  <span className="cf-mono sc-swatch__meta">{n}</span>
                  <span className="sc-spacing__bar" style={{ width: `var(--cf-space-${n})` }} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="sc-sub">Radius</h3>
            <div className="sc-radii">
              {['xs', 'sm', 'md', 'lg', 'xl', 'pill'].map((r) => (
                <div key={r} className="sc-radius" style={{ borderRadius: `var(--cf-radius-${r})` }}>
                  <span className="cf-mono">{r}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="sc-sub">Elevation & glow</h3>
            <div className="sc-elev">
              {['1', '2', '3'].map((e) => (
                <div key={e} className="sc-elev__card" style={{ boxShadow: `var(--cf-elevation-${e})` }}>
                  <span className="cf-mono">elevation-{e}</span>
                </div>
              ))}
              <div className="sc-elev__card" style={{ boxShadow: 'var(--cf-tonight-glow)' }}>
                <span className="cf-mono">tonight-glow</span>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Controls ───────────────────────────────────────────────────── */}
      <Section id="controls" index="04" title="Controls" intro="All interactive. Primary is the only filled button; use one per view.">
        <div className="sc-panel">
          <h3 className="sc-sub">Buttons</h3>
          <div className="sc-row">
            <Button leadingIcon={<LocateFixed />}>Allow location</Button>
            <Button variant="secondary">Continue with Bucharest</Button>
            <Button variant="ghost">Skip</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="sc-row">
            <Button size="sm" variant="secondary" leadingIcon={<SlidersHorizontal />}>
              Filters
            </Button>
            <Button size="lg" trailingIcon={<ArrowRight />}>
              Show me tonight
            </Button>
            <IconButton label="Recenter">
              <Crosshair />
            </IconButton>
            <IconButton label="Share" variant="ghost">
              <Share2 />
            </IconButton>
          </div>
        </div>

        <div className="sc-grid-2">
          <div className="sc-panel">
            <h3 className="sc-sub">
              Genre chips · pick up to three <span className="cf-mono sc-count">{picked.length}/3</span>
            </h3>
            <div className="sc-row sc-row--tight">
              {genres.map((g) => (
                <Chip
                  key={g}
                  selected={picked.includes(g)}
                  disabled={!picked.includes(g) && picked.length >= 3}
                  onSelectedChange={(on) => toggleGenre(g, on)}
                >
                  {g}
                </Chip>
              ))}
            </div>
            <h3 className="sc-sub">Budget</h3>
            <div className="sc-row sc-row--tight">
              {['Under 50', '50–100', '100+'].map((b) => (
                <Chip key={b} selected={budget === b} onSelectedChange={(on) => setBudget(on ? b : null)} icon={<Wallet />}>
                  {b} EUR
                </Chip>
              ))}
            </div>
          </div>

          <div className="sc-panel">
            <h3 className="sc-sub">Time range & sort</h3>
            <div className="sc-stack">
              <SegmentedControl label="Time range" options={timeRangeOptions} value={range} onChange={setRange} />
              <SegmentedControl label="Sort" size="sm" options={sortOptions} value={sort} onChange={setSort} />
              <Switch
                checked={filterMap}
                onChange={setFilterMap}
                label="Filter the map too"
                description="Hide venues that don’t match instead of dimming them"
              />
            </div>
            <h3 className="sc-sub">Tags</h3>
            <div className="sc-row sc-row--tight">
              <Tag tone="tonight">Tonight</Tag>
              <Tag tone="live">On now</Tag>
              <Tag tone="accent">techno</Tag>
              <Tag>house</Tag>
            </div>
          </div>
        </div>

        <div className="sc-panel">
          <h3 className="sc-sub">Banners</h3>
          <div className="sc-stack">
            {bannerOpen ? (
              <Banner tone="warning" title="Showing Bucharest" onDismiss={() => setBannerOpen(false)}>
                This demo only maps Bucharest. Distances are measured from Piața Unirii.
              </Banner>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setBannerOpen(true)}>
                Show banner again
              </Button>
            )}
            <Banner>Ticketing is coming later. For now, check the venue’s own page for entry.</Banner>
          </div>
        </div>
      </Section>

      {/* ── Map ────────────────────────────────────────────────────────── */}
      <Section id="map" index="05" title="Map" intro="The basemap is the darkest, lowest-contrast layer in the app so pins are always the brightest thing on screen.">
        <div className="sc-map-demo">
          <FakeMap className="sc-map-demo__map">
            <Marker x="22%" y="38%">
              <VenuePin label="Expirat Demo" />
            </Marker>
            <Marker x="40%" y="66%">
              <VenuePin tonight label="Guesthouse Demo" />
            </Marker>
            <Marker x="56%" y="50%">
              <VenuePin tonight selected eventCount={2} label="Control Placeholder" />
            </Marker>
            <Marker x="70%" y="72%">
              <VenuePin dimmed label="Form Placeholder" />
            </Marker>
            <Marker x="78%" y="26%" anchor="center">
              <ClusterPin count={6} tonightCount={2} />
            </Marker>
            <Marker x="14%" y="78%" anchor="center">
              <ClusterPin count={3} />
            </Marker>
            <Marker x="50%" y="74%" anchor="center">
              <UserDot />
            </Marker>
          </FakeMap>
          <dl className="sc-legend">
            <LegendItem marker={<VenuePin />} title="Upcoming" text="Quiet pin. Event later this week." />
            <LegendItem marker={<VenuePin tonight />} title="Tonight" text="Bright outline + slow halo." />
            <LegendItem marker={<VenuePin tonight selected />} title="Selected" text="Solid, white ring, venue label." />
            <LegendItem marker={<VenuePin eventCount={2} />} title="Stack" text="Venue has more than one event." />
            <LegendItem marker={<VenuePin dimmed />} title="Filtered out" text="Dimmed in place, clusters stay honest." />
            <LegendItem marker={<ClusterPin count={6} tonightCount={2} />} title="Cluster" text="Lit when any child is tonight." />
            <LegendItem marker={<UserDot />} title="You" text="Only for a real position in the city." />
          </dl>
        </div>
      </Section>

      {/* ── Cards ──────────────────────────────────────────────────────── */}
      <Section id="cards" index="06" title="Cards" intro="Every card explains why it ranked where it did. Tap a card to see the selected state the map uses.">
        <div className="sc-grid-2 sc-grid-2--cards">
          <div className="sc-list">
            <SectionHeader title="Tonight" count={tonightEvents.length} tonight />
            {tonightEvents.map((e) => (
              <EventCard key={e.id} {...e} selected={selectedId === e.id} onSelect={setSelectedId} />
            ))}
            <SectionHeader title="Coming up" count={upcomingEvents.length} />
            {upcomingEvents.map((e) => (
              <EventCard key={e.id} {...e} selected={selectedId === e.id} onSelect={setSelectedId} />
            ))}
          </div>
          <div className="sc-list">
            <h3 className="sc-sub">Loading</h3>
            <EventCardSkeleton />
            <EventCardSkeleton />
            <h3 className="sc-sub">Empty</h3>
            <EmptyState
              title="Nothing matches"
              action={
                <Button size="sm" variant="secondary">
                  Clear time range & genres
                </Button>
              }
            >
              No events fit this time range and these genres. The map hasn’t changed.
            </EmptyState>
            <h3 className="sc-sub">Venue facts</h3>
            <div className="sc-row">
              <Rating value={4.3} />
              <PriceLevel level={3} />
            </div>
          </div>
        </div>
      </Section>

      {/* ── Screens ────────────────────────────────────────────────────── */}
      <Section id="screens" index="07" title="Screens" intro="The three demo screens assembled from the parts above.">
        <div className="sc-phones">
          <Phone caption="Location">
            <LocationScreen />
          </Phone>
          <Phone caption="Home">
            <HomeScreen range={range} setRange={setRange} selectedId={selectedId} setSelectedId={setSelectedId} />
          </Phone>
          <Phone caption="Event">
            <EventScreen />
          </Phone>
        </div>
      </Section>

      <footer className="sc-footer">
        <span className="cf-label">Club Finder · Blacklight · tokens in src/design-system/styles/tokens.css</span>
      </footer>
    </div>
  )
}

function Section({
  id,
  index,
  title,
  intro,
  children,
}: {
  id: string
  index: string
  title: string
  intro: string
  children: ReactNode
}) {
  return (
    <section id={id} className="sc-section">
      <header className="sc-section__head">
        <span className="cf-mono sc-section__index">{index}</span>
        <h2 className="cf-display sc-section__title">{title}</h2>
        <p className="sc-section__intro">{intro}</p>
      </header>
      {children}
    </section>
  )
}

function LegendItem({ marker, title, text }: { marker: ReactNode; title: string; text: string }) {
  return (
    <div className="sc-legend__item">
      <dt className="sc-legend__marker">{marker}</dt>
      <dd>
        <strong>{title}</strong>
        <span>{text}</span>
      </dd>
    </div>
  )
}

function Phone({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <figure className="sc-phone">
      <div className="sc-phone__frame">
        <div className="sc-phone__screen">{children}</div>
      </div>
      <figcaption className="cf-label">{caption}</figcaption>
    </figure>
  )
}

function LocationScreen() {
  return (
    <div className="scr-location">
      <div className="scr-location__art" aria-hidden>
        <span className="scr-location__ring" />
        <span className="scr-location__ring" />
        <span className="scr-location__ring" />
        <VenuePin tonight />
      </div>
      <div className="scr-location__copy">
        <p className="cf-label">Bucharest · tonight</p>
        <h3 className="cf-display scr-location__title">Where’s the night?</h3>
        <p className="cf-muted scr-location__body">
          We use your location to center the map on your city and show how far each club is from you.
        </p>
      </div>
      <div className="scr-location__actions">
        <Button block size="lg" leadingIcon={<LocateFixed />}>
          Allow location
        </Button>
        <Button block size="lg" variant="ghost">
          Continue with Bucharest
        </Button>
      </div>
    </div>
  )
}

function HomeScreen({
  range,
  setRange,
  selectedId,
  setSelectedId,
}: {
  range: TimeRange
  setRange: (r: TimeRange) => void
  selectedId: string
  setSelectedId: (id: string) => void
}) {
  return (
    <div className="scr-home">
      <FakeMap className="scr-home__map">
        <div className="scr-home__map-top">
          <span className="scr-home__city">
            <MapPin aria-hidden /> Bucharest
          </span>
          <IconButton label="Filters" variant="glass">
            <SlidersHorizontal />
          </IconButton>
        </div>
        <Marker x="30%" y="44%">
          <VenuePin label="Expirat Demo" onClick={() => setSelectedId('evt-expirat-cypher')} selected={selectedId === 'evt-expirat-cypher'} />
        </Marker>
        <Marker x="58%" y="58%">
          <VenuePin
            tonight
            eventCount={2}
            label="Control Placeholder"
            selected={selectedId === 'evt-control-basement'}
            onClick={() => setSelectedId('evt-control-basement')}
          />
        </Marker>
        <Marker x="44%" y="80%">
          <VenuePin
            tonight
            label="Guesthouse Demo"
            selected={selectedId === 'evt-guesthouse-velvet'}
            onClick={() => setSelectedId('evt-guesthouse-velvet')}
          />
        </Marker>
        <Marker x="80%" y="36%" anchor="center">
          <ClusterPin count={4} tonightCount={1} />
        </Marker>
        <Marker x="68%" y="80%" anchor="center">
          <UserDot />
        </Marker>
        <div className="scr-home__map-bottom">
          <IconButton label="Recenter on me" variant="glass">
            <Navigation />
          </IconButton>
        </div>
      </FakeMap>
      <div className="scr-home__sheet">
        <span className="scr-home__grabber" aria-hidden />
        <SegmentedControl label="Time range" size="sm" options={timeRangeOptions} value={range} onChange={setRange} className="scr-home__range" />
        <SectionHeader title="Tonight" count={3} tonight className="scr-home__header" />
        {tonightEvents.slice(0, 2).map((e) => (
          <EventCard key={e.id} {...e} selected={selectedId === e.id} onSelect={setSelectedId} />
        ))}
        <SectionHeader title="Coming up" count={8} className="scr-home__header" />
        <EventCard {...upcomingEvents[0]} />
      </div>
    </div>
  )
}

function EventScreen() {
  return (
    <div className="scr-event">
      <div className="scr-event__hero">
        <Cover seed="evt-control-basement" className="scr-event__cover" />
        <div className="scr-event__hero-bar">
          <IconButton label="Back to list" variant="glass">
            <ArrowLeft />
          </IconButton>
          <IconButton label="Share" variant="glass">
            <Share2 />
          </IconButton>
        </div>
        <div className="scr-event__strip" aria-label="Photos">
          {['a', 'b', 'c', 'd'].map((s, i) => (
            <Cover key={s} seed={`venue-control-${s}`} className={`scr-event__thumb${i === 0 ? ' is-active' : ''}`} />
          ))}
        </div>
      </div>
      <div className="scr-event__body">
        <div className="sc-row sc-row--tight">
          <Tag tone="tonight">Tonight</Tag>
          <Tag tone="accent">techno</Tag>
          <Tag>house</Tag>
        </div>
        <h3 className="cf-display scr-event__title">Basement Frequencies</h3>
        <p className="scr-event__venue">
          Control Placeholder <span className="cf-mono scr-event__time">· Fri 23:00 – 06:00</span>
        </p>
        <div className="scr-event__price">
          <span className="cf-label">Average ticket</span>
          <span className="cf-display scr-event__price-value">80 EUR</span>
        </div>
        <div className="scr-event__facts">
          <InfoRow icon={<Navigation />} label="Distance">
            <span className="cf-mono">1.4 km</span> from you
          </InfoRow>
          <InfoRow icon={<MapPin />} label="Address">
            Str. Constantin Mille 4, Bucharest
          </InfoRow>
          <InfoRow icon={<Clock />} label="Hours">
            Thu–Sat 22:00–07:00
          </InfoRow>
          <InfoRow icon={<Star />} label="Rating">
            <Rating value={4.3} />
          </InfoRow>
          <InfoRow icon={<Wallet />} label="Price level">
            <PriceLevel level={3} />
          </InfoRow>
        </div>
        <p className="cf-muted scr-event__desc">
          Placeholder description. Eight hours of deep, rolling techno in the long room, local residents warming up for a
          guest closing set.
        </p>
        <Button block variant="secondary" trailingIcon={<ExternalLink />}>
          Open in maps
        </Button>
        <p className="scr-event__ticket-note">
          <Ticket aria-hidden /> Ticketing is coming later.
        </p>
      </div>
    </div>
  )
}
