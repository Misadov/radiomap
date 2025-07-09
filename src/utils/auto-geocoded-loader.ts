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
 * Automatically load geocoded stations from the public directory
 */
export async function autoLoadGeocodedStations(): Promise<GeocodedStationData[]> {
  try {
    console.log('🚀 Auto-loading geocoded stations...');
    
    // Try to load from the project root (where the file was generated)
    const response = await fetch('/geocoded_stations.json');
    
    if (!response.ok) {
      console.log('📁 No geocoded_stations.json found in public directory');
      return [];
    }
    
    const data = await response.json();
    
    if (!Array.isArray(data)) {
      console.error('❌ Invalid geocoded data format');
      return [];
    }
    
    // Validate and filter valid stations
    const validStations = data.filter(station => 
      station.uuid && 
      station.latitude && 
      station.longitude &&
      !isNaN(station.latitude) &&
      !isNaN(station.longitude) &&
      Math.abs(station.latitude) <= 90 &&
      Math.abs(station.longitude) <= 180
    );
    
    console.log(`✅ Auto-loaded ${validStations.length} geocoded stations`);
    return validStations;
    
  } catch (error) {
    console.error('❌ Failed to auto-load geocoded stations:', error);
    return [];
  }
}

/**
 * Generate random coordinates within a region to prevent overlaps
 */
export function generateRandomPositionInRegion(
  baseLatitude: number, 
  baseLongitude: number, 
  locationType: string,
  existingPositions: {lat: number, lng: number}[] = []
): {lat: number, lng: number} {
  
  // Define spread radius based on location type (in degrees)
  const spreadRadius = {
    'country': 2.0,     // Large spread for country-level
    'region': 1.0,      // Medium spread for regions/states
    'place': 0.5,       // Smaller spread for cities
    'city': 0.3,        // Small spread for cities
    'village': 0.1,     // Tiny spread for villages
    'neighborhood': 0.05 // Minimal spread for neighborhoods
  };
  
  const radius = spreadRadius[locationType as keyof typeof spreadRadius] || 0.5;
  const minDistance = 0.01; // Minimum distance between markers (about 1km)
  
  let attempts = 0;
  const maxAttempts = 100;
  
  while (attempts < maxAttempts) {
    // Generate random offset within circular area
    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.sqrt(Math.random()) * radius; // Square root for uniform distribution
    
    const lat = baseLatitude + (distance * Math.cos(angle));
    const lng = baseLongitude + (distance * Math.sin(angle));
    
    // Check if this position is too close to existing ones
    const tooClose = existingPositions.some(pos => {
      const latDiff = pos.lat - lat;
      const lngDiff = pos.lng - lng;
      const distanceSquared = latDiff * latDiff + lngDiff * lngDiff;
      return distanceSquared < (minDistance * minDistance);
    });
    
    if (!tooClose) {
      return { lat, lng };
    }
    
    attempts++;
  }
  
  // If we can't find a non-overlapping position, just use a small random offset
  return {
    lat: baseLatitude + (Math.random() - 0.5) * 0.02,
    lng: baseLongitude + (Math.random() - 0.5) * 0.02
  };
}

/**
 * Process geocoded stations with random positioning to prevent overlaps
 */
export function processGeocodedStationsWithPositioning(
  originalStations: RadioStation[],
  geocodedData: GeocodedStationData[]
): RadioStation[] {
  console.log(`🎯 Processing ${geocodedData.length} geocoded stations with anti-overlap positioning...`);
  
  // Create lookup map for geocoded data
  const geocodedMap = new Map<string, GeocodedStationData>();
  geocodedData.forEach(station => {
    geocodedMap.set(station.uuid, station);
  });
  
  // Group geocoded stations by location to handle overlaps
  const locationGroups = new Map<string, {stations: GeocodedStationData[], positions: {lat: number, lng: number}[]}>();
  
  geocodedData.forEach(station => {
    const locationKey = `${station.latitude.toFixed(3)}_${station.longitude.toFixed(3)}_${station.location_type}`;
    
    if (!locationGroups.has(locationKey)) {
      locationGroups.set(locationKey, { stations: [], positions: [] });
    }
    
    locationGroups.get(locationKey)!.stations.push(station);
  });
  
  // Generate positions for each location group
  locationGroups.forEach((group, locationKey) => {
    const baseStation = group.stations[0];
    
    group.stations.forEach((station, index) => {
      if (index === 0) {
        // First station keeps original position (with tiny random offset)
        const position = {
          lat: station.latitude + (Math.random() - 0.5) * 0.001,
          lng: station.longitude + (Math.random() - 0.5) * 0.001
        };
        group.positions.push(position);
      } else {
        // Subsequent stations get spread around the area
        const position = generateRandomPositionInRegion(
          baseStation.latitude,
          baseStation.longitude,
          baseStation.location_type,
          group.positions
        );
        group.positions.push(position);
      }
    });
  });
  
  // Create position lookup for each station
  const stationPositions = new Map<string, {lat: number, lng: number}>();
  locationGroups.forEach(group => {
    group.stations.forEach((station, index) => {
      stationPositions.set(station.uuid, group.positions[index]);
    });
  });
  
  let mergedCount = 0;
  
  // Merge with original stations
  const mergedStations = originalStations.map(station => {
    const geocoded = geocodedMap.get(station.stationuuid);
    
    if (geocoded) {
      const position = stationPositions.get(geocoded.uuid);
      mergedCount++;
      
      return {
        ...station,
        geo_lat: position?.lat || geocoded.latitude,
        geo_long: position?.lng || geocoded.longitude,
        geocoded_location: geocoded.place_name,
        geocoded_type: mapConfidenceToType(geocoded.confidence, geocoded.location_type)
      };
    }
    
    return station;
  });
  
  console.log(`✅ Successfully positioned ${mergedCount} stations with anti-overlap system`);
  console.log(`📍 Processed ${locationGroups.size} unique locations`);
  
  return mergedStations;
}

/**
 * Map confidence levels to geocoded types
 */
function mapConfidenceToType(confidence: string, locationType: string): 'country' | 'city' | 'village' | 'region' {
  if (locationType === 'country') return 'country';
  if (locationType === 'village' || locationType === 'neighborhood') return 'village';
  
  switch (confidence) {
    case 'high':
      return 'city';
    case 'medium':
      return 'region';
    case 'low':
    default:
      return 'country';
  }
}

/**
 * Save processed geocoded data to cache
 */
export function saveProcessedGeocodedToCache(geocodedData: GeocodedStationData[]): void {
  try {
    const cacheData = {
      stations: geocodedData,
      timestamp: Date.now(),
      version: '2.0', // Updated version for new positioning system
      processed: true
    };
    
    localStorage.setItem('radiomap_geocoded_cache_v2', JSON.stringify(cacheData));
    console.log(`💾 Cached ${geocodedData.length} processed geocoded stations`);
    
  } catch (error) {
    console.warn('Failed to cache processed geocoded data:', error);
  }
}

/**
 * Load processed geocoded data from cache
 */
export function loadProcessedGeocodedFromCache(): GeocodedStationData[] | null {
  try {
    const cached = localStorage.getItem('radiomap_geocoded_cache_v2');
    if (!cached) return null;
    
    const cacheData = JSON.parse(cached);
    
    // Check if cache is less than 1 day old (since we auto-load, we can refresh more frequently)
    const CACHE_DURATION = 24 * 60 * 60 * 1000; // 1 day
    if (Date.now() - cacheData.timestamp > CACHE_DURATION) {
      localStorage.removeItem('radiomap_geocoded_cache_v2');
      return null;
    }
    
    if (cacheData.processed && cacheData.version === '2.0') {
      console.log(`📦 Loaded ${cacheData.stations.length} processed geocoded stations from cache`);
      return cacheData.stations;
    }
    
    return null;
    
  } catch (error) {
    console.warn('Failed to load processed geocoded cache:', error);
    return null;
  }
} 