import axios from 'axios';
import { RadioStation, CountryStats, GenreStats, SearchFilters } from '@/types/radio';

const BASE_URL = 'https://de1.api.radio-browser.info/json';

// Create axios instance with default config
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000, // Increased timeout for large requests
  headers: {
    'User-Agent': 'RadioMap/1.0',
  },
});

export class RadioAPI {
  // Get all stations with optional filters
  static async getStations(filters: SearchFilters = {}, limit = 50000, offset = 0): Promise<RadioStation[]> {
    try {
      // If no filters and no offset, get from comprehensive method
      if (Object.keys(filters).length === 0 && offset === 0) {
        return await this.getAllStationsMultiSource(limit);
      }
      
      // If offset is specified, use the search endpoint with pagination
      if (offset > 0) {
        const response = await api.get('/stations/search', {
          params: {
            limit,
            offset,
            hidebroken: 'true',
            order: 'votes',
            reverse: 'true'
          }
        });
        return response.data || [];
      }

      const params: any = {
        limit,
        offset,
        order: 'clickcount',
        reverse: 'true',
        hidebroken: 'true',
      };

      if (filters.country) params.country = filters.country;
      if (filters.genre) params.tag = filters.genre;
      if (filters.language) params.language = filters.language;
      if (filters.searchTerm) params.name = filters.searchTerm;
      if (filters.minVotes) params.minvotes = filters.minVotes;

      const response = await api.get('/stations/search', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching stations:', error);
      throw new Error('Failed to fetch radio stations');
    }
  }



  // Get ALL stations using the simple /stations endpoint (53,000+ available!)
  static async getAllStationsMultiSource(targetCount = 100000): Promise<RadioStation[]> {
    try {
      console.log('🚀 Loading ALL radio stations (targeting 50k+)...');
      
      // Use the direct /stations endpoint with a very high limit to get everything
      const response = await api.get('/stations', {
        params: {
          limit: targetCount, // Set high limit to get all available stations
          hidebroken: 'true', // Only working stations
          order: 'votes',     // Best quality first
          reverse: 'true'     // Highest votes first
        },
        timeout: 60000 // Extra long timeout for large response
      });
      
      console.log(`🎉 SUCCESS: Loaded ${response.data.length} radio stations!`);
      
      // Return the stations (already sorted by votes)
      return response.data || [];
    } catch (error) {
      console.error('Primary endpoint failed, trying fallback...', error);
      
      // Fallback: try with lower limit
      try {
        const response = await api.get('/stations', {
          params: {
            limit: 50000,
            hidebroken: 'true'
          }
        });
        console.log(`Fallback: Loaded ${response.data.length} stations`);
        return response.data || [];
      } catch (fallbackError) {
        console.error('All endpoints failed:', fallbackError);
        throw new Error('Failed to fetch radio stations from all endpoints');
      }
    }
  }

  // Get stations by country
  static async getStationsByCountry(country: string, limit = 1000): Promise<RadioStation[]> {
    try {
      const response = await api.get('/stations/bycountry', {
        params: {
          country,
          limit,
          order: 'clickcount',
          reverse: 'true',
          hidebroken: 'true',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching stations by country:', error);
      throw new Error('Failed to fetch radio stations');
    }
  }

  // Get stations by genre/tag
  static async getStationsByGenre(genre: string, limit = 1000): Promise<RadioStation[]> {
    try {
      const response = await api.get('/stations/bytag', {
        params: {
          tag: genre,
          limit,
          order: 'clickcount',
          reverse: 'true',
          hidebroken: 'true',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching stations by genre:', error);
      throw new Error('Failed to fetch radio stations');
    }
  }

  // Get top voted stations
  static async getTopStations(limit = 1000): Promise<RadioStation[]> {
    try {
      const response = await api.get('/stations/topvote', {
        params: { limit },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching top stations:', error);
      throw new Error('Failed to fetch top stations');
    }
  }

  // Search stations by name
  static async searchStations(query: string, limit = 1000): Promise<RadioStation[]> {
    try {
      const response = await api.get('/stations/search', {
        params: {
          name: query,
          limit,
          order: 'clickcount',
          reverse: 'true',
          hidebroken: 'true',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error searching stations:', error);
      throw new Error('Failed to search stations');
    }
  }

  // Get countries with station counts
  static async getCountries(): Promise<CountryStats[]> {
    try {
      const response = await api.get('/countries');
      return response.data;
    } catch (error) {
      console.error('Error fetching countries:', error);
      throw new Error('Failed to fetch countries');
    }
  }

  // Get genres/tags with station counts
  static async getGenres(): Promise<GenreStats[]> {
    try {
      const response = await api.get('/tags');
      return response.data.filter((tag: GenreStats) => tag.stationcount > 10); // Filter out rare tags
    } catch (error) {
      console.error('Error fetching genres:', error);
      throw new Error('Failed to fetch genres');
    }
  }

  // Get station by UUID
  static async getStationById(uuid: string): Promise<RadioStation | null> {
    try {
      const response = await api.get(`/stations/byuuid/${uuid}`);
      return response.data[0] || null;
    } catch (error) {
      console.error('Error fetching station by ID:', error);
      return null;
    }
  }

  // Click on station to update play count
  static async clickStation(uuid: string): Promise<void> {
    try {
      await api.get(`/url/${uuid}`);
    } catch (error) {
      console.error('Error clicking station:', error);
    }
  }

  // Get stations by geographical bounds (for map view)
  static async getStationsByBounds(
    north: number,
    south: number,
    east: number,
    west: number,
    limit = 1000
  ): Promise<RadioStation[]> {
    try {
      // Get a large set of stations for better geographic coverage
      const allStations = await this.getStations({}, 5000);
      
      // Filter stations by geographical bounds
      const filteredStations = allStations.filter(station => {
        const lat = station.geo_lat;
        const lng = station.geo_long;
        
        // Only include stations with valid coordinates within bounds
        return lat && lng && 
               lat >= south && lat <= north &&
               lng >= west && lng <= east;
      });

      // Return up to the limit, sorted by votes for quality
      return filteredStations
        .sort((a, b) => b.votes - a.votes)
        .slice(0, limit);
    } catch (error) {
      console.error('Error fetching stations by bounds:', error);
      throw new Error('Failed to fetch stations by bounds');
    }
  }
} 