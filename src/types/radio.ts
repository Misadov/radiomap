export interface RadioStation {
  stationuuid: string;
  name: string;
  url: string;
  url_resolved: string;
  homepage: string;
  favicon: string;
  tags: string;
  country: string;
  countrycode: string;
  state: string;
  language: string;
  languagecodes: string;
  votes: number;
  lastchangetime: string;
  codec: string;
  bitrate: number;
  hls: number;
  lastcheckok: number;
  lastchecktime: string;
  lastcheckoktime: string;
  lastlocalchecktime: string;
  clicktimestamp: string;
  clickcount: number;
  clicktrend: number;
  ssl_error: number;
  geo_lat: number;
  geo_long: number;
  // Optional geocoding metadata
  geocoded_location?: string;
  geocoded_type?: 'country' | 'city' | 'village' | 'region';
}

export interface RadioApiResponse {
  stations: RadioStation[];
  total: number;
}

export interface CountryStats {
  name: string;
  iso_3166_1: string;
  stationcount: number;
}

export interface GenreStats {
  name: string;
  stationcount: number;
}

export interface AudioPlayerState {
  isPlaying: boolean;
  currentStation: RadioStation | null;
  volume: number;
  isLoading: boolean;
  error: string | null;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface SearchFilters {
  country?: string;
  genre?: string;
  language?: string;
  searchTerm?: string;
  minVotes?: number;
} 