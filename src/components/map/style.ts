import type { ExpressionSpecification, LayerSpecification, Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import type { Lang } from '@/lib/i18n';
import type { Basemap } from '@/store/library';

// A custom "earth at night" basemap on top of OpenFreeMap vector tiles
// (OpenMapTiles schema) over Esri satellite imagery and AWS terrain.

const OFM = 'https://tiles.openfreemap.org';
const REGULAR = ['Noto Sans Regular'];
const BOLD = ['Noto Sans Bold'];
const ITALIC = ['Noto Sans Italic'];

export function labelField(lang: Lang): ExpressionSpecification {
  return lang === 'ru'
    ? ['coalesce', ['get', 'name:ru'], ['get', 'name:latin'], ['get', 'name']]
    : ['coalesce', ['get', 'name:en'], ['get', 'name:latin'], ['get', 'name']];
}

/** Label layers whose text follows the UI language. */
export const LABEL_LAYERS = ['label-ocean', 'label-country', 'label-state', 'label-city-major', 'label-city', 'label-town'];

const lineType = ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false] as ExpressionSpecification;
const pointType = ['match', ['geometry-type'], ['Point', 'MultiPoint'], true, false] as ExpressionSpecification;

const polyType = ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false] as ExpressionSpecification;

// Layers that belong to one basemap only carry `metadata.mode`; the rest are shared.
const SAT = { mode: 'satellite' };
const MAP = { mode: 'map' };

/** Road colours per basemap: white-ish over imagery, muted greys on the dark map. */
const ROADS: Record<Basemap, Record<string, string>> = {
  satellite: { 'road-minor': 'rgba(255, 255, 255, 0.35)', 'road-major': 'rgba(255, 236, 190, 0.55)', 'road-motorway': 'rgba(255, 210, 120, 0.75)' },
  map: { 'road-minor': 'rgba(150, 165, 200, 0.22)', 'road-major': 'rgba(170, 185, 220, 0.38)', 'road-motorway': 'rgba(255, 190, 120, 0.42)' },
};

/** Switch basemap, terrain and buildings on a live map without touching our data layers. */
export function applyMapMode(map: MapLibreMap, basemap: Basemap, view3d: boolean) {
  for (const layer of map.getStyle().layers) {
    const mode = (layer.metadata as { mode?: string } | undefined)?.mode;
    if (!mode) continue;
    const on = mode === basemap || (mode === '3d' && view3d) || (mode === 'map-flat' && basemap === 'map' && !view3d);
    map.setLayoutProperty(layer.id, 'visibility', on ? 'visible' : 'none');
  }
  for (const [id, color] of Object.entries(ROADS[basemap])) if (map.getLayer(id)) map.setPaintProperty(id, 'line-color', color);
  if (map.getLayer('buildings-3d')) {
    map.setPaintProperty('buildings-3d', 'fill-extrusion-color', basemap === 'satellite' ? '#e9e4da' : '#2a3350');
    map.setPaintProperty('buildings-3d', 'fill-extrusion-opacity', basemap === 'satellite' ? 0.82 : 0.9);
  }
  map.setTerrain(view3d ? { source: 'terrain', exaggeration: 1.4 } : null);
}

export function buildStyle(lang: Lang, basemap: Basemap = 'satellite', view3d = true): StyleSpecification {
  const name = labelField(lang);
  const vis = (on: boolean) => ({ visibility: on ? ('visible' as const) : ('none' as const) });
  const sat = basemap === 'satellite';
  const layers: LayerSpecification[] = [
    { id: 'background', type: 'background', paint: { 'background-color': sat ? '#0b1a2e' : '#0d111d' } },
    // Colour satellite imagery (like Google Earth), detailed down to street level.
    {
      id: 'satellite',
      type: 'raster',
      source: 'satellite',
      metadata: SAT,
      layout: vis(sat),
      paint: {
        'raster-fade-duration': 150,
        'raster-saturation': 0.1,
        'raster-contrast': 0.05,
        // Slightly dimmed from space so the station lights still glow.
        'raster-brightness-max': ['interpolate', ['linear'], ['zoom'], 0, 0.82, 6, 0.92, 10, 1],
      },
    },
    // ---- "plain map": a dark grey cartographic style ----
    {
      id: 'map-hillshade',
      type: 'hillshade',
      source: 'hillshade',
      metadata: MAP,
      layout: vis(!sat),
      paint: {
        'hillshade-shadow-color': 'rgba(0, 0, 0, 0.55)',
        'hillshade-highlight-color': 'rgba(150, 170, 220, 0.12)',
        'hillshade-accent-color': 'rgba(0, 0, 0, 0.2)',
        'hillshade-exaggeration': 0.45,
      },
    },
    {
      id: 'map-landcover',
      type: 'fill',
      source: 'omt',
      'source-layer': 'landcover',
      metadata: MAP,
      layout: vis(!sat),
      filter: ['match', ['get', 'class'], ['wood', 'forest', 'grass'], true, false],
      paint: { 'fill-color': '#122019', 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0.35, 10, 0.6] },
    },
    {
      id: 'map-landuse',
      type: 'fill',
      source: 'omt',
      'source-layer': 'landuse',
      minzoom: 8,
      metadata: MAP,
      layout: vis(!sat),
      filter: ['match', ['get', 'class'], ['residential', 'suburb', 'neighbourhood', 'commercial', 'industrial'], true, false],
      paint: { 'fill-color': '#171c2c', 'fill-opacity': 0.8 },
    },
    {
      id: 'map-park',
      type: 'fill',
      source: 'omt',
      'source-layer': 'park',
      minzoom: 8,
      metadata: MAP,
      layout: vis(!sat),
      paint: { 'fill-color': '#13241c', 'fill-opacity': 0.7 },
    },
    {
      id: 'map-water',
      type: 'fill',
      source: 'omt',
      'source-layer': 'water',
      metadata: MAP,
      layout: vis(!sat),
      filter: polyType,
      paint: { 'fill-color': '#0a1d3a' },
    },
    {
      id: 'map-waterway',
      type: 'line',
      source: 'omt',
      'source-layer': 'waterway',
      minzoom: 8,
      metadata: MAP,
      layout: vis(!sat),
      paint: { 'line-color': '#0f2546', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 14, 2.5] },
    },
    {
      id: 'map-buildings',
      type: 'fill',
      source: 'omt',
      'source-layer': 'building',
      minzoom: 13,
      metadata: { mode: 'map-flat' },
      layout: vis(!sat && !view3d),
      paint: { 'fill-color': '#1f2639', 'fill-outline-color': '#2b3450' },
    },
    {
      id: 'road-minor',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      minzoom: 11,
      filter: ['all', lineType, ['match', ['get', 'class'], ['minor', 'service', 'tertiary'], true, false]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ROADS[basemap]['road-minor'],
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 11, 0.4, 16, 5],
      },
    },
    {
      id: 'road-major',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      minzoom: 6,
      filter: ['all', lineType, ['match', ['get', 'class'], ['primary', 'secondary', 'trunk'], true, false]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ROADS[basemap]['road-major'],
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 6, 0.3, 12, 1.4, 16, 7],
      },
    },
    {
      id: 'road-motorway',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      minzoom: 4,
      filter: ['all', lineType, ['==', ['get', 'class'], 'motorway']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ROADS[basemap]['road-motorway'],
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 4, 0.3, 10, 1.4, 16, 9],
      },
    },
    {
      id: 'boundary-state',
      type: 'line',
      source: 'omt',
      'source-layer': 'boundary',
      minzoom: 3,
      filter: ['all', ['==', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]],
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': 'rgba(255, 255, 255, 0.25)',
        'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.4, 10, 1.2],
        'line-dasharray': [2, 2],
      },
    },
    {
      id: 'boundary-country',
      type: 'line',
      source: 'omt',
      'source-layer': 'boundary',
      filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': 'rgba(255, 230, 190, 0.55)',
        'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.45, 4, 0.9, 10, 1.8],
      },
    },
    // OpenStreetMap building footprints with heights, extruded in 3D.
    {
      id: 'buildings-3d',
      type: 'fill-extrusion',
      source: 'omt',
      'source-layer': 'building',
      minzoom: 14,
      metadata: { mode: '3d' },
      layout: vis(view3d),
      paint: {
        'fill-extrusion-color': sat ? '#e9e4da' : '#2a3350',
        'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 15, ['coalesce', ['get', 'render_height'], 8]],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': sat ? 0.82 : 0.9,
        'fill-extrusion-vertical-gradient': true,
      },
    },
    {
      id: 'label-ocean',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'water_name',
      minzoom: 2.2,
      maxzoom: 8,
      filter: ['all', pointType, ['match', ['get', 'class'], ['ocean', 'sea'], true, false]],
      layout: {
        'text-field': name,
        'text-font': ITALIC,
        'text-size': ['interpolate', ['linear'], ['zoom'], 1, 10, 6, 13],
        'text-letter-spacing': 0.22,
        'text-max-width': 6,
        'text-transform': 'uppercase',
      },
      paint: { 'text-color': 'rgba(130, 156, 210, 0.32)' },
    },
    {
      id: 'label-country',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'place',
      minzoom: 2.7,
      maxzoom: 7,
      filter: ['all', pointType, ['==', ['get', 'class'], 'country']],
      layout: {
        'text-field': name,
        'text-font': BOLD,
        'text-size': ['interpolate', ['linear'], ['zoom'], 2.7, ['match', ['get', 'rank'], 1, 10.5, 2, 10, 9], 5, 13],
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.16,
        'text-max-width': 7,
      },
      paint: {
        'text-color': 'rgba(255, 250, 240, 0.8)',
        'text-halo-color': 'rgba(0, 0, 0, 0.75)',
        'text-halo-width': 1.2,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], 2.7, 0, 3.2, 1],
      },
    },
    {
      id: 'label-state',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'place',
      minzoom: 4.5,
      maxzoom: 8,
      filter: ['all', pointType, ['==', ['get', 'class'], 'state']],
      layout: {
        'text-field': name,
        'text-font': REGULAR,
        'text-size': 10.5,
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.14,
        'text-max-width': 8,
      },
      paint: { 'text-color': 'rgba(255, 255, 255, 0.6)', 'text-halo-color': 'rgba(4, 6, 12, 0.8)', 'text-halo-width': 1 },
    },
    {
      id: 'label-city-major',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'place',
      minzoom: 3,
      maxzoom: 14,
      filter: ['all', pointType, ['==', ['get', 'class'], 'city'], ['<=', ['get', 'rank'], 3]],
      layout: {
        'text-field': name,
        'text-font': REGULAR,
        'text-size': ['interpolate', ['linear'], ['zoom'], 3, 11, 8, 15, 12, 18],
        'text-max-width': 8,
        'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
        'text-radial-offset': 0.9,
      },
      paint: {
        'text-color': 'rgba(255, 255, 255, 0.95)',
        'text-halo-color': 'rgba(0, 0, 0, 0.8)',
        'text-halo-width': 1.3,
      },
    },
    {
      id: 'label-city',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'place',
      minzoom: 5,
      maxzoom: 14,
      filter: ['all', pointType, ['==', ['get', 'class'], 'city'], ['>', ['get', 'rank'], 3]],
      layout: {
        'text-field': name,
        'text-font': REGULAR,
        'text-size': ['interpolate', ['linear'], ['zoom'], 5, 10.5, 10, 14],
        'text-max-width': 8,
        'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
        'text-radial-offset': 0.8,
      },
      paint: {
        'text-color': 'rgba(255, 255, 255, 0.9)',
        'text-halo-color': 'rgba(0, 0, 0, 0.8)',
        'text-halo-width': 1.2,
      },
    },
    {
      id: 'label-town',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'place',
      minzoom: 8,
      filter: ['all', pointType, ['match', ['get', 'class'], ['town', 'village'], true, false]],
      layout: {
        'text-field': name,
        'text-font': REGULAR,
        'text-size': ['interpolate', ['linear'], ['zoom'], 8, 10, 14, 13],
        'text-max-width': 8,
        'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
        'text-radial-offset': 0.7,
      },
      paint: {
        'text-color': 'rgba(255, 255, 255, 0.85)',
        'text-halo-color': 'rgba(0, 0, 0, 0.75)',
        'text-halo-width': 1,
      },
    },
  ];

  return {
    version: 8,
    name: 'RadioMap Night',
    projection: { type: 'globe' },
    glyphs: `${OFM}/fonts/{fontstack}/{range}.pbf`,
    ...(view3d ? { terrain: { source: 'terrain', exaggeration: 1.4 } } : {}),
    sky: {
      'sky-color': '#0a1538',
      'horizon-color': '#2d55b8',
      'fog-color': '#0a1124',
      'sky-horizon-blend': 0.55,
      'horizon-fog-blend': 0.6,
      'fog-ground-blend': 0.6,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 0.85, 4, 0.7, 7, 0],
    },
    sources: {
      omt: { type: 'vector', url: `${OFM}/planet` },
      satellite: {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        maxzoom: 19,
        attribution: 'Imagery © <a href="https://www.esri.com/" target="_blank">Esri</a>, Maxar, Earthstar Geographics',
      },
      hillshade: {
        type: 'raster-dem',
        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: 12,
      },
      terrain: {
        type: 'raster-dem',
        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: 14,
        attribution: 'Terrain: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank">AWS Terrain Tiles</a>',
      },
    },
    layers,
  };
}
