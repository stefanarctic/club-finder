/**
 * Basemap palette for the MapLibre style. MapLibre paints on a canvas and cannot read CSS
 * variables, so these mirror the ink/UV primitives in tokens.css. Keep both in sync.
 *
 * The basemap stays darker and lower-contrast than any UI surface so pins are the brightest
 * thing on the map.
 */
export const mapTheme = {
  background: '#07060b',
  land: '#0a0910',
  landuse: '#0d0b14',
  park: '#0c0e12',
  water: '#120d24',
  waterOutline: '#1c1438',
  building: '#110f19',
  buildingOutline: '#17141f',
  roadMinor: '#17141f',
  roadMajor: '#231e33',
  roadHighway: '#2f2647',
  roadCasing: '#07060b',
  rail: '#1b1726',
  boundary: '#2b2640',
  label: '#7b7491',
  labelMajor: '#a69ebb',
  labelHalo: '#050407',
  waterLabel: '#4d3f80',
} as const

export type MapTheme = typeof mapTheme
