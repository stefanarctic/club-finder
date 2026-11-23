import { useEffect, useRef } from 'react'
import { Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl, type MapMouseEvent } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { mapStyle } from '../../map/mapStyle'

setWorkerUrl(workerUrl)

type PlacePinMapProps = {
  latitude: number | null
  longitude: number | null
  onPick: (latitude: number, longitude: number) => void
}

/** A small map. A click drops the venue pin and writes its coordinates. */
export function PlacePinMap({ latitude, longitude, onPick }: PlacePinMapProps) {
  const node = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick

  useEffect(() => {
    const container = node.current
    if (!container) return
    const map = new MapLibreMap({
      container,
      style: mapStyle,
      center: [26.1025, 44.4268],
      zoom: 11,
      attributionControl: false,
    })
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    map.on('click', (event: MapMouseEvent) => {
      onPickRef.current(event.lngLat.lat, event.lngLat.lng)
    })
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || latitude == null || longitude == null) return
    const lngLat: [number, number] = [longitude, latitude]
    if (!markerRef.current) markerRef.current = new Marker({ color: '#c4b5fd' }).setLngLat(lngLat).addTo(map)
    else markerRef.current.setLngLat(lngLat)
    map.easeTo({ center: lngLat, zoom: Math.max(map.getZoom(), 14) })
  }, [latitude, longitude])

  return <div ref={node} className="editor__map" />
}
