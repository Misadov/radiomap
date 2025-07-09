'use client';

import { useState, useCallback, useMemo, memo, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { RadioStation } from '@/types/radio';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { useFavorites } from '@/hooks/useFavorites';
import { useStationData } from '@/contexts/StationDataContext';
import { MapPin, Play, Radio, Loader, Heart, Pause } from 'lucide-react';
import StationImage from '@/components/shared/StationImage';
import '@/styles/cluster.css';

// Dynamically import map components to avoid SSR issues
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });
const MarkerClusterGroup = dynamic(() => import('react-leaflet-cluster'), { ssr: false });

// Wrapper that gets audio state without affecting marker memoization
const StationPopupWrapper = ({ station, onPlay, onToggleFavorite, isFav }: {
  station: RadioStation;
  onPlay: (station: RadioStation) => void;
  onToggleFavorite: (station: RadioStation) => void;
  isFav: boolean;
}) => {
  const { state } = useAudioPlayer();
  
  return (
    <StationPopup
      station={station}
      onPlay={onPlay}
      onToggleFavorite={onToggleFavorite}
      isPlaying={state.currentStation?.stationuuid === station.stationuuid && state.isPlaying}
      isLoading={state.isLoading && state.currentStation?.stationuuid === station.stationuuid}
      isFav={isFav}
    />
  );
};

// Beautiful station popup with full features (but audio state passed as props)
const StationPopup = memo(({ station, onPlay, onToggleFavorite, isPlaying, isLoading, isFav }: {
  station: RadioStation;
  onPlay: (station: RadioStation) => void;
  onToggleFavorite: (station: RadioStation) => void;
  isPlaying: boolean;
  isLoading: boolean;
  isFav: boolean;
}) => (
  <div className="p-3 min-w-[280px] bg-gray-800 rounded-lg">
    <div className="flex items-start space-x-4">
      {/* Station Image */}
      <div className="flex-shrink-0">
        <StationImage station={station} />
      </div>
      
      {/* Station Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-white text-base truncate mb-1">
          {station.name}
        </h3>
        <p className="text-sm text-gray-300 mb-2">
          {station.country}
          {station.language && ` • ${station.language}`}
        </p>
        {station.geocoded_location && (
          <p className="text-xs text-blue-400 mb-2 flex items-center">
            🌍 {station.geocoded_location}
            <span className="ml-1 text-gray-500">({station.geocoded_type})</span>
          </p>
        )}
        {station.tags && (
          <p className="text-xs text-gray-400 mb-3 line-clamp-2">
            {station.tags.split(',').slice(0, 3).join(', ')}
          </p>
        )}
        
        {/* Stats and Action Buttons */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-gray-400 space-y-1">
            <div className="flex items-center">
              <span>👥 {station.votes} votes</span>
            </div>
            {station.bitrate && (
              <div className="flex items-center">
                <span>🎵 {station.bitrate} kbps</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleFavorite(station);
              }}
              className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 ${
                isFav
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-gray-700 text-gray-300 hover:bg-red-500 hover:text-white'
              }`}
              title={isFav ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
            </button>

            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Playing station from map:', station.name);
                onPlay(station);
              }}
              disabled={isLoading}
              className={`flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 ${
                isPlaying
                  ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white pulse-glow'
                  : 'bg-gradient-to-r from-gray-700 to-gray-600 hover:from-primary-500 hover:to-primary-600 text-gray-300 hover:text-white'
              } disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 ml-0.5" />
              )}
            </button>
          </div>
        </div>
        
        {/* Website Link */}
        {station.homepage && (
          <a
            href={station.homepage}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary-400 hover:text-primary-300 transition-colors inline-flex items-center"
            onClick={(e) => e.stopPropagation()}
          >
            🌐 Visit Website →
          </a>
        )}
      </div>
    </div>
  </div>
));



// Custom marker icon
const createCustomIcon = () => {
  if (typeof window !== 'undefined') {
    const L = require('leaflet');
    return L.divIcon({
      html: `<div class="w-6 h-6 bg-primary-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
               <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                 <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>
               </svg>
             </div>`,
      className: 'custom-radio-marker',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -12],
    });
  }
  return null;
};

// Component visibility hook
function useComponentVisibility() {
  const [isVisible, setIsVisible] = useState(true);
  const componentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Only consider visible if opacity > 0.5 to account for transitions
        const computedStyle = window.getComputedStyle(entry.target);
        const opacity = parseFloat(computedStyle.opacity);
        setIsVisible(entry.isIntersecting && opacity > 0.5);
      },
      { threshold: [0, 0.1] }
    );

    if (componentRef.current) {
      observer.observe(componentRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return { isVisible, componentRef };
}

export default function RadioMap() {
  const [mapBounds, setMapBounds] = useState<any>(null);
  const { playStation, state } = useAudioPlayer();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { isVisible, componentRef } = useComponentVisibility();
  
  // Use shared station data context
  const { stationsWithCoords: stations, loading, error, importStats, refresh } = useStationData();

  // Removed manual import functionality - now using automatic loading



  const handleStationPlay = useCallback(async (station: RadioStation) => {
    try {
      console.log('🗺️ Map: Attempting to play station:', station.name, station.url);
      await playStation(station);
      console.log('🗺️ Map: Play station called successfully');
    } catch (err) {
      console.error('🗺️ Map: Error playing station:', err);
    }
  }, [playStation]);

  const handleToggleFavorite = useCallback((station: RadioStation) => {
    toggleFavorite(station);
  }, [toggleFavorite]);

  // Memoize markers - NEVER re-render for audio state changes!
  // Only update when visibility changes to avoid expensive operations when hidden
  const markers = useMemo(() => {
    // Don't create markers if component is not visible
    if (!isVisible) return [];
    
    const icon = createCustomIcon();
    if (!icon) return [];

    return stations.map((station) => (
      <Marker
        key={station.stationuuid}
        position={[station.geo_lat, station.geo_long]}
        icon={icon}
      >
        <Popup maxWidth={300} closeButton={true}>
          <StationPopupWrapper
            station={station}
            onPlay={handleStationPlay}
            onToggleFavorite={handleToggleFavorite}
            isFav={isFavorite(station.stationuuid)}
          />
        </Popup>
      </Marker>
    ));
  }, [stations, isVisible]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-primary-500 mx-auto mb-4" />
          <p className="text-gray-300 text-lg mb-2">Loading radio stations...</p>
          {/* <p className="text-gray-400 text-sm mb-2">Auto-loading 33k+ geocoded stations</p> */}
          {/* <p className="text-gray-500 text-xs mb-1">🚀 Auto-positioned to prevent overlaps</p> */}
          {/* <p className="text-gray-500 text-xs">🗺️ Enhanced clustering for massive scale</p> */}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Radio className="w-8 h-8 text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Error Loading Map</h3>
          <p className="text-gray-300 mb-4">{error}</p>
          <button
            onClick={refresh}
            className="bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={componentRef} className={`h-screen relative ${state.currentStation ? 'pb-20' : ''}`}>
      {/* Map Stats */}
      <div className="absolute top-6 right-6 z-[1000] bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-soft border border-gray-700/50 px-4 py-3">
        <div className="flex items-center justify-between space-x-3 text-sm">
          <div className="flex items-center space-x-3">
            <MapPin className="w-4 h-4 text-primary-400" />
            <span className="font-medium text-gray-200">{stations.length} stations on map</span>
          </div>
          {importStats && (
            <span className="text-green-400 text-xs">
              📍 {importStats.coveragePercentage}% geocoded
            </span>
          )}
        </div>
      </div>



      {/* Map Container */}
      <MapContainer
        center={[20, 0]}
        zoom={2}
        style={{ height: '100%', width: '100%' }}
      >
        {/* Base Satellite Layer */}
        <TileLayer
          attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
        
        {/* Labels and Roads Overlay */}
        <TileLayer
          attribution='&copy; Esri'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
          opacity={0.8}
        />
        
        <MarkerClusterGroup
          chunkedLoading={isVisible} // Only enable chunked loading when visible
          chunkInterval={isVisible ? 100 : 1000} // Slower updates when not visible
          chunkDelay={isVisible ? 25 : 100}
          chunkProgress={(processed: number, total: number) => {
            // Only log progress when visible
            if (isVisible && (processed % 2000 === 0 || processed === total)) {
              console.log(`🗺️ Clustering progress: ${processed.toLocaleString()}/${total.toLocaleString()} stations (${Math.round(processed/total*100)}%)`);
            }
          }}
          maxClusterRadius={60}
          spiderfyOnMaxZoom={true}
          showCoverageOnHover={false}
          zoomToBoundsOnClick={true}
          spiderfyDistanceMultiplier={2.0}
          removeOutsideVisibleBounds={true}
          animate={isVisible} // Disable animations when not visible
          animateAddingMarkers={isVisible}
          disableClusteringAtZoom={16}
          iconCreateFunction={(cluster: any) => {
            const count = cluster.getChildCount();
            let size = 'small';
            let sizeClass = 'w-8 h-8 text-xs';
            
            if (count > 1000) {
              size = 'large';
              sizeClass = 'w-16 h-16 text-lg font-bold';
            } else if (count > 100) {
              size = 'medium';  
              sizeClass = 'w-12 h-12 text-sm font-semibold';
            }

                         return new window.L.DivIcon({
               html: `<div class="cluster-icon cluster-${size} ${sizeClass} bg-gradient-to-br from-primary-400 to-primary-600 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white">${count}</div>`,
               className: 'custom-cluster-icon',
               iconSize: window.L.point(40, 40, true),
             });
          }}
        >
          {markers}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
} 