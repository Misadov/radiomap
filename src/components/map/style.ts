import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from 'maplibre-gl';
import type { Lang } from '@/lib/i18n';

// A custom "earth at night" basemap on top of OpenFreeMap vector tiles
// (OpenMapTiles schema) and Natural Earth shaded relief for the globe view.

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
const polyType = ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false] as ExpressionSpecification;
const pointType = ['match', ['geometry-type'], ['Point', 'MultiPoint'], true, false] as ExpressionSpecification;

export function buildStyle(lang: Lang): StyleSpecification {
  const name = labelField(lang);
  const layers: LayerSpecification[] = [
    // Grey relief over a navy base reads as moonlit land.
    { id: 'background', type: 'background', paint: { 'background-color': '#0c1830' } },
    {
      id: 'relief',
      type: 'raster',
      source: 'relief',
      maxzoom: 8,
      paint: {
        'raster-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.55, 5, 0.45, 7.5, 0],
        'raster-saturation': -1,
        'raster-brightness-min': 0,
        'raster-brightness-max': 0.36,
        'raster-contrast': 0.35,
        'raster-fade-duration': 0,
      },
    },
    {
      id: 'landcover-ice',
      type: 'fill',
      source: 'omt',
      'source-layer': 'landcover',
      filter: ['all', polyType, ['match', ['get', 'subclass'], ['glacier', 'ice_shelf'], true, false]],
      paint: { 'fill-color': '#1a2438', 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.55, 8, 0.25] },
    },
    {
      id: 'landuse-urban',
      type: 'fill',
      source: 'omt',
      'source-layer': 'landuse',
      minzoom: 7,
      filter: ['all', polyType, ['match', ['get', 'class'], ['residential', 'suburb', 'neighbourhood', 'commercial', 'industrial'], true, false]],
      paint: { 'fill-color': '#1b1d2b', 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0, 9, 0.55] },
    },
    {
      id: 'park',
      type: 'fill',
      source: 'omt',
      'source-layer': 'park',
      minzoom: 9,
      paint: { 'fill-color': '#0d1a1c', 'fill-opacity': 0.6 },
    },
    {
      id: 'water',
      type: 'fill',
      source: 'omt',
      'source-layer': 'water',
      filter: ['all', polyType, ['!=', ['get', 'brunnel'], 'tunnel']],
      paint: { 'fill-color': '#050a17', 'fill-antialias': true },
    },
    {
      id: 'waterway',
      type: 'line',
      source: 'omt',
      'source-layer': 'waterway',
      minzoom: 7,
      filter: lineType,
      paint: { 'line-color': '#07101f', 'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.5, 14, 2.5] },
    },
    {
      id: 'building',
      type: 'fill',
      source: 'omt',
      'source-layer': 'building',
      minzoom: 13,
      paint: { 'fill-color': '#161a28', 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 15, 0.9] },
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
        'line-color': 'rgba(255, 236, 210, 0.07)',
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
        'line-color': 'rgba(255, 186, 110, 0.13)',
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
        'line-color': 'rgba(255, 170, 90, 0.2)',
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
        'line-color': 'rgba(255, 255, 255, 0.08)',
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
        'line-color': 'rgba(255, 214, 160, 0.24)',
        'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.45, 4, 0.9, 10, 1.8],
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
        'text-color': 'rgba(245, 236, 220, 0.42)',
        'text-halo-color': 'rgba(4, 6, 12, 0.85)',
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
      paint: { 'text-color': 'rgba(220, 210, 195, 0.3)', 'text-halo-color': 'rgba(4, 6, 12, 0.8)', 'text-halo-width': 1 },
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
        'text-color': 'rgba(245, 240, 230, 0.72)',
        'text-halo-color': 'rgba(4, 6, 12, 0.9)',
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
        'text-color': 'rgba(245, 240, 230, 0.6)',
        'text-halo-color': 'rgba(4, 6, 12, 0.9)',
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
        'text-color': 'rgba(235, 228, 215, 0.45)',
        'text-halo-color': 'rgba(4, 6, 12, 0.85)',
        'text-halo-width': 1,
      },
    },
  ];

  return {
    version: 8,
    name: 'RadioMap Night',
    projection: { type: 'globe' },
    glyphs: `${OFM}/fonts/{fontstack}/{range}.pbf`,
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
      relief: {
        type: 'raster',
        tiles: [`${OFM}/natural_earth/ne2sr/{z}/{x}/{y}.png`],
        tileSize: 256,
        maxzoom: 6,
        attribution: '<a href="https://www.naturalearthdata.com/" target="_blank">Natural Earth</a>',
      },
    },
    layers,
  };
}
