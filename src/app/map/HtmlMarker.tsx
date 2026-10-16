import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Marker, type Map as MapLibreMap, type PositionAnchor } from 'maplibre-gl'

type HtmlMarkerProps = {
  map: MapLibreMap
  lngLat: [number, number]
  anchor?: PositionAnchor
  offset?: [number, number]
  zIndex?: number
  children: ReactNode
}

/** A MapLibre marker whose content is rendered by React through a portal. */
export function HtmlMarker({ map, lngLat, anchor = 'bottom', offset, zIndex, children }: HtmlMarkerProps) {
  const [element] = useState(() => document.createElement('div'))
  const markerRef = useRef<Marker | null>(null)
  const [lng, lat] = lngLat
  const [offsetX = 0, offsetY = 0] = offset ?? []

  useEffect(() => {
    const marker = new Marker({ element, anchor, offset: [offsetX, offsetY] })
      .setLngLat([lng, lat])
      .addTo(map)
    // The rendered button carries its own accessible name.
    element.removeAttribute('aria-label')
    markerRef.current = marker
    return () => {
      marker.remove()
      markerRef.current = null
    }
  }, [map, element, anchor, offsetX, offsetY])

  useEffect(() => {
    markerRef.current?.setLngLat([lng, lat])
  }, [lng, lat])

  useEffect(() => {
    element.style.zIndex = zIndex === undefined ? '' : String(zIndex)
  }, [element, zIndex])

  return createPortal(children, element)
}
