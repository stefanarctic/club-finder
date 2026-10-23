import { useEffect, useMemo, useRef, useState } from 'react'
import { Map as MapLibreMap, setWorkerUrl, type LngLatBoundsLike } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useNavigate } from 'react-router'
import { Button, VenuePin } from '../../../design-system'
import { catalog } from '../../../data/catalog'
import { isSameDay, isUpcoming } from '../../../data/schedule'
import { HtmlMarker } from '../../map/HtmlMarker'
import { mapStyle } from '../../map/mapStyle'
import { useNow } from '../../useNow'
import '../../map/EventMap.css'
import './CountryMap.css'

setWorkerUrl(workerUrl)

/** Romania, with a little margin so the fit isn't clipped by the coast. */
const ROMANIA: LngLatBoundsLike = [
  [20.2, 43.6],
  [29.8, 48.3],
]

const UNMAPPED = ['Cluj-Napoca', 'Timișoara', 'Iași', 'Constanța']

export function CountryMap() {
  const now = useNow()
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLElement>(null)
  const [map, setMap] = useState<MapLibreMap | null>(null)

  const upcoming = useMemo(() => catalog.events.filter((event) => isUpcoming(event, now)), [now])
  const tonight = upcoming.some((event) => isSameDay(event, now))
  const openBucharest = () => navigate('/')

  useEffect(() => {
    document.title = 'Club Finder · Romania'
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const instance = new MapLibreMap({
      container,
      style: mapStyle,
      bounds: ROMANIA,
      fitBoundsOptions: { padding: { top: 48, bottom: 240, left: 28, right: 28 } },
      minZoom: 4,
      maxZoom: 10,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      attributionControl: false,
    })
    instance.touchZoomRotate.disableRotation()
    instance.keyboard.disableRotation()

    let ready = false
    const fit = () => {
      if (!ready) return
      const sheet = sheetRef.current?.offsetHeight ?? 240
      instance.fitBounds(ROMANIA, {
        padding: { top: 48, bottom: sheet + 36, left: 28, right: 28 },
        animate: false,
      })
    }
    instance.on('load', () => {
      ready = true
      fit()
    })
    const sheet = sheetRef.current
    const observer = sheet ? new ResizeObserver(fit) : null
    if (sheet) observer?.observe(sheet)

    setMap(instance)
    return () => {
      observer?.disconnect()
      instance.remove()
      setMap(null)
    }
  }, [])

  const city = catalog.city

  return (
    <div className="country">
      <div className="app-map country__map">
        <div ref={containerRef} className="app-map__canvas" />
        <div className="app-map__vignette" />
        {map && (
          <HtmlMarker map={map} lngLat={[city.defaultCenter.longitude, city.defaultCenter.latitude]} zIndex={2}>
            <VenuePin
              tonight={tonight}
              selected
              eventCount={upcoming.length}
              label={city.name}
              onClick={openBucharest}
            />
          </HtmlMarker>
        )}
      </div>

      <section ref={sheetRef} className="country__sheet" aria-label="Cities">
        <ul className="country-sheet__list">
          <li className="country-sheet__city">
            <div>
              <p className="country-sheet__name">{city.name}</p>
              <p className="cf-mono country-sheet__count">
                {upcoming.length} {upcoming.length === 1 ? 'event' : 'events'}
              </p>
            </div>
            <Button size="sm" onClick={openBucharest}>
              Open Bucharest
            </Button>
          </li>
          {UNMAPPED.map((name) => (
            <li key={name} className="country-sheet__city is-unmapped">
              <p className="country-sheet__name">{name}</p>
              <span className="cf-label">Not mapped yet</span>
            </li>
          ))}
        </ul>
        <p className="country-sheet__note">This demo only maps Bucharest.</p>
      </section>
    </div>
  )
}
