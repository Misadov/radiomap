'use client';

import { useState, useEffect, useCallback } from 'react';
import { RadioStation } from '@/types/radio';

interface FavoritesData {
  stations: RadioStation[];
  exportDate: string;
  version: string;
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<RadioStation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load favorites from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('radiomap_favorites');
      if (stored) {
        const parsed = JSON.parse(stored);
        setFavorites(Array.isArray(parsed) ? parsed : []);
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save favorites to localStorage whenever it changes
  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem('radiomap_favorites', JSON.stringify(favorites));
      } catch (error) {
        console.error('Error saving favorites:', error);
      }
    }
  }, [favorites, isLoading]);

  const addToFavorites = useCallback((station: RadioStation) => {
    setFavorites(prev => {
      // Check if already exists
      if (prev.some(fav => fav.stationuuid === station.stationuuid)) {
        return prev;
      }
      return [...prev, station];
    });
  }, []);

  const removeFromFavorites = useCallback((stationId: string) => {
    setFavorites(prev => prev.filter(fav => fav.stationuuid !== stationId));
  }, []);

  const isFavorite = useCallback((stationId: string) => {
    return favorites.some(fav => fav.stationuuid === stationId);
  }, [favorites]);

  const toggleFavorite = useCallback((station: RadioStation) => {
    if (isFavorite(station.stationuuid)) {
      removeFromFavorites(station.stationuuid);
    } else {
      addToFavorites(station);
    }
  }, [isFavorite, addToFavorites, removeFromFavorites]);

  const clearAllFavorites = useCallback(() => {
    setFavorites([]);
  }, []);

  const exportFavorites = useCallback(() => {
    const data: FavoritesData = {
      stations: favorites,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { 
      type: 'application/json' 
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `radiomap-favorites-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [favorites]);

  const importFavorites = useCallback((file: File): Promise<{ success: boolean; message: string; imported: number }> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content);
          
          // Validate data structure
          if (!data.stations || !Array.isArray(data.stations)) {
            resolve({ success: false, message: 'Invalid file format', imported: 0 });
            return;
          }

          // Filter out stations that already exist
          const newStations = data.stations.filter((station: RadioStation) => 
            !isFavorite(station.stationuuid)
          );

          if (newStations.length === 0) {
            resolve({ success: true, message: 'All stations already in favorites', imported: 0 });
            return;
          }

          // Add new stations
          setFavorites(prev => [...prev, ...newStations]);
          
          resolve({ 
            success: true, 
            message: `Successfully imported ${newStations.length} new station(s)`,
            imported: newStations.length 
          });
        } catch (error) {
          resolve({ success: false, message: 'Error parsing file', imported: 0 });
        }
      };

      reader.onerror = () => {
        resolve({ success: false, message: 'Error reading file', imported: 0 });
      };

      reader.readAsText(file);
    });
  }, [isFavorite]);

  return {
    favorites,
    isLoading,
    addToFavorites,
    removeFromFavorites,
    isFavorite,
    toggleFavorite,
    clearAllFavorites,
    exportFavorites,
    importFavorites,
    count: favorites.length
  };
} 