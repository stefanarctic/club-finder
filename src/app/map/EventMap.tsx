import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Map as MapLibreMap,
  setWorkerUrl,
  type GeoJSONSource,
  type LngLatBoundsLike,
  type MapMouseEvent,
  type MapSourceDataEvent,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { Maximize2, Minimize2, Navigation } from 'lucide-react'
import { ClusterPin, IconButton, UserDot, VenuePin, cx } from '../../design-system'
import type { VenuePinData } from '../../data/discovery'
import type { City, LatLng } from '../../data/types'
import { HtmlMarker } from './HtmlMarker'
import { mapStyle } from './mapStyle'
import './EventMap.css'

// MapLibre resolves its worker next to its own file, which bundling moves; point it at the emitted asset.
setWorkerUrl(workerUrl)

const SOURCE_ID = 'venues'
const MIN_OPENING_ZOOM = 11

type VisibleMarker =
  | { kind: 'venue'; key: string; venueId: string }
  | {
      kind: 'cluster'
      key: string
      clusterId: number
      lngLat: [number, number]
      eventCount: number
      tonightCount: number
      matchedCount: number
    }

type EventMapProps = {
  city: City
  /** Pins to draw. Unmatched pins are dimmed; leave them out to hide them. */
  pins: VenuePinData[]
  /** Map center and distance origin: the guest, or the city's default center. */
  origin: LatLng
  userPosition: LatLng | null
  selectedVenueId: string | null
  /** Venue whose event stack is open, rendered from `stackContent`. */
  stackVenueId: string | null
  stackContent?: ReactNode
  /** Changing this eases the map to that venue (used by the event page). */
  focusVenueId?: string | null
  onPinClick: (venueId: string) => void
  onBackgroundClick: () => void
  /** Floating controls over the top of the map. */
  topBar?: ReactNode
  /** Phone split: the corner control grows or shrinks the map. Hidden on desktop. */
  mapExpanded?: boolean
  onToggleMapSize?: () => void
  /** Keeps the map out of focus while the location prompt is open. */
  inert?: boolean
  className?: string
}

function toFeatureCollection(pins: VenuePinData[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: pins.map((pin) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [pin.venue.longitude, pin.venue.latitude] },
      properties: {
        venueId: pin.venue.id,
        eventCount: pin.listings.length,
        tonightCount: pin.tonightCount,
        matched: pin.matched ? 1 : 0,
      },
    })),
  }
}

/** Bounds centered on `center` that still contain every pin, so the opening view shows them all. */
function initialBounds(center: LatLng, pins: VenuePinData[]): LngLatBoundsLike {
  let dLat = 0.01
  let dLng = 0.01
  for (const { venue } of pins) {
    dLat = Math.max(dLat, Math.abs(venue.latitude - center.latitude))
    dLng = Math.max(dLng, Math.abs(venue.longitude - center.longitude))
  }
  return [
    [center.longitude - dLng, center.latitude - dLat],
    [center.longitude + dLng, center.latitude + dLat],
  ]
}

export function EventMap({
  city,
  pins,
  origin,
  userPosition,
  selectedVenueId,
  stackVenueId,
  stackContent,
  focusVenueId,
  onPinClick,
  onBackgroundClick,
  topBar,
  mapExpanded = false,
  onToggleMapSize,
  inert = false,
  className,
}: EventMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<MapLibreMap | null>(null)
  const [visible, setVisible] = useState<VisibleMarker[]>([])

  const pinsRef = useRef(pins)
  pinsRef.current = pins
  const onBackgroundClickRef = useRef(onBackgroundClick)
  onBackgroundClickRef.current = onBackgroundClick
  const userPositionRef = useRef(userPosition)
  userPositionRef.current = userPosition
  // True when the map opened before a position existed, so a later grant should move the camera.
  const flyToGrantedPosition = useRef(false)

  const pinsById = useMemo(() => new Map(pins.map((p) => [p.venue.id, p])), [pins])

  // Create the map once.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    flyToGrantedPosition.current = userPositionRef.current == null
    const { north, south, west, east } = city.boundingBox
    const pad = 0.08
    const instance = new MapLibreMap({
      container,
      style: mapStyle,
      bounds: initialBounds(origin, pinsRef.current),
      fitBoundsOptions: { padding: { top: 56, bottom: 56, left: 24, right: 24 }, maxZoom: 14 },
      maxBounds: [
        [west - pad, south - pad],
        [east + pad, north + pad],
      ],
      minZoom: 10,
      maxZoom: 18,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      attributionControl: { compact: true },
    })
    // On a short phone map, fitting every pin around a fixed center can zoom out past the city.
    if (instance.getZoom() < MIN_OPENING_ZOOM) instance.setZoom(MIN_OPENING_ZOOM)
    if (import.meta.env.DEV) (window as unknown as { __map: unknown }).__map = instance
    instance.touchZoomRotate.disableRotation()
    instance.keyboard.disableRotation()

    instance.on('load', () => {
      instance.addSource(SOURCE_ID, {
        type: 'geojson',
        data: toFeatureCollection(pinsRef.current),
        cluster: true,
        clusterRadius: 60,
        clusterMaxZoom: 15,
        clusterProperties: {
          eventCount: ['+', ['get', 'eventCount']],
          tonightCount: ['+', ['get', 'tonightCount']],
          matchedCount: ['+', ['get', 'matched']],
        },
      })
      // Invisible layer so the clustered source is tiled and queryable; HTML markers do the drawing.
      instance.addLayer({
        id: 'venues-index',
        type: 'circle',
        source: SOURCE_ID,
        paint: { 'circle-radius': 1, 'circle-opacity': 0 },
      })
      setMap(instance)
    })

    instance.on('click', (e: MapMouseEvent) => {
      const target = e.originalEvent.target as Element | null
      if (target?.closest('.maplibregl-marker')) return
      onBackgroundClickRef.current()
    })

    return () => {
      setMap(null)
      instance.remove()
    }
    // The map is created once; later prop changes are applied by the effects below.
  }, [])

  // Push pin data into the clustered source.
  useEffect(() => {
    map?.getSource<GeoJSONSource>(SOURCE_ID)?.setData(toFeatureCollection(pins))
  }, [map, pins])

  // Mirror the source's current clusters and points as HTML markers.
  useEffect(() => {
    if (!map) return
    let signature = ''
    const sync = () => {
      if (!map.getSource(SOURCE_ID) || !map.isSourceLoaded(SOURCE_ID)) return
      const seen = new Map<string, VisibleMarker>()
      for (const feature of map.querySourceFeatures(SOURCE_ID)) {
        const props = feature.properties ?? {}
        const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates
        if (props.cluster) {
          const key = `c:${props.cluster_id}:${lng.toFixed(5)}:${lat.toFixed(5)}`
          seen.set(key, {
            kind: 'cluster',
            key,
            clusterId: props.cluster_id,
            lngLat: [lng, lat],
            eventCount: props.eventCount,
            tonightCount: props.tonightCount,
            matchedCount: props.matchedCount,
          })
        } else {
          const key = `v:${props.venueId}`
          seen.set(key, { kind: 'venue', key, venueId: props.venueId })
        }
      }
      const next = [...seen.values()]
      const nextSignature = next
        .map((m) => (m.kind === 'cluster' ? `${m.key}:${m.eventCount}:${m.tonightCount}:${m.matchedCount}` : m.key))
        .sort()
        .join('|')
      if (nextSignature !== signature) {
        signature = nextSignature
        setVisible(next)
      }
    }
    const onSourceData = (e: MapSourceDataEvent) => {
      if (e.sourceId === SOURCE_ID) sync()
    }
    map.on('render', sync)
    map.on('idle', sync)
    map.on('sourcedata', onSourceData)
    sync()
    return () => {
      map.off('render', sync)
      map.off('idle', sync)
      map.off('sourcedata', onSourceData)
    }
  }, [map])

  // A location accepted after the map opened moves the camera onto the guest.
  useEffect(() => {
    if (!map || !userPosition || !flyToGrantedPosition.current) return
    flyToGrantedPosition.current = false
    map.easeTo({
      center: [userPosition.longitude, userPosition.latitude],
      zoom: Math.max(map.getZoom(), 14),
      duration: 800,
    })
  }, [map, userPosition])

  // Give an opening stack room above its pin.
  useEffect(() => {
    if (!map || !stackVenueId) return
    const pin = pinsRef.current.find((p) => p.venue.id === stackVenueId)
    if (!pin) return
    // Put the pin low enough for the stack to fit above it, but clear of the list sheet's overlap.
    const height = map.getContainer().clientHeight
    const pinY = Math.min(height - 40, 300)
    map.easeTo({ center: [pin.venue.longitude, pin.venue.latitude], offset: [0, pinY - height / 2], duration: 450 })
  }, [map, stackVenueId])

  useEffect(() => {
    if (!map || !focusVenueId) return
    const pin = pinsRef.current.find((p) => p.venue.id === focusVenueId)
    if (!pin) return
    map.easeTo({ center: [pin.venue.longitude, pin.venue.latitude], zoom: Math.max(map.getZoom(), 15.5), duration: 700 })
  }, [map, focusVenueId])

  const expandCluster = async (clusterId: number, lngLat: [number, number]) => {
    if (!map) return
    const source = map.getSource<GeoJSONSource>(SOURCE_ID)
    if (!source) return
    const zoom = await source.getClusterExpansionZoom(clusterId)
    map.easeTo({ center: lngLat, zoom: Math.min(zoom + 0.25, 17), duration: 500 })
  }

  const recenter = () => {
    map?.easeTo({ center: [origin.longitude, origin.latitude], zoom: Math.max(map.getZoom(), 13), duration: 600 })
  }

  const stackPin = stackVenueId ? pinsById.get(stackVenueId) : undefined

  return (
    <div className={cx('app-map', className)} inert={inert || undefined}>
      <div ref={containerRef} className="app-map__canvas" />
      <div className="app-map__vignette" aria-hidden />

      {map &&
        visible.map((marker) => {
          if (marker.kind === 'cluster') {
            return (
              <HtmlMarker key={marker.key} map={map} lngLat={marker.lngLat} anchor="center" zIndex={marker.tonightCount ? 2 : 1}>
                <ClusterPin
                  count={marker.eventCount}
                  tonightCount={marker.tonightCount}
                  dimmed={marker.matchedCount === 0}
                  onClick={() => expandCluster(marker.clusterId, marker.lngLat)}
                />
              </HtmlMarker>
            )
          }
          const pin = pinsById.get(marker.venueId)
          if (!pin) return null
          const selected = pin.venue.id === selectedVenueId
          return (
            <HtmlMarker
              key={marker.key}
              map={map}
              lngLat={[pin.venue.longitude, pin.venue.latitude]}
              zIndex={selected ? 4 : pin.tonight ? 2 : 1}
            >
              <VenuePin
                tonight={pin.tonight}
                selected={selected}
                dimmed={!pin.matched && !selected}
                eventCount={pin.listings.length}
                label={pin.venue.name}
                onClick={() => onPinClick(pin.venue.id)}
              />
            </HtmlMarker>
          )
        })}

      {map && userPosition && (
        <HtmlMarker map={map} lngLat={[userPosition.longitude, userPosition.latitude]} anchor="center" zIndex={0}>
          <UserDot />
        </HtmlMarker>
      )}

      {map && stackPin && stackContent && (
        <HtmlMarker
          map={map}
          lngLat={[stackPin.venue.longitude, stackPin.venue.latitude]}
          anchor="bottom"
          offset={[0, -48]}
          zIndex={10}
        >
          {stackContent}
        </HtmlMarker>
      )}

      <div className="app-map__top">
        {topBar}
        <IconButton label={userPosition ? 'Recenter on me' : `Recenter on ${city.defaultCenterName}`} variant="glass" onClick={recenter}>
          <Navigation />
        </IconButton>
      </div>
      {onToggleMapSize && (
        <div className="app-map__bottom">
          <IconButton
            className="app-map__resize"
            label={mapExpanded ? 'Shrink map' : 'Expand map'}
            aria-expanded={mapExpanded}
            variant="glass"
            onClick={onToggleMapSize}
          >
            {mapExpanded ? <Minimize2 /> : <Maximize2 />}
          </IconButton>
        </div>
      )}
    </div>
  )
}
