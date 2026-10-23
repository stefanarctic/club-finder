import { useEffect, useMemo, useRef, useState } from 'react'
import { Map as MapLibreMap, setWorkerUrl, type LngLatBoundsLike } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useNavigate } from 'react-router'
import { VenuePin } from '../../../design-system'
import { catalog } from '../../../data/catalog'
import { isSameDay, isUpcoming } from '../../../data/schedule'
import { romaniaOutline } from '../../../data/romaniaOutline'
import { HtmlMarker } from '../../map/HtmlMarker'
import { mapStyle } from '../../map/mapStyle'
import { useNow } from '../../useNow'
import '../../map/EventMap.css'
import './CountryMap.css'

setWorkerUrl(workerUrl)

const ROMANIA_SOURCE = 'romania-outline'

/** Romania, with a little margin so the fit isn't clipped by the coast. */
const ROMANIA: LngLatBoundsLike = [
  [20.2, 43.6],
  [29.8, 48.3],
]

const MAP_PADDING = { top: 48, bottom: 72, left: 28, right: 28 }

const ROUND_LINE = { 'line-join': 'round' as const, 'line-cap': 'round' as const }

function addRomaniaHighlight(map: MapLibreMap) {
  map.addSource(ROMANIA_SOURCE, { type: 'geojson', data: romaniaOutline })
  map.addLayer(
    {
      id: 'romania-outline-glow',
      type: 'line',
      source: ROMANIA_SOURCE,
      layout: ROUND_LINE,
      paint: {
        'line-color': '#ffffff',
        'line-width': 6,
        'line-blur': 3,
        'line-opacity': 0.02,
      },
    },
    'road-minor',
  )
  map.addLayer(
    {
      id: 'romania-outline',
      type: 'line',
      source: ROMANIA_SOURCE,
      layout: ROUND_LINE,
      paint: {
        'line-color': '#ffffff',
        'line-width': 1.5,
        'line-blur': 0.5,
        'line-opacity': 0.12,
      },
    },
    'road-minor',
  )
}

export function CountryMap() {
  const now = useNow()
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<MapLibreMap | null>(null)

  const upcoming = useMemo(() => catalog.events.filter((event) => isUpcoming(event, now)), [now])
  const tonight = upcoming.some((event) => isSameDay(event, now))
  const city = catalog.city
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
      fitBoundsOptions: { padding: MAP_PADDING },
      minZoom: 4,
      maxZoom: 10,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      attributionControl: false,
    })
    instance.touchZoomRotate.disableRotation()
    instance.keyboard.disableRotation()

    instance.on('load', () => {
      addRomaniaHighlight(instance)
      instance.fitBounds(ROMANIA, { padding: MAP_PADDING, animate: false })
      setMap(instance)
    })

    return () => {
      instance.remove()
      setMap(null)
    }
  }, [])

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
              onClick={openBucharest}
            />
          </HtmlMarker>
        )}
      </div>
    </div>
  )
}
