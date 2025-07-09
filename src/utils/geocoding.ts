import { RadioStation } from '@/types/radio';

// MapBox Geocoding API
const MAPBOX_ACCESS_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
const MAPBOX_AVAILABLE = MAPBOX_ACCESS_TOKEN && MAPBOX_ACCESS_TOKEN !== '';
const MAPBOX_GEOCODING_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

interface GeocodingResult {
  latitude: number;
  longitude: number;
  placeName: string;
  bbox?: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  placeType: 'country' | 'city' | 'village' | 'region';
}

interface CachedLocation {
  result: GeocodingResult;
  timestamp: number;
}

// Enhanced cache for geocoding results with persistent localStorage backup
const geocodingCache = new Map<string, CachedLocation>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_KEY = 'radiomap_geocoding_cache';

// Load cache from localStorage on initialization
if (typeof window !== 'undefined') {
  try {
    const savedCache = localStorage.getItem(CACHE_KEY);
    if (savedCache) {
      const parsed = JSON.parse(savedCache);
      Object.entries(parsed).forEach(([key, value]: [string, any]) => {
        if (value.timestamp && Date.now() - value.timestamp < CACHE_DURATION) {
          geocodingCache.set(key, value);
        }
      });
      console.log(`🗂️ Loaded ${geocodingCache.size} cached geocoding results`);
    }
  } catch (error) {
    console.warn('Failed to load geocoding cache:', error);
  }
}

// Save cache to localStorage
function saveCache() {
  if (typeof window !== 'undefined') {
    try {
      const cacheObject = Object.fromEntries(geocodingCache);
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheObject));
    } catch (error) {
      console.warn('Failed to save geocoding cache:', error);
    }
  }
}

// Location keywords in multiple languages
const LOCATION_KEYWORDS = {
  city: ['city', 'град', 'город', 'ciudaad', 'ville', 'stadt', 'città', 'cidade'],
  village: ['village', 'село', 'деревня', 'поселение', 'поселок', 'aldea', 'pueblo', 'villaggio', 'dorf'],
  region: ['region', 'область', 'район', 'округ', 'edge', 'county', 'province', 'estado', 'região'],
  radio: ['radio', 'fm', 'am', 'радио', 'station', 'станция']
};

// Country name mapping for better geocoding
const COUNTRY_ALIASES: Record<string, string> = {
  'usa': 'united states',
  'uk': 'united kingdom',
  'uae': 'united arab emirates',
  'russia': 'russian federation',
  'россия': 'russian federation',
  'украина': 'ukraine',
  'беларусь': 'belarus',
  'казахстан': 'kazakhstan'
};

/**
 * Extract location information from station name
 */
export function extractLocationFromName(stationName: string, country?: string): {
  locations: string[];
  types: string[];
  priority: number;
} {
  const name = stationName.toLowerCase();
  const locations: string[] = [];
  const types: string[] = [];
  let priority = 0;

  // Remove common radio keywords to clean up the name
  let cleanName = name;
  LOCATION_KEYWORDS.radio.forEach(keyword => {
    cleanName = cleanName.replace(new RegExp(`\\b${keyword}\\b`, 'gi'), '');
  });

  // Look for parentheses or brackets with location info
  const parenthesesMatches = cleanName.match(/\(([^)]+)\)/g) || [];
  const bracketsMatches = cleanName.match(/\[([^\]]+)\]/g) || [];
  
  [...parenthesesMatches, ...bracketsMatches].forEach(match => {
    const location = match.replace(/[\(\)\[\]]/g, '').trim();
    if (location.length > 2) {
      locations.push(location);
      types.push('extracted');
      priority += 3;
    }
  });

  // Look for city indicators
  LOCATION_KEYWORDS.city.forEach(keyword => {
    const cityRegex = new RegExp(`(\\w+)\\s+${keyword}|${keyword}\\s+(\\w+)`, 'gi');
    const matches = cleanName.match(cityRegex);
    if (matches) {
      matches.forEach(match => {
        const cityName = match.replace(new RegExp(keyword, 'gi'), '').trim();
        if (cityName.length > 2) {
          locations.push(cityName);
          types.push('city');
          priority += 2;
        }
      });
    }
  });

  // Look for village indicators
  LOCATION_KEYWORDS.village.forEach(keyword => {
    const villageRegex = new RegExp(`(\\w+)\\s+${keyword}|${keyword}\\s+(\\w+)`, 'gi');
    const matches = cleanName.match(villageRegex);
    if (matches) {
      matches.forEach(match => {
        const villageName = match.replace(new RegExp(keyword, 'gi'), '').trim();
        if (villageName.length > 2) {
          locations.push(villageName);
          types.push('village');
          priority += 2;
        }
      });
    }
  });

  // Extract potential city names from the station name
  const words = cleanName.split(/[\s\-_,\.]+/).filter(word => 
    word.length > 2 && 
    !LOCATION_KEYWORDS.radio.includes(word) &&
    !/^\d+$/.test(word) // exclude numbers
  );

  words.forEach(word => {
    if (!locations.includes(word)) {
      locations.push(word);
      types.push('potential');
      priority += 1;
    }
  });

  // Add country as fallback
  if (country && !locations.includes(country.toLowerCase())) {
    locations.push(country.toLowerCase());
    types.push('country');
  }

  return { locations, types, priority };
}

/**
 * Geocode a location using MapBox API
 */
async function geocodeLocation(
  location: string, 
  country?: string, 
  type: string = 'place'
): Promise<GeocodingResult | null> {
  const cacheKey = `${location}_${country || 'global'}_${type}`;
  
  // Check cache first
  const cached = geocodingCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.result;
  }

  // If MapBox is not available, try to use default country coordinates
  if (!MAPBOX_AVAILABLE) {
    const countryKey = (country || location).toLowerCase();
    const countryData = DEFAULT_COUNTRY_COORDINATES[countryKey] || 
                      DEFAULT_COUNTRY_COORDINATES[COUNTRY_ALIASES[countryKey]];
    
    if (countryData) {
      const result: GeocodingResult = {
        latitude: countryData.lat,
        longitude: countryData.lng,
        placeName: `${location}, ${country || 'Unknown'}`,
        bbox: countryData.bbox,
        placeType: 'country'
      };
      
      // Cache the fallback result
      geocodingCache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });
      
      saveCache();
      return result;
    }
    
    console.warn('🗝️ MapBox token not configured and no fallback coordinates available');
    console.info('💡 To enable full geocoding, get a free MapBox token at: https://account.mapbox.com/access-tokens/');
    console.info('💡 Add it to your .env.local file as: NEXT_PUBLIC_MAPBOX_TOKEN=your_token_here');
    return null;
  }

  try {
    // Clean and prepare the query
    const cleanLocation = location.trim();
    const normalizedCountry = country ? (COUNTRY_ALIASES[country.toLowerCase()] || country) : '';
    
    let query = cleanLocation;
    if (normalizedCountry) {
      query += `, ${normalizedCountry}`;
    }

    // Determine place types for MapBox
    let placeTypes = 'country,region,place,locality,neighborhood';
    if (type === 'city') {
      placeTypes = 'place,locality';
    } else if (type === 'village') {
      placeTypes = 'locality,neighborhood,place';
    } else if (type === 'country') {
      placeTypes = 'country';
    }

    const url = `${MAPBOX_GEOCODING_URL}/${encodeURIComponent(query)}.json?` +
      `access_token=${MAPBOX_ACCESS_TOKEN}&` +
      `types=${placeTypes}&` +
      `limit=1`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`MapBox API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      const [lng, lat] = feature.center;
      
      const result: GeocodingResult = {
        latitude: lat,
        longitude: lng,
        placeName: feature.place_name,
        bbox: feature.bbox,
        placeType: feature.place_type?.[0] === 'country' ? 'country' : 
                   feature.place_type?.includes('locality') ? 'village' :
                   feature.place_type?.includes('place') ? 'city' : 'region'
      };

      // Cache the result
      geocodingCache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });

      // Save to localStorage periodically
      if (geocodingCache.size % 10 === 0) {
        saveCache();
      }

      return result;
    }
  } catch (error) {
    console.warn(`Geocoding failed for "${location}":`, error);
  }

  return null;
}

/**
 * Generate random coordinates within a bounding box, avoiding existing markers
 */
function generateRandomCoordinatesInBounds(
  bbox: [number, number, number, number], // [minLng, minLat, maxLng, maxLat]
  existingCoordinates: Array<{ lat: number; lng: number }>,
  minDistance: number = 0.01 // Minimum distance from existing markers
): { lat: number; lng: number } {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  
  let attempts = 0;
  const maxAttempts = 50;
  
  while (attempts < maxAttempts) {
    const lat = minLat + Math.random() * (maxLat - minLat);
    const lng = minLng + Math.random() * (maxLng - minLng);
    
    // Check distance from existing coordinates
    const tooClose = existingCoordinates.some(coord => {
      const distance = Math.sqrt(
        Math.pow(lat - coord.lat, 2) + Math.pow(lng - coord.lng, 2)
      );
      return distance < minDistance;
    });
    
    if (!tooClose) {
      return { lat, lng };
    }
    
    attempts++;
  }
  
  // If we can't find a good spot, just use random coordinates in the bbox
  return {
    lat: minLat + Math.random() * (maxLat - minLat),
    lng: minLng + Math.random() * (maxLng - minLng)
  };
}

/**
 * Generate default country coordinates for common countries
 */
const DEFAULT_COUNTRY_COORDINATES: Record<string, { lat: number; lng: number; bbox: [number, number, number, number] }> = {
  'united states': { lat: 39.8283, lng: -98.5795, bbox: [-171.7911, 18.9110, -66.9850, 71.3525] },
  'usa': { lat: 39.8283, lng: -98.5795, bbox: [-171.7911, 18.9110, -66.9850, 71.3525] },
  'russia': { lat: 61.5240, lng: 105.3188, bbox: [19.6389, 41.1850, 180.0000, 81.8570] },
  'russian federation': { lat: 61.5240, lng: 105.3188, bbox: [19.6389, 41.1850, 180.0000, 81.8570] },
  'china': { lat: 35.8617, lng: 104.1954, bbox: [73.4994, 18.1978, 134.7736, 53.5609] },
  'germany': { lat: 51.1657, lng: 10.4515, bbox: [5.8663, 47.2701, 15.0418, 55.0815] },
  'france': { lat: 46.2276, lng: 2.2137, bbox: [-5.1424, 41.3253, 9.5596, 51.1242] },
  'united kingdom': { lat: 55.3781, lng: -3.4360, bbox: [-8.6490, 49.9599, 1.7632, 60.8610] },
  'uk': { lat: 55.3781, lng: -3.4360, bbox: [-8.6490, 49.9599, 1.7632, 60.8610] },
  'brazil': { lat: -14.2350, lng: -51.9253, bbox: [-74.0003, -33.7683, -28.8477, 5.2717] },
  'canada': { lat: 56.1304, lng: -106.3468, bbox: [-141.0021, 41.6765, -52.6480, 83.1161] },
  'australia': { lat: -25.2744, lng: 133.7751, bbox: [113.3340, -43.6345, 153.5690, -10.6681] },
  'india': { lat: 20.5937, lng: 78.9629, bbox: [68.1766, 8.0884, 97.4031, 37.6176] },
  'japan': { lat: 36.2048, lng: 138.2529, bbox: [129.4080, 31.0295, 145.8205, 45.5514] },
  'italy': { lat: 41.8719, lng: 12.5674, bbox: [6.7499, 36.6199, 18.4802, 47.1154] },
  'spain': { lat: 40.4637, lng: -3.7492, bbox: [-9.3015, 35.9999, 3.3190, 43.7874] },
  'mexico': { lat: 23.6345, lng: -102.5528, bbox: [-117.1279, 14.3895, -86.8104, 32.7187] },
  'argentina': { lat: -38.4161, lng: -63.6167, bbox: [-73.5600, -55.0500, -53.6374, -21.7811] },
  'poland': { lat: 51.9194, lng: 19.1451, bbox: [14.1229, 49.0020, 24.1458, 54.8515] },
  'ukraine': { lat: 48.3794, lng: 31.1656, bbox: [22.1371, 44.3614, 40.2275, 52.3797] },
  'turkey': { lat: 38.9637, lng: 35.2433, bbox: [25.6684, 35.8154, 44.7939, 42.1065] },
  'netherlands': { lat: 52.1326, lng: 5.2913, bbox: [3.3316, 50.8036, 7.0918, 53.5104] },
  'belgium': { lat: 50.5039, lng: 4.4699, bbox: [2.5667, 49.4969, 6.4057, 51.5051] },
  'sweden': { lat: 60.1282, lng: 18.6435, bbox: [11.1187, 55.3617, 24.1662, 69.0599] },
  'norway': { lat: 60.4720, lng: 8.4689, bbox: [4.9960, 58.0788, 31.2933, 80.6571] },
  'finland': { lat: 61.9241, lng: 25.7482, bbox: [20.6455, 59.8088, 31.5869, 70.0922] },
  'denmark': { lat: 56.2639, lng: 9.5018, bbox: [8.0756, 54.5584, 15.1588, 57.7515] },
  'switzerland': { lat: 46.8182, lng: 8.2275, bbox: [5.9559, 45.8180, 10.4921, 47.8084] },
  'austria': { lat: 47.5162, lng: 14.5501, bbox: [9.5308, 46.3722, 17.1608, 49.0205] }
};

/**
 * Assign coordinates to stations without geo data
 */
export async function assignCoordinatesToStations(
  stations: RadioStation[],
  onProgress?: (processed: number, total: number, currentLocation: string) => void
): Promise<RadioStation[]> {
  const stationsWithCoords = stations.filter(s => s.geo_lat && s.geo_long);
  const stationsWithoutCoords = stations.filter(s => !s.geo_lat || !s.geo_long);
  
  console.log(`🌍 Processing ${stationsWithoutCoords.length} stations without coordinates...`);
  
  if (!MAPBOX_AVAILABLE) {
    console.log('🏃‍♂️ MapBox not configured - using fallback country coordinates only');
  } else {
    console.log('🌐 MapBox available - using full geocoding with cities and villages');
  }
  
  if (stationsWithoutCoords.length === 0) {
    return stations;
  }

  // Rate limiting: track API calls per minute
  let apiCallsThisMinute = 0;
  let lastMinuteReset = Date.now();
  const MAX_API_CALLS_PER_MINUTE = 500; // Conservative limit

  // Track existing coordinates to avoid overlap
  const existingCoordinates = stationsWithCoords.map(s => ({
    lat: parseFloat(s.geo_lat.toString()),
    lng: parseFloat(s.geo_long.toString())
  }));

  const enhancedStations: RadioStation[] = [...stationsWithCoords];
  let processedCount = 0;

  // Process stations in batches to avoid API rate limits
  const batchSize = 10;
  for (let i = 0; i < stationsWithoutCoords.length; i += batchSize) {
    const batch = stationsWithoutCoords.slice(i, i + batchSize);
    
    for (const station of batch) {
      try {
        const locationInfo = extractLocationFromName(station.name, station.country);
        let assigned = false;

        // Report progress
        onProgress?.(processedCount, stationsWithoutCoords.length, 
          locationInfo.locations[0] || station.country || 'Unknown');

        // Try each extracted location in order of priority
        for (let j = 0; j < locationInfo.locations.length && !assigned; j++) {
          const location = locationInfo.locations[j];
          const type = locationInfo.types[j];
          
          // Rate limiting check
          if (MAPBOX_AVAILABLE) {
            const now = Date.now();
            if (now - lastMinuteReset > 60000) {
              apiCallsThisMinute = 0;
              lastMinuteReset = now;
            }
            
            if (apiCallsThisMinute >= MAX_API_CALLS_PER_MINUTE) {
              console.log('🚦 Rate limit reached, waiting 60 seconds...');
              await new Promise(resolve => setTimeout(resolve, 60000));
              apiCallsThisMinute = 0;
              lastMinuteReset = Date.now();
            }
            
            apiCallsThisMinute++;
          }
          
          const geocodeResult = await geocodeLocation(location, station.country, type);
          
          if (geocodeResult) {
            let coordinates: { lat: number; lng: number };
            
            if (geocodeResult.bbox) {
              // Generate random coordinates within the bounding box
              coordinates = generateRandomCoordinatesInBounds(
                geocodeResult.bbox,
                existingCoordinates,
                geocodeResult.placeType === 'country' ? 0.1 : 0.01
              );
            } else {
              // Use the exact coordinates with small random offset
              coordinates = {
                lat: geocodeResult.latitude + (Math.random() - 0.5) * 0.01,
                lng: geocodeResult.longitude + (Math.random() - 0.5) * 0.01
              };
            }
            
            const enhancedStation: RadioStation = {
              ...station,
              geo_lat: coordinates.lat,
              geo_long: coordinates.lng,
              // Add metadata about the geocoding
              geocoded_location: geocodeResult.placeName,
              geocoded_type: geocodeResult.placeType
            };
            
            enhancedStations.push(enhancedStation);
            existingCoordinates.push(coordinates);
            assigned = true;
            processedCount++;
            
            if (processedCount % 100 === 0) {
              console.log(`🌍 Geocoded ${processedCount}/${stationsWithoutCoords.length} stations`);
            }
          }
        }

        // Fallback to country coordinates if nothing else worked
        if (!assigned && station.country) {
          const countryKey = station.country.toLowerCase();
          const countryData = DEFAULT_COUNTRY_COORDINATES[countryKey] || 
                            DEFAULT_COUNTRY_COORDINATES[COUNTRY_ALIASES[countryKey]];
          
          if (countryData) {
            const coordinates = generateRandomCoordinatesInBounds(
              countryData.bbox,
              existingCoordinates,
              0.1
            );
            
            const enhancedStation: RadioStation = {
              ...station,
              geo_lat: coordinates.lat,
              geo_long: coordinates.lng,
              geocoded_location: `${station.country} (approximate)`,
              geocoded_type: 'country' as const
            };
            
            enhancedStations.push(enhancedStation);
            existingCoordinates.push(coordinates);
            processedCount++;
          }
        }
        
        // Small delay to respect API rate limits (100ms to be safe)
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.warn(`Failed to geocode station ${station.name}:`, error);
        processedCount++;
        // Station remains without coordinates
      }
    }
  }

  console.log(`🌍 Successfully geocoded ${processedCount} stations`);
  
  // Save all cache results to localStorage at the end
  saveCache();
  
  return enhancedStations;
} 