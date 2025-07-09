'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { RadioStation, CountryStats, GenreStats } from '@/types/radio';
import { RadioAPI } from '@/utils/radioApi';
import { autoLoadGeocodedStations, processGeocodedStationsWithPositioning, saveProcessedGeocodedToCache, loadProcessedGeocodedFromCache } from '@/utils/auto-geocoded-loader';

interface StationDataContextType {
  // Station data
  allStations: RadioStation[];
  stationsWithCoords: RadioStation[];
  
  // Metadata
  countries: CountryStats[];
  genres: GenreStats[];
  
  // Loading states
  loading: boolean;
  error: string | null;
  
  // Stats
  importStats: {
    totalStations: number;
    stationsWithoutGeo: number;
    stationsGeocoded: number;
    coveragePercentage: number;
  } | null;
  
  // Actions
  refresh: () => Promise<void>;
}

const StationDataContext = createContext<StationDataContextType | undefined>(undefined);

export function StationDataProvider({ children }: { children: ReactNode }) {
  const [allStations, setAllStations] = useState<RadioStation[]>([]);
  const [stationsWithCoords, setStationsWithCoords] = useState<RadioStation[]>([]);
  const [countries, setCountries] = useState<CountryStats[]>([]);
  const [genres, setGenres] = useState<GenreStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importStats, setImportStats] = useState<{
    totalStations: number;
    stationsWithoutGeo: number;
    stationsGeocoded: number;
    coveragePercentage: number;
  } | null>(null);

  const loadStationData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🚀 StationDataContext: Loading ALL radio stations...');
      const rawData = await RadioAPI.getStations({}, 100000);
      console.log(`📊 StationDataContext: Loaded ${rawData.length} raw stations`);
      
      // Try to load processed geocoded data from cache first
      let cachedGeocodedData = loadProcessedGeocodedFromCache();
      
      // If no cache, try to auto-load the geocoded_stations.json file
      if (!cachedGeocodedData) {
        console.log('🔄 StationDataContext: Auto-loading geocoded stations from file...');
        const autoLoadedData = await autoLoadGeocodedStations();
        
        if (autoLoadedData.length > 0) {
          console.log(`📁 StationDataContext: Auto-loaded ${autoLoadedData.length} geocoded stations`);
          
          // Cache the auto-loaded data for future use
          saveProcessedGeocodedToCache(autoLoadedData);
          cachedGeocodedData = autoLoadedData;
        }
      }
      
      let finalStations = rawData;
      
      if (cachedGeocodedData && cachedGeocodedData.length > 0) {
        console.log(`🎯 StationDataContext: Processing ${cachedGeocodedData.length} geocoded stations with positioning...`);
        finalStations = processGeocodedStationsWithPositioning(rawData, cachedGeocodedData);
        
        // Calculate stats
        const geocodedCount = cachedGeocodedData.length;
        const totalWithoutGeo = rawData.filter(s => !s.geo_lat || !s.geo_long).length;
        
        setImportStats({
          totalStations: rawData.length,
          stationsWithoutGeo: totalWithoutGeo,
          stationsGeocoded: geocodedCount,
          coveragePercentage: Math.round((geocodedCount / totalWithoutGeo) * 100)
        });
        
        console.log(`✅ StationDataContext: Processed ${geocodedCount} geocoded stations`);
      }
      
      // Set all stations (for list view)
      setAllStations(finalStations);
      
      // Filter stations with valid coordinates (for map view)
      const validStations = finalStations.filter(station => {
        const lat = typeof station.geo_lat === 'number' ? station.geo_lat : parseFloat(station.geo_lat);
        const lng = typeof station.geo_long === 'number' ? station.geo_long : parseFloat(station.geo_long);
        
        return lat && lng && 
               !isNaN(lat) && !isNaN(lng) &&
               Math.abs(lat) <= 90 && Math.abs(lng) <= 180 &&
               !(lat === 0 && lng === 0);
      });
      
      setStationsWithCoords(validStations);
      
      console.log(`🗺️ StationDataContext: ${finalStations.length} total stations, ${validStations.length} with coordinates`);
      
      // Generate countries from station data
      const countryMap = new Map<string, number>();
      finalStations.forEach(station => {
        if (station.country) {
          countryMap.set(station.country, (countryMap.get(station.country) || 0) + 1);
        }
      });
      
      const countryStats = Array.from(countryMap.entries())
        .map(([name, count]) => ({ name, stationcount: count, iso_3166_1: name.toLowerCase().replace(/\s+/g, '-') }))
        .sort((a, b) => b.stationcount - a.stationcount)
        .slice(0, 50);
      
      setCountries(countryStats);
      
      // Generate genres from station tags
      const genreMap = new Map<string, number>();
      finalStations.forEach(station => {
        if (station.tags) {
          const tags = station.tags.split(',').map(tag => tag.trim()).filter(Boolean);
          tags.forEach(tag => {
            if (tag.length > 2) { // Only include meaningful tags
              genreMap.set(tag, (genreMap.get(tag) || 0) + 1);
            }
          });
        }
      });
      
      const genreStats = Array.from(genreMap.entries())
        .map(([name, count]) => ({ name, stationcount: count }))
        .sort((a, b) => b.stationcount - a.stationcount)
        .slice(0, 30);
      
      setGenres(genreStats);
      
    } catch (err) {
      console.error('❌ StationDataContext: Error loading stations:', err);
      setError('Failed to load radio stations');
    } finally {
      setLoading(false);
    }
  };

  // Load data on mount
  useEffect(() => {
    loadStationData();
  }, []);

  const contextValue: StationDataContextType = {
    allStations,
    stationsWithCoords,
    countries,
    genres,
    loading,
    error,
    importStats,
    refresh: loadStationData
  };

  return (
    <StationDataContext.Provider value={contextValue}>
      {children}
    </StationDataContext.Provider>
  );
}

export function useStationData() {
  const context = useContext(StationDataContext);
  if (context === undefined) {
    throw new Error('useStationData must be used within a StationDataProvider');
  }
  return context;
} 