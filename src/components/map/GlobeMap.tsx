'use client';

import { useEffect, useRef } from 'react';
import {
  Map as MapLibre,
  Marker,
  setWorkerUrl,
  type ExpressionSpecification,
  type GeoJSONSource,
  type LayerSpecification,
  type MapLayerMouseEvent,
} from 'maplibre-gl';
import pkg from 'maplibre-gl/package.json';
import { GENRES } from '@/lib/genres';
import { formatNumber } from '@/lib/i18n';
import { mapBus } from '@/lib/map-bus';
import { PlaceKind, type PlacesFile } from '@/lib/types';
import { engine } from '@/lib/audio/engine';
import { placeContext, placeName, useData } from '@/store/data';
import { useLibrary } from '@/store/library';
import { usePlayer } from '@/store/player';
import { useUI } from '@/store/ui';
import { buildStyle, LABEL_LAYERS, labelField } from './style';

setWorkerUrl(`/vendor/maplibre/${pkg.version}/maplibre-gl-worker.mjs`);

const SOURCE = 'places';
const WORLD_ZOOM = 2.4;

// ----------------------------------------------------------------- styling

const LOG_N: ExpressionSpecification = ['ln', ['+', 1, ['get', 'n']]];

function radius(scale = 1, extra = 0): ExpressionSpecification {
  const stop = (base: number, k: number): ExpressionSpecification => ['+', base * scale + extra, ['*', k * scale, LOG_N]];
  return ['interpolate', ['exponential', 1.4], ['zoom'], 0, stop(0.7, 0.32), 3, stop(1.25, 0.55), 6, stop(2.3, 0.95), 10, stop(4, 1.35), 14, stop(6, 1.8)];
}

function mix(hex: string, other: string, t: number) {
  const a = parseInt(hex.slice(1), 16);
  const b = parseInt(other.slice(1), 16);
  const ch = (shift: number) => Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

function palette(genre: number) {
  if (genre < 0) return { low: '#ff9a3c', mid: '#ffc35e', high: '#fff2d2', glow: '#ff8a30' };
  const c = GENRES[genre].color;
  return { low: mix(c, '#000000', 0.15), mid: c, high: mix(c, '#ffffff', 0.7), glow: c };
}

function coreColor(genre: number): ExpressionSpecification {
  const p = palette(genre);
  return [
    'case',
    ['==', ['get', 'n'], 0],
    'rgba(120, 128, 150, 0.35)',
    ['interpolate', ['linear'], LOG_N, 0.6, p.low, 3, p.mid, 5.6, p.high],
  ];
}

function placeLayers(genre: number): LayerSpecification[] {
  const p = palette(genre);
  const hover: ExpressionSpecification = ['boolean', ['feature-state', 'hover'], false];
  return [
    {
      id: 'places-glow',
      type: 'circle',
      source: SOURCE,
      filter: ['>', ['get', 'n'], 0],
      layout: { 'circle-sort-key': ['get', 'n'] },
      paint: {
        'circle-radius': radius(3.1),
        'circle-color': p.glow,
        'circle-blur': 1,
        'circle-opacity': 0,
        'circle-opacity-transition': { duration: 1800, delay: 200 },
        'circle-pitch-alignment': 'map',
      },
    },
    {
      id: 'places-core',
      type: 'circle',
      source: SOURCE,
      filter: ['!=', ['get', 'k'], PlaceKind.Region],
      layout: { 'circle-sort-key': ['get', 'n'] },
      paint: {
        'circle-radius': radius(1),
        'circle-color': coreColor(genre),
        'circle-blur': ['interpolate', ['linear'], ['zoom'], 1, 0.55, 6, 0.15],
        'circle-opacity': 0,
        'circle-opacity-transition': { duration: 1400 },
        'circle-stroke-width': ['case', hover, 2, 0],
        'circle-stroke-color': '#ffffff',
        'circle-pitch-alignment': 'map',
      },
    },
    {
      id: 'places-region',
      type: 'circle',
      source: SOURCE,
      filter: ['==', ['get', 'k'], PlaceKind.Region],
      layout: { 'circle-sort-key': ['get', 'n'] },
      paint: {
        'circle-radius': radius(1.35, 1),
        'circle-color': 'rgba(0, 0, 0, 0)',
        'circle-opacity': 0,
        'circle-opacity-transition': { duration: 1400 },
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 1, ['case', hover, 2.2, 0.8], 6, ['case', hover, 2.4, 1.4]],
        'circle-stroke-color': ['case', hover, '#ffffff', coreColor(genre)],
        'circle-stroke-opacity': 0,
        'circle-stroke-opacity-transition': { duration: 1400 },
        'circle-pitch-alignment': 'map',
      },
    },
    {
      id: 'places-hit',
      type: 'circle',
      source: SOURCE,
      filter: ['>', ['get', 'n'], 0],
      paint: { 'circle-radius': radius(1, 7), 'circle-opacity': 0, 'circle-pitch-alignment': 'map' },
    },
  ];
}

function placesGeoJSON(places: PlacesFile, counts: ArrayLike<number> | null): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = new Array(places.count);
  for (let p = 0; p < places.count; p++) {
    features[p] = {
      type: 'Feature',
      id: p,
      geometry: { type: 'Point', coordinates: [places.lng[p], places.lat[p]] },
      properties: { n: counts ? counts[p] : places.stations[p], t: places.stations[p], k: places.kind[p] },
    };
  }
  return { type: 'FeatureCollection', features };
}

/** Matching station count per place for a genre filter (null = no filter). */
function genreCounts(genre: number): Int32Array | null {
  const { places, stations } = useData.getState();
  if (genre < 0 || !places || !stations) return null;
  const counts = new Int32Array(places.count);
  const bit = 1 << genre;
  for (let i = 0; i < stations.count; i++) {
    const p = stations.place[i];
    if (p >= 0 && stations.genres[i] & bit) counts[p]++;
  }
  return counts;
}

// ------------------------------------------------------------------ layout

/** Space taken by floating UI (side panel, player, mobile sheet) over the map. */
function occludedPadding(container: HTMLElement): { top: number; bottom: number; left: number; right: number } {
  const box = container.getBoundingClientRect();
  let top = 0;
  let bottom = 0;
  let left = 0;
  let right = 0;
  document.querySelectorAll<HTMLElement>('[data-occludes-map]').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || r.bottom <= box.top || r.top >= box.bottom) return;
    const side = el.dataset.occludesMap;
    if (side === 'left') left = Math.max(left, r.right - box.left + 8);
    if (side === 'right') right = Math.max(right, box.right - r.left + 8);
    if (side === 'bottom') bottom = Math.max(bottom, box.bottom - r.top + 8);
    if (side === 'top') top = Math.max(top, r.bottom - box.top + 8);
  });
  // Never squeeze the globe into a sliver.
  const maxV = box.height * 0.62;
  if (top + bottom > maxV) bottom = Math.max(0, maxV - top);
  return { top, bottom, left: Math.min(left, box.width * 0.5), right: Math.min(right, box.width * 0.35) };
}

/** Zoom at which the whole globe fills ~68% of the space left free by the panels. */
function fitGlobeZoom(container: HTMLElement, lat: number) {
  const pad = occludedPadding(container);
  const free = Math.min(container.clientWidth - pad.left - pad.right, container.clientHeight - pad.top - pad.bottom);
  const diameter = Math.max(220, Math.min(820, free * 0.68));
  return Math.log2((diameter * Math.PI) / (512 * Math.cos((lat * Math.PI) / 180)));
}

function initialCenter(): [number, number] {
  // Face the visitor's side of the planet, guessed from their time zone.
  const lng = -new Date().getTimezoneOffset() / 4;
  return [Math.max(-170, Math.min(170, lng)), 24];
}

export default function GlobeMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const tooltip = tooltipRef.current;
    const halo = haloRef.current;
    if (!container || !tooltip || !halo) return;

    const mobile = window.matchMedia('(max-width: 767px)').matches;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const center = initialCenter();
    const map = new MapLibre({
      container,
      style: buildStyle(useLibrary.getState().lang),
      center,
      zoom: fitGlobeZoom(container, center[1]),
      minZoom: 0.6,
      maxZoom: 15,
      maxPitch: 0,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      attributionControl: { compact: true },
      maplibreLogo: false,
      fadeDuration: 200,
      canvasContextAttributes: { antialias: true },
    });
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();

    let ready = false;
    let dataShown = false;
    let disposed = false;
    // Slow idle rotation until the visitor touches the globe.
    let spinning = !reducedMotion;

    // ---- padding follows the floating UI ------------------------------------
    // Debounced to a frame and skipped when unchanged: setting padding cancels any
    // camera animation in flight, so mid-flight changes wait for the camera to settle.
    let paddingFrame = 0;
    let appliedPadding = '';
    const updatePadding = () => {
      cancelAnimationFrame(paddingFrame);
      paddingFrame = requestAnimationFrame(() => {
        if (disposed) return;
        const pad = occludedPadding(container);
        const key = [pad.top, pad.bottom, pad.left, pad.right].map(Math.round).join('|');
        if (key === appliedPadding) return;
        if (map.isMoving() && !spinning) {
          map.once('moveend', updatePadding);
          return;
        }
        appliedPadding = key;
        if (spinning || !ready) map.setPadding(pad);
        else map.easeTo({ padding: pad, duration: 450, easing: (t) => 1 - Math.pow(1 - t, 3) });
        updateHalo();
      });
    };
    const ro = new ResizeObserver(() => updatePadding());
    const observeOccluders = () => document.querySelectorAll('[data-occludes-map]').forEach((el) => ro.observe(el));
    // Panels mount as shallow children of <main>; watching the whole subtree would fire on
    // every list re-render, so look at direct children plus the marker attribute only.
    const onPanelsChanged = () => {
      observeOccluders();
      updatePadding();
    };
    const root = container.closest('main') ?? document.body;
    const mo = new MutationObserver(onPanelsChanged);
    const attrObserver = new MutationObserver(onPanelsChanged);
    mo.observe(root, { childList: true });
    attrObserver.observe(root, { subtree: true, attributes: true, attributeFilter: ['data-occludes-map'] });
    window.addEventListener('radiomap:layout', updatePadding);
    observeOccluders();

    // ---- soft glow around the globe's silhouette (fades out as we zoom in) ----
    const updateHalo = () => {
      const zoom = map.getZoom();
      const opacity = Math.max(0, Math.min(1, (4 - zoom) / 1.5));
      halo.style.opacity = String(opacity);
      if (!opacity) return;
      const { lat } = map.getCenter();
      const { top = 0, bottom = 0, left = 0, right = 0 } = map.getPadding();
      const r = ((512 * 2 ** zoom) / (2 * Math.PI)) * Math.cos((lat * Math.PI) / 180) * 0.985;
      const cx = left + (container.clientWidth - left - right) / 2;
      // With zero pitch the camera orbits the globe, so its centre stays at the (padded) viewport centre.
      const cy = top + (container.clientHeight - top - bottom) / 2;
      halo.style.width = halo.style.height = `${r * 2}px`;
      halo.style.transform = `translate(${cx - r}px, ${cy - r}px)`;
    };
    map.on('move', updateHalo);
    map.on('resize', updateHalo);

    // ---- idle spin -----------------------------------------------------------
    const spin = () => {
      if (!spinning || disposed || map.getZoom() > 3) return;
      const c = map.getCenter();
      map.easeTo({ center: [c.lng + (mobile ? 3 : 2.4), c.lat], duration: 1000, easing: (t) => t });
    };
    const stopSpin = () => {
      if (!spinning) return;
      spinning = false;
      map.stop();
    };
    for (const ev of ['mousedown', 'touchstart', 'wheel', 'dragstart'] as const) map.on(ev, stopSpin);
    map.on('moveend', () => spinning && spin());

    // ---- places data -----------------------------------------------------------
    const showPlaces = () => {
      const { places } = useData.getState();
      if (!ready || !places) return;
      const genre = useUI.getState().genre;
      const data = placesGeoJSON(places, genreCounts(genre));
      const source = map.getSource<GeoJSONSource>(SOURCE);
      if (source) {
        source.setData(data);
      } else {
        map.addSource(SOURCE, { type: 'geojson', data, buffer: 32, maxzoom: 12 });
        const beforeId = map.getLayer('label-ocean') ? 'label-ocean' : undefined;
        for (const layer of placeLayers(genre)) map.addLayer(layer, beforeId);
      }
      if (!dataShown) {
        dataShown = true;
        performance.mark('radiomap:places');
        requestAnimationFrame(() => {
          map.setPaintProperty('places-glow', 'circle-opacity', ['interpolate', ['linear'], ['zoom'], 1, 0.2, 8, 0.12]);
          map.setPaintProperty('places-core', 'circle-opacity', 1);
          map.setPaintProperty('places-region', 'circle-opacity', 1);
          map.setPaintProperty('places-region', 'circle-stroke-opacity', 0.9);
        });
      }
      computeInView();
    };

    const applyGenre = (genre: number) => {
      if (!ready || !map.getSource(SOURCE)) return;
      const { places } = useData.getState();
      if (!places) return;
      map.getSource<GeoJSONSource>(SOURCE)?.setData(placesGeoJSON(places, genreCounts(genre)));
      const p = palette(genre);
      map.setPaintProperty('places-core', 'circle-color', coreColor(genre));
      map.setPaintProperty('places-glow', 'circle-color', p.glow);
      map.setPaintProperty('places-region', 'circle-stroke-color', ['case', ['boolean', ['feature-state', 'hover'], false], '#ffffff', coreColor(genre)]);
      map.once('idle', computeInView);
    };

    // ---- stations in view --------------------------------------------------
    let lastInView = '';
    function computeInView() {
      const { derived, stations } = useData.getState();
      if (!derived || !stations || !map.getLayer('places-hit')) return;
      const genre = useUI.getState().genre;
      const bit = genre < 0 ? 0 : 1 << genre;
      const world = map.getZoom() < WORLD_ZOOM;
      const list: number[] = [];
      if (world) {
        for (let i = 0; i < stations.count && list.length < 400; i++) if (!bit || stations.genres[i] & bit) list.push(i);
      } else {
        const seen = new Set<number>();
        for (const f of map.queryRenderedFeatures({ layers: ['places-hit'] })) seen.add(f.id as number);
        for (const p of seen) for (const i of derived.placeStations[p]) if (!bit || stations.genres[i] & bit) list.push(i);
        list.sort((a, b) => a - b);
        list.length = Math.min(list.length, 400);
      }
      const key = `${world}|${list.length}|${list[0]}|${list[list.length - 1]}|${list[Math.floor(list.length / 2)]}`;
      if (key === lastInView) return;
      lastInView = key;
      useUI.getState().setInView(list, world);
    }
    map.on('moveend', () => {
      if (!spinning) computeInView();
    });

    // ---- hover & click -----------------------------------------------------
    let hovered: number | null = null;
    const setHover = (id: number | null) => {
      if (hovered === id) return;
      if (hovered !== null) map.setFeatureState({ source: SOURCE, id: hovered }, { hover: false });
      hovered = id;
      if (id !== null) map.setFeatureState({ source: SOURCE, id }, { hover: true });
    };

    const pick = (e: MapLayerMouseEvent) => {
      let best: number | null = null;
      let bestScore = Infinity;
      for (const f of e.features ?? []) {
        const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates;
        const pt = map.project([lng, lat]);
        const d = Math.hypot(pt.x - e.point.x, pt.y - e.point.y) - Math.log1p(Number(f.properties?.n ?? 0));
        if (d < bestScore) {
          bestScore = d;
          best = f.id as number;
        }
      }
      return best;
    };

    if (window.matchMedia('(hover: hover)').matches) {
      map.on('mousemove', 'places-hit', (e) => {
        const id = pick(e);
        setHover(id);
        map.getCanvas().style.cursor = id === null ? '' : 'pointer';
        if (id === null) return;
        const { places } = useData.getState();
        const lang = useLibrary.getState().lang;
        if (!places) return;
        const n = Number(e.features?.find((f) => f.id === id)?.properties?.n ?? places.stations[id]);
        tooltip.querySelector('[data-name]')!.textContent = placeName(id, lang);
        tooltip.querySelector('[data-sub]')!.textContent = placeContext(id, lang);
        tooltip.querySelector('[data-count]')!.textContent = formatNumber(n, lang);
        tooltip.style.transform = `translate(${e.point.x + 16}px, ${e.point.y - 12}px)`;
        tooltip.dataset.visible = 'true';
      });
      map.on('mouseleave', 'places-hit', () => {
        setHover(null);
        map.getCanvas().style.cursor = '';
        tooltip.dataset.visible = 'false';
      });
    }

    map.on('click', 'places-hit', (e) => {
      const id = pick(e);
      if (id === null) return;
      stopSpin();
      tooltip.dataset.visible = 'false';
      useUI.getState().select({ kind: 'place', place: id });
      if (mobile && useUI.getState().sheet === 'peek') useUI.getState().setSheet('half');
      flyToPlace(id, true);
    });

    // ---- camera commands -----------------------------------------------------
    function flyToPlace(p: number, fromMap = false) {
      const { places } = useData.getState();
      if (!places) return;
      stopSpin();
      const kind = places.kind[p];
      const target = kind === PlaceKind.Region ? 6 : kind === PlaceKind.Point ? 8.5 : 7.5;
      const zoom = map.getZoom();
      const center: [number, number] = [places.lng[p], places.lat[p]];
      if (fromMap && zoom >= 5) {
        map.easeTo({ center, duration: 600 });
        return;
      }
      map.flyTo({ center, zoom: Math.max(zoom, target), speed: 1.3, curve: 1.5, essential: true });
    }

    function flyToCountry(cc: string) {
      const { places } = useData.getState();
      if (!places) return;
      stopSpin();
      const lngs: number[] = [];
      const lats: number[] = [];
      for (let p = 0; p < places.count; p++) {
        if (places.country[p] !== cc) continue;
        lngs.push(places.lng[p]);
        lats.push(places.lat[p]);
      }
      if (!lngs.length) return;
      // Trim the extremes so far-flung outposts (Alaska, overseas islands) don't blow up the view.
      const trim = lngs.length > 20 ? 0.04 : 0;
      const q = (arr: number[], t: number) => [...arr].sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor(arr.length * t))];
      map.fitBounds(
        [
          [q(lngs, trim), q(lats, trim)],
          [q(lngs, 1 - trim), q(lats, 1 - trim)],
        ],
        { maxZoom: 6, duration: 1600, essential: true, padding: 40 },
      );
    }

    const offBus = mapBus.subscribe((cmd) => {
      if (!ready) return;
      switch (cmd.type) {
        case 'fly-place':
          flyToPlace(cmd.place);
          break;
        case 'fly-country':
          flyToCountry(cmd.cc);
          break;
        case 'fly-to':
          stopSpin();
          map.flyTo({ center: [cmd.lng, cmd.lat], zoom: cmd.zoom, speed: 1.3, essential: true });
          break;
        case 'reset':
          stopSpin();
          map.flyTo({ center: [map.getCenter().lng, 20], zoom: fitGlobeZoom(container, 20), speed: 1.2, essential: true });
          break;
        case 'zoom':
          stopSpin();
          map.easeTo({ zoom: map.getZoom() + cmd.delta, duration: 350 });
          break;
      }
    });

    // ---- markers: selection and the station on air --------------------------
    const selEl = document.createElement('div');
    selEl.className = 'marker-selected';
    const selectionMarker = new Marker({ element: selEl, anchor: 'center' });

    const playEl = document.createElement('div');
    playEl.className = 'marker-playing';
    playEl.innerHTML = '<span class="wave"></span><span class="wave"></span><span class="wave"></span><span class="core"></span>';
    const playingMarker = new Marker({ element: playEl, anchor: 'center' });
    const core = playEl.querySelector<HTMLElement>('.core')!;

    const syncSelection = () => {
      const { selection } = useUI.getState();
      const { places } = useData.getState();
      if (ready && places && selection?.kind === 'place') {
        selectionMarker.setLngLat([places.lng[selection.place], places.lat[selection.place]]).addTo(map);
      } else {
        selectionMarker.remove();
      }
    };

    let levelFrame = 0;
    let level = 0;
    const animateLevel = () => {
      const l = engine.level();
      level = l < 0 ? 0 : Math.max(l, level * 0.82);
      core.style.setProperty('--level', level.toFixed(3));
      levelFrame = requestAnimationFrame(animateLevel);
    };

    const syncPlaying = () => {
      const { station, status, analysis } = usePlayer.getState();
      const { places } = useData.getState();
      const p = station?.place ?? -1;
      if (ready && places && p >= 0) {
        playingMarker.setLngLat([places.lng[p], places.lat[p]]).addTo(map);
      } else {
        playingMarker.remove();
      }
      playEl.classList.toggle('is-loading', status === 'loading');
      playEl.classList.toggle('is-paused', status !== 'playing' && status !== 'loading');
      cancelAnimationFrame(levelFrame);
      if (status === 'playing' && analysis) levelFrame = requestAnimationFrame(animateLevel);
      else core.style.setProperty('--level', '0');
    };

    // ---- store subscriptions ---------------------------------------------------
    const unsubs = [
      useData.subscribe((s, prev) => {
        if (s.places !== prev.places) showPlaces();
        if (s.derived !== prev.derived) {
          if (useUI.getState().genre >= 0) applyGenre(useUI.getState().genre);
          computeInView();
          syncPlaying();
        }
      }),
      useUI.subscribe((s, prev) => {
        if (s.genre !== prev.genre) {
          lastInView = '';
          applyGenre(s.genre);
        }
        if (s.selection !== prev.selection) syncSelection();
      }),
      usePlayer.subscribe((s, prev) => {
        if (s.station !== prev.station || s.status !== prev.status || s.analysis !== prev.analysis) syncPlaying();
      }),
      useLibrary.subscribe((s, prev) => {
        if (s.lang === prev.lang || !ready) return;
        for (const id of LABEL_LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, 'text-field', labelField(s.lang));
      }),
    ];

    // Our layers only need the style, not the basemap tiles: draw the lights right away.
    map.once('style.load', () => {
      ready = true;
      updatePadding();
      showPlaces();
      syncSelection();
      syncPlaying();
    });
    map.once('load', () => {
      container.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
      if (spinning) setTimeout(spin, 400);
    });

    return () => {
      disposed = true;
      unsubs.forEach((u) => u());
      offBus();
      ro.disconnect();
      mo.disconnect();
      attrObserver.disconnect();
      cancelAnimationFrame(paddingFrame);
      window.removeEventListener('radiomap:layout', updatePadding);
      cancelAnimationFrame(levelFrame);
      map.remove();
    };
  }, []);

  return (
    <div className="absolute inset-0">
      <div
        ref={haloRef}
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 rounded-full opacity-0"
        style={{
          boxShadow: '0 0 60px 8px rgba(70, 110, 220, 0.22), 0 0 160px 40px rgba(50, 80, 190, 0.14), inset 0 0 40px rgba(90, 130, 255, 0.08)',
        }}
      />
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} aria-label="Map of radio stations" role="region" />
      <div
        ref={tooltipRef}
        data-visible="false"
        className="pointer-events-none absolute top-0 left-0 z-10 max-w-64 rounded-xl border border-line-2 bg-panel-solid/90 px-3 py-2 shadow-2xl backdrop-blur-md transition-opacity duration-150 data-[visible=false]:opacity-0"
      >
        <div className="flex items-baseline gap-2">
          <span data-name className="truncate text-[13px] font-semibold text-fg" />
          <span data-count className="font-mono text-[11px] text-accent" />
        </div>
        <div data-sub className="truncate text-[11.5px] text-fg-3" />
      </div>
    </div>
  );
}
