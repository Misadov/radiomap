import { RadioStation } from '@/types/radio';

export interface GeocodedStationData {
  uuid: string;
  name: string;
  country: string;
  state: string;
  extracted_location: string;
  location_type: string;
  priority: number;
  latitude: number;
  longitude: number;
  place_name: string;
  mapbox_place_type: string;
  confidence: string;
  method: string;
  timestamp: number;
}

/**
 * Import geocoded stations from Python script results
 */
export async function importGeocodedStations(file: File): Promise<GeocodedStationData[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text);
        
        if (!Array.isArray(data)) {
          throw new Error('Invalid file format: expected JSON array');
        }
        
        // Validate data structure
        const validStations = data.filter(station => 
          station.uuid && 
          station.latitude && 
          station.longitude &&
          !isNaN(station.latitude) &&
          !isNaN(station.longitude)
        );
        
        console.log(`📁 Imported ${validStations.length} geocoded stations from file`);
        resolve(validStations);
        
      } catch (error) {
        reject(new Error(`Failed to parse geocoded stations file: ${error}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsText(file);
  });
}

/**
 * Merge geocoded data with existing stations
 */
export function mergeGeocodedStations(
  originalStations: RadioStation[], 
  geocodedData: GeocodedStationData[]
): RadioStation[] {
  console.log(`🔄 Merging ${geocodedData.length} geocoded stations with ${originalStations.length} original stations`);
  
  // Create a map of geocoded data by UUID
  const geocodedMap = new Map<string, GeocodedStationData>();
  geocodedData.forEach(station => {
    geocodedMap.set(station.uuid, station);
  });
  
  let mergedCount = 0;
  
  // Update original stations with geocoded coordinates
  const mergedStations = originalStations.map(station => {
    const geocoded = geocodedMap.get(station.stationuuid);
    
    if (geocoded) {
      mergedCount++;
      return {
        ...station,
        geo_lat: geocoded.latitude,
        geo_long: geocoded.longitude,
        geocoded_location: geocoded.place_name,
        geocoded_type: geocoded.confidence === 'high' ? 'city' as const : 
                      geocoded.confidence === 'medium' ? 'region' as const : 'country' as const
      };
    }
    
    return station;
  });
  
  console.log(`✅ Successfully merged coordinates for ${mergedCount} stations`);
  
  return mergedStations;
}

/**
 * Save geocoded data to localStorage for future use
 */
export function saveGeocodedToCache(geocodedData: GeocodedStationData[]): void {
  try {
    const cacheData = {
      stations: geocodedData,
      timestamp: Date.now(),
      version: '1.0'
    };
    
    localStorage.setItem('radiomap_geocoded_cache', JSON.stringify(cacheData));
    console.log(`💾 Saved ${geocodedData.length} geocoded stations to cache`);
    
  } catch (error) {
    console.warn('Failed to save geocoded data to cache:', error);
  }
}

/**
 * Load geocoded data from localStorage cache
 */
export function loadGeocodedFromCache(): GeocodedStationData[] | null {
  try {
    const cached = localStorage.getItem('radiomap_geocoded_cache');
    if (!cached) return null;
    
    const cacheData = JSON.parse(cached);
    
    // Check if cache is less than 7 days old
    const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
    if (Date.now() - cacheData.timestamp > CACHE_DURATION) {
      localStorage.removeItem('radiomap_geocoded_cache');
      return null;
    }
    
    console.log(`📦 Loaded ${cacheData.stations.length} geocoded stations from cache`);
    return cacheData.stations;
    
  } catch (error) {
    console.warn('Failed to load geocoded cache:', error);
    return null;
  }
}

/**
 * Filter stations that need geocoding (no valid coordinates)
 */
export function getStationsNeedingGeocode(stations: RadioStation[]): RadioStation[] {
  return stations.filter(station => {
    const lat = typeof station.geo_lat === 'number' ? station.geo_lat : parseFloat(station.geo_lat);
    const lng = typeof station.geo_long === 'number' ? station.geo_long : parseFloat(station.geo_long);
    
    return !lat || !lng || 
           isNaN(lat) || isNaN(lng) ||
           Math.abs(lat) > 90 || Math.abs(lng) > 180 ||
           (lat === 0 && lng === 0);
  });
}

/**
 * Get statistics about geocoding coverage
 */
export function getGeocodingStats(
  originalStations: RadioStation[], 
  geocodedData: GeocodedStationData[]
) {
  const stationsNeedingGeocode = getStationsNeedingGeocode(originalStations);
  const highConfidence = geocodedData.filter(s => s.confidence === 'high').length;
  const mediumConfidence = geocodedData.filter(s => s.confidence === 'medium').length;
  const lowConfidence = geocodedData.filter(s => s.confidence === 'low').length;
  
  return {
    totalStations: originalStations.length,
    stationsWithoutGeo: stationsNeedingGeocode.length,
    stationsGeocoded: geocodedData.length,
    coveragePercentage: Math.round((geocodedData.length / stationsNeedingGeocode.length) * 100),
    confidenceBreakdown: {
      high: highConfidence,
      medium: mediumConfidence,
      low: lowConfidence
    }
  };
} 