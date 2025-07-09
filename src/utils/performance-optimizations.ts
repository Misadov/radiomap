import { RadioStation } from '@/types/radio';

/**
 * Filter stations based on zoom level to improve performance
 * Higher zoom = more stations visible
 * Lower zoom = only show high-quality stations
 */
export function filterStationsByZoom(stations: RadioStation[], zoomLevel: number): RadioStation[] {
  // At very low zoom levels, show only the highest quality stations
  if (zoomLevel <= 3) {
    return stations
      .filter(station => station.votes >= 1000)
      .sort((a, b) => b.votes - a.votes)
      .slice(0, 1000); // Max 1k stations for world view
  }
  
  // At low zoom levels, show high-quality stations
  if (zoomLevel <= 5) {
    return stations
      .filter(station => station.votes >= 100)
      .sort((a, b) => b.votes - a.votes)
      .slice(0, 5000); // Max 5k stations for continent view
  }
  
  // At medium zoom levels, show medium-quality stations
  if (zoomLevel <= 8) {
    return stations
      .filter(station => station.votes >= 10)
      .sort((a, b) => b.votes - a.votes)
      .slice(0, 15000); // Max 15k stations for country view
  }
  
  // At high zoom levels, show all stations
  if (zoomLevel <= 12) {
    return stations
      .sort((a, b) => b.votes - a.votes)
      .slice(0, 25000); // Max 25k stations for regional view
  }
  
  // At very high zoom levels, show everything
  return stations; // All stations for city/local view
}

/**
 * Filter stations by viewport bounds to reduce rendering load
 */
export function filterStationsByBounds(
  stations: RadioStation[], 
  bounds: { north: number; south: number; east: number; west: number }
): RadioStation[] {
  return stations.filter(station => {
    const lat = station.geo_lat;
    const lng = station.geo_long;
    
    // Add some padding to bounds for smooth transitions
    const padding = 0.1;
    
    return lat >= bounds.south - padding && 
           lat <= bounds.north + padding &&
           lng >= bounds.west - padding && 
           lng <= bounds.east + padding;
  });
}

/**
 * Batch process stations for efficient rendering
 */
export function batchStationsForRendering(
  stations: RadioStation[], 
  batchSize: number = 1000
): RadioStation[][] {
  const batches: RadioStation[][] = [];
  
  for (let i = 0; i < stations.length; i += batchSize) {
    batches.push(stations.slice(i, i + batchSize));
  }
  
  return batches;
}

/**
 * Prioritize stations by quality for progressive loading
 */
export function prioritizeStationsByQuality(stations: RadioStation[]): RadioStation[] {
  return stations.sort((a, b) => {
    // Primary sort: votes (higher is better)
    if (b.votes !== a.votes) {
      return b.votes - a.votes;
    }
    
    // Secondary sort: has geocoded location (geocoded is better)
    const aGeocoded = a.geocoded_location ? 1 : 0;
    const bGeocoded = b.geocoded_location ? 1 : 0;
    if (bGeocoded !== aGeocoded) {
      return bGeocoded - aGeocoded;
    }
    
    // Tertiary sort: bitrate (higher is better)
    const aBitrate = a.bitrate || 0;
    const bBitrate = b.bitrate || 0;
    return bBitrate - aBitrate;
  });
}

/**
 * Debounce function for zoom/pan events
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T, 
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
}

/**
 * Calculate efficient cluster radius based on zoom level
 */
export function getOptimalClusterRadius(zoomLevel: number): number {
  // Smaller radius at higher zoom levels for more granular clustering
  if (zoomLevel >= 16) return 30;
  if (zoomLevel >= 12) return 40;
  if (zoomLevel >= 8) return 50;
  if (zoomLevel >= 5) return 60;
  if (zoomLevel >= 3) return 80;
  return 100; // Larger radius for world view
}

/**
 * Estimate memory usage for stations
 */
export function estimateMemoryUsage(stationCount: number): {
  estimated: string;
  warning: boolean;
} {
  // Rough estimate: ~500 bytes per station object + DOM overhead
  const bytesPerStation = 500;
  const totalBytes = stationCount * bytesPerStation;
  const totalMB = totalBytes / (1024 * 1024);
  
  return {
    estimated: `~${totalMB.toFixed(1)}MB`,
    warning: totalMB > 100 // Warn if over 100MB
  };
}

/**
 * Progressive loading strategy for massive datasets
 */
export class ProgressiveStationLoader {
  private stations: RadioStation[] = [];
  private loadedBatches: number = 0;
  private batchSize: number = 2000;
  private onBatchLoaded?: (batch: RadioStation[], progress: number) => void;
  
  constructor(
    stations: RadioStation[], 
    batchSize: number = 2000,
    onBatchLoaded?: (batch: RadioStation[], progress: number) => void
  ) {
    this.stations = prioritizeStationsByQuality(stations);
    this.batchSize = batchSize;
    this.onBatchLoaded = onBatchLoaded;
  }
  
  async loadNextBatch(): Promise<RadioStation[] | null> {
    const start = this.loadedBatches * this.batchSize;
    const end = start + this.batchSize;
    
    if (start >= this.stations.length) {
      return null; // No more batches
    }
    
    const batch = this.stations.slice(start, end);
    this.loadedBatches++;
    
    const progress = Math.min(100, (end / this.stations.length) * 100);
    
    // Small delay to prevent UI blocking
    await new Promise(resolve => setTimeout(resolve, 10));
    
    if (this.onBatchLoaded) {
      this.onBatchLoaded(batch, progress);
    }
    
    return batch;
  }
  
  getTotalBatches(): number {
    return Math.ceil(this.stations.length / this.batchSize);
  }
  
  getProgress(): number {
    return Math.min(100, (this.loadedBatches / this.getTotalBatches()) * 100);
  }
  
  reset(): void {
    this.loadedBatches = 0;
  }
} 