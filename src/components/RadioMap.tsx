'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { RadioStation } from '@/types/radio';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { useFavorites } from '@/hooks/useFavorites';
import { useStationData } from '@/contexts/StationDataContext';
import { Loader, Radio } from 'lucide-react';
import StationPopup from '@/components/map/StationPopup';
import useSupercluster from 'use-supercluster';
import { useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import '@/styles/cluster.css';

// Dynamically import map components to avoid SSR issues
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });

// Wrapper that gets audio state without affecting marker memoization
const StationPopupWrapper = ({ station, onPlay, onToggleFavorite, isFav }: {
  station: RadioStation;
  onPlay: (station: RadioStation) => void;
  onToggleFavorite: (station: RadioStation) => void;
  isFav: boolean;
}) => {
  const { state } = useAudioPlayer();
  const isPlaying = state.currentStation?.stationuuid === station.stationuuid && state.isPlaying;
  const isLoading = state.isLoading && state.currentStation?.stationuuid === station.stationuuid;
  
  // If this station is currently playing (or loading), use the rich data from the player state
  // (which contains the resolved faviconUrl, full tags, etc.)
  const displayStation = (isPlaying || isLoading) && state.currentStation 
    ? { ...station, ...state.currentStation } 
    : station;

  if (isPlaying) {
     console.log('Popup render for active station:', displayStation.name, 'Favicon:', displayStation.favicon);
  }
  
  return (
    <StationPopup
      station={displayStation}
      onPlay={onPlay}
      onToggleFavorite={onToggleFavorite}
      isPlaying={isPlaying}
      isLoading={isLoading}
      isFav={isFav}
    />
  );
};

// Icons creation
const createIcons = () => {
  if (typeof window === 'undefined') return { station: null, cluster: null };
  
  const stationIcon = L.divIcon({
    html: `<div class="custom-radio-marker"></div>`,
    className: 'custom-radio-marker-container',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10],
  });

  const clusterIcon = (count: number, sizeClass: string) => L.divIcon({
    html: `<div class="custom-cluster-icon ${sizeClass}">${count}</div>`,
    className: 'cluster-wrapper',
    iconSize: L.point(40, 40, true),
  });

  return { station: stationIcon, cluster: clusterIcon };
};

// --- INNER COMPONENT FOR RENDERING CLUSTERS ---
function ClustersLayer({ points, setBounds, setZoom, onStationPlay, onToggleFavorite, isFavorite }: any) {
  const map = useMap();
  const [bounds, setLocalBounds] = useState<any>(null);
  const [zoom, setLocalZoom] = useState(3);
  const [icons, setIcons] = useState<any>({ station: null, cluster: null });

  // Update bounds/zoom on map events
  const updateMap = useCallback(() => {
    const b = map.getBounds();
    setLocalBounds([
      b.getSouthWest().lng,
      b.getSouthWest().lat,
      b.getNorthEast().lng,
      b.getNorthEast().lat,
    ]);
    setLocalZoom(map.getZoom());
    
    // Also notify parent if needed (optional)
    if (setBounds) setBounds(b);
    if (setZoom) setZoom(map.getZoom());
  }, [map, setBounds, setZoom]);

  useMapEvents({
    moveend: updateMap,
    zoomend: updateMap,
  });

  useEffect(() => {
    updateMap();
    setIcons(createIcons());
  }, [map, updateMap]);

  // Use supercluster hook
  const { clusters, supercluster } = useSupercluster({
    points,
    bounds: bounds || [-180, -85, 180, 85],
    zoom,
    options: { radius: 40, maxZoom: 14 }
  });

  return (
    <>
      {clusters.map((cluster: any) => {
        const [longitude, latitude] = cluster.geometry.coordinates;
        const { cluster: isCluster, point_count: pointCount } = cluster.properties;

        if (isCluster) {
          let sizeClass = 'cluster-small';
          if (pointCount > 5000) sizeClass = 'cluster-large';
          else if (pointCount > 500) sizeClass = 'cluster-medium';

          if (!icons.cluster) return null;

          return (
            <Marker
              key={`cluster-${cluster.id}`}
              position={[latitude, longitude]}
              icon={icons.cluster(pointCount, sizeClass)}
              eventHandlers={{
                click: () => {
                  const expansionZoom = Math.min(
                    supercluster.getClusterExpansionZoom(cluster.id) || 18,
                    18
                  );
                  map.setView([latitude, longitude], expansionZoom, {
                    animate: true,
                  });
                }
              }}
            />
          );
        }

        // Leaf Marker
        const station = cluster.properties.station;
        if (!icons.station) return null;

        return (
          <Marker
            key={station.stationuuid}
            position={[latitude, longitude]}
            icon={icons.station}
          >
            <Popup maxWidth={320} closeButton={false} className="custom-leaflet-popup">
              <StationPopupWrapper
                station={station}
                onPlay={onStationPlay}
                onToggleFavorite={onToggleFavorite}
                isFav={isFavorite(station.stationuuid)}
              />
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

export default function RadioMap() {
  const { playStation, state } = useAudioPlayer();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { stationsWithCoords: stations, loading, error, importStats, refresh } = useStationData();

  const handleStationPlay = useCallback(async (station: RadioStation) => {
    try {
      await playStation(station);
    } catch (err) {
      console.error('Map: Error playing station:', err);
    }
  }, [playStation]);

  const handleToggleFavorite = useCallback((station: RadioStation) => {
    toggleFavorite(station);
  }, [toggleFavorite]);

  // Convert stations to GeoJSON points
  const points = useMemo(() => {
    return stations.map(station => ({
      type: 'Feature' as const,
      properties: {
        cluster: false,
        stationId: station.stationuuid,
        station: station
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [station.geo_long, station.geo_lat]
      }
    }));
  }, [stations]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-black text-signal font-mono">
        <div className="text-center">
          <Loader className="w-12 h-12 animate-spin mx-auto mb-4" />
          <p className="text-lg tracking-widest uppercase">Initializing Signal...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-black text-on-air font-mono">
        <div className="text-center border border-on-air p-8 shadow-glow-on-air">
          <Radio className="w-12 h-12 mx-auto mb-4 animate-pulse" />
          <h3 className="text-xl font-bold uppercase mb-2">Signal Lost</h3>
          <p className="text-sm opacity-70 mb-6 max-w-md">{error}</p>
          <button onClick={refresh} className="px-6 py-2 border border-on-air hover:bg-on-air hover:text-black transition-colors uppercase text-sm tracking-wider font-bold">
            Reconnect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen w-full relative bg-tech-900 ${state.currentStation ? 'pb-20' : ''}`}>
      
      {/* Map Stats Overlay */}
      <div className="absolute top-6 right-6 z-[1000] pointer-events-none">
         <div className="bg-black/80 backdrop-blur border border-tech-700 px-4 py-2 text-xs font-mono text-tech-400 flex items-center gap-3 shadow-panel">
            <span className="flex items-center gap-2">
               <span className="w-2 h-2 rounded-full bg-signal animate-pulse"></span>
               ONLINE
            </span>
            <span className="text-tech-600">|</span>
            <span className="text-white font-bold">{stations.length.toLocaleString()}</span> STATIONS
            {importStats && (
              <>
                <span className="text-tech-600">|</span>
                <span className="text-signal">{importStats.coveragePercentage}%</span> GEOCODED
              </>
            )}
         </div>
      </div>

      {/* Map Container */}
      <MapContainer
        center={[20, 0]}
        zoom={3}
        minZoom={2}
        maxZoom={18}
        zoomControl={false}
        style={{ height: '100%', width: '100%', background: '#000' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
        />
        
        {/* Render Clusters Logic Inside Context */}
        <ClustersLayer 
           points={points} 
           onStationPlay={handleStationPlay}
           onToggleFavorite={handleToggleFavorite}
           isFavorite={isFavorite}
        />
      </MapContainer>
    </div>
  );
}
