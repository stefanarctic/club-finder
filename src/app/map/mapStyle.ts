import type { ExpressionSpecification, StyleSpecification } from 'maplibre-gl'
import { mapTheme as t } from '../../design-system'

/*
 * Basemap: OpenFreeMap vector tiles (OpenMapTiles schema, no API key), painted with the design
 * system's map palette. Deliberately darker and flatter than any UI surface so pins stay brightest.
 */

const font = (weight: 'Regular' | 'Bold' | 'Italic') => [`Noto Sans ${weight}`]
const name: ExpressionSpecification = ['coalesce', ['get', 'name:latin'], ['get', 'name']]
const byZoom = (...stops: number[]): ExpressionSpecification => [
  'interpolate',
  ['exponential', 1.5],
  ['zoom'],
  ...stops,
]

export const mapStyle: StyleSpecification = {
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': t.land } },
    {
      id: 'landuse',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landuse',
      filter: ['in', ['get', 'class'], ['literal', ['residential', 'commercial', 'industrial', 'retail']]],
      paint: { 'fill-color': t.landuse },
    },
    {
      id: 'park',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'park',
      paint: { 'fill-color': t.park },
    },
    {
      id: 'landcover',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landcover',
      filter: ['in', ['get', 'class'], ['literal', ['wood', 'grass']]],
      paint: { 'fill-color': t.park },
    },
    {
      id: 'water',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'water',
      paint: { 'fill-color': t.water, 'fill-outline-color': t.waterOutline },
    },
    {
      id: 'waterway',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'waterway',
      paint: { 'line-color': t.water, 'line-width': byZoom(10, 1, 16, 5) },
    },
    {
      id: 'building',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 13,
      paint: { 'fill-color': t.building, 'fill-outline-color': t.buildingOutline },
    },
    {
      id: 'rail',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['rail', 'transit']]],
      paint: { 'line-color': t.rail, 'line-width': 1, 'line-dasharray': [3, 3] },
    },
    {
      id: 'road-minor',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      minzoom: 12,
      filter: ['in', ['get', 'class'], ['literal', ['minor', 'service', 'tertiary']]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': t.roadMinor, 'line-width': byZoom(12, 0.5, 18, 10) },
    },
    {
      id: 'road-major-casing',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['primary', 'secondary', 'trunk']]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': t.roadCasing, 'line-width': byZoom(10, 1.5, 18, 22) },
    },
    {
      id: 'road-major',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['primary', 'secondary', 'trunk']]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': t.roadMajor, 'line-width': byZoom(10, 1, 18, 18) },
    },
    {
      id: 'road-highway',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['==', ['get', 'class'], 'motorway'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': t.roadHighway, 'line-width': byZoom(8, 1, 18, 22) },
    },
    {
      id: 'boundary',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'boundary',
      filter: ['<=', ['get', 'admin_level'], 4],
      paint: { 'line-color': t.boundary, 'line-width': 1, 'line-dasharray': [2, 2] },
    },
    {
      id: 'road-label',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'transportation_name',
      minzoom: 14,
      filter: ['in', ['get', 'class'], ['literal', ['primary', 'secondary', 'trunk', 'tertiary']]],
      layout: {
        'symbol-placement': 'line',
        'text-field': name,
        'text-font': font('Regular'),
        'text-size': 10,
      },
      paint: { 'text-color': t.label, 'text-halo-color': t.labelHalo, 'text-halo-width': 1.2 },
    },
    {
      id: 'water-label',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'water_name',
      layout: { 'text-field': name, 'text-font': font('Italic'), 'text-size': 11 },
      paint: { 'text-color': t.waterLabel, 'text-halo-color': t.labelHalo, 'text-halo-width': 1 },
    },
    {
      id: 'place-neighbourhood',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      minzoom: 11,
      filter: ['in', ['get', 'class'], ['literal', ['suburb', 'neighbourhood', 'quarter']]],
      layout: {
        'text-field': name,
        'text-font': font('Bold'),
        'text-size': byZoom(11, 9, 16, 12),
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.12,
        'text-max-width': 8,
      },
      paint: { 'text-color': t.label, 'text-halo-color': t.labelHalo, 'text-halo-width': 1.4 },
    },
    {
      id: 'place-city',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      maxzoom: 12,
      filter: ['in', ['get', 'class'], ['literal', ['city', 'town']]],
      layout: {
        'text-field': name,
        'text-font': font('Bold'),
        'text-size': 14,
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.18,
      },
      paint: { 'text-color': t.labelMajor, 'text-halo-color': t.labelHalo, 'text-halo-width': 1.6 },
    },
  ],
}
