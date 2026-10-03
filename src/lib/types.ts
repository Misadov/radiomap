// Shapes of the columnar datasets produced by scripts/build-data.mjs.

export const PlaceKind = { City: 0, Region: 1, Point: 2 } as const;

export interface PlacesFile {
  version: number;
  count: number;
  lng: number[];
  lat: number[];
  name: string[];
  /** Russian name, '' when identical or unknown. */
  ru: string[];
  /** Region the place belongs to (for disambiguation), '' if none. */
  sub: string[];
  /** Russian name of that region, '' when unknown. */
  subRu: string[];
  country: string[];
  kind: number[];
  /** Station count per place. */
  stations: number[];
}

export interface StationsFile {
  version: number;
  count: number;
  name: string[];
  favicon: string[];
  /** Comma-separated, normalised. */
  tags: string[];
  country: string[];
  language: string[];
  codec: string[];
  bitrate: number[];
  votes: number[];
  /** Index into places, -1 when only the country is known. */
  place: number[];
  precision: number[];
  /** Bit mask over src/data/genres.json. */
  genres: number[];
}

export interface StreamsFile {
  version: number;
  count: number;
  id: string[];
  url: string[];
  hls: number[];
}

/** Everything the UI needs to render and play a station. */
export interface Station {
  /** radio-browser station uuid ('' until streams are loaded). */
  id: string;
  /** Index in the dataset, -1 for stations that only exist in local storage. */
  index: number;
  name: string;
  favicon: string;
  tags: string[];
  country: string;
  language: string;
  codec: string;
  bitrate: number;
  votes: number;
  place: number;
  /** Display name of the place (city, region) — localised. */
  placeName: string;
  genres: number;
  url: string;
  hls: boolean;
}

/** Compact, persistable copy of a station (favourites, history). */
export interface SavedStation {
  id: string;
  name: string;
  favicon: string;
  country: string;
  placeName: string;
  tags: string[];
  codec: string;
  bitrate: number;
  url: string;
  hls: boolean;
}
