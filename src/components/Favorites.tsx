'use client';

import { useState, useRef, useEffect } from 'react';
import { Heart, Play, Pause, Upload, Download, Trash2, Volume2 } from 'lucide-react';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { useFavorites } from '@/hooks/useFavorites';
import StationImage from '@/components/shared/StationImage';

interface ToastState {
  show: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
}

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

export default function Favorites() {
  const { favorites, isLoading, exportFavorites, importFavorites, clearAllFavorites, removeFromFavorites } = useFavorites();
  const { playStation, state } = useAudioPlayer();
  const [toast, setToast] = useState<ToastState>({ show: false, message: '', type: 'info' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isVisible, componentRef } = useComponentVisibility();

  const showToast = (message: string, type: ToastState['type'] = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 4000);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await importFavorites(file);
      if (result.success) {
        showToast(result.message, 'success');
      } else {
        showToast(result.message, 'error');
      }
    } catch (error) {
      showToast('Error importing favorites', 'error');
    }

    // Clear the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleExport = () => {
    if (favorites.length === 0) {
      showToast('No favorites to export', 'info');
      return;
    }
    exportFavorites();
    showToast(`Exported ${favorites.length} favorite stations`, 'success');
  };

  const handleClearAll = () => {
    if (window.confirm(`Are you sure you want to remove all ${favorites.length} favorite stations?`)) {
      clearAllFavorites();
      showToast('All favorites cleared', 'success');
    }
  };

  const handlePlayStation = (station: any) => {
    playStation(station);
  };

  const handleRemoveStation = (stationId: string) => {
    removeFromFavorites(stationId);
    showToast('Station removed from favorites', 'success');
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <Heart className="w-8 h-8 animate-pulse text-primary-500 mx-auto mb-4" />
          <p className="text-gray-300">Loading your favorites...</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={componentRef} className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className={`max-w-7xl mx-auto px-6 lg:px-8 py-8 ${state.currentStation ? 'pb-32' : ''}`}>
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-gray-200 to-gray-300 bg-clip-text text-transparent mb-3">
            Your Favorites
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            {favorites.length > 0 ? (
              <>Your collection of <span className="font-semibold text-primary-400">{favorites.length}</span> favorite radio stations</>
            ) : (
              <>Start building your collection by adding stations to favorites</>
            )}
          </p>
        </div>

        {/* Only render expensive operations when visible */}
        {isVisible && (
          <>
            {/* Controls */}
            <div className="bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-soft border border-gray-700/50 p-6 mb-10">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={handleImportClick}
                    className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-medium hover:from-blue-700 hover:to-blue-600 transition-all duration-200 shadow-medium hover:shadow-large transform hover:-translate-y-0.5"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Import</span>
                  </button>
                  
                  <button
                    onClick={handleExport}
                    disabled={favorites.length === 0}
                    className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-xl font-medium hover:from-green-700 hover:to-green-600 transition-all duration-200 shadow-medium hover:shadow-large transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export</span>
                  </button>
                </div>
                
                {favorites.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-xl font-medium hover:from-red-700 hover:to-red-600 transition-all duration-200 shadow-medium hover:shadow-large transform hover:-translate-y-0.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Clear All</span>
                  </button>
                )}
              </div>
            </div>

            {/* Favorites Grid */}
            {favorites.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {favorites.map((station) => (
                  <div
                    key={station.stationuuid}
                    className="bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-soft border border-gray-700/50 p-6 hover:shadow-large transition-all duration-300 hover:-translate-y-1"
                  >
                    <div className="flex items-start space-x-4">
                      <StationImage station={station} size="large" className="flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white mb-1 truncate">
                          {station.name}
                        </h3>
                        <p className="text-sm text-gray-300 mb-2">
                          {station.country}
                          {station.language && ` • ${station.language}`}
                        </p>
                        {station.tags && (
                          <p className="text-sm text-gray-400 mb-3 line-clamp-2">
                            {station.tags}
                          </p>
                        )}
                        
                        <div className="flex items-center justify-between mt-4">
                          <div className="flex items-center space-x-4">
                            <button
                              onClick={() => handlePlayStation(station)}
                              disabled={state.isLoading && state.currentStation?.stationuuid === station.stationuuid}
                              className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 ${
                                state.currentStation?.stationuuid === station.stationuuid && state.isPlaying
                                  ? 'bg-primary-500 text-white'
                                  : 'bg-gray-700 text-gray-300 hover:bg-primary-500 hover:text-white'
                              } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                              {state.isLoading && state.currentStation?.stationuuid === station.stationuuid ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : state.currentStation?.stationuuid === station.stationuuid && state.isPlaying ? (
                                <Pause className="w-4 h-4" />
                              ) : (
                                <Play className="w-4 h-4 ml-0.5" />
                              )}
                            </button>
                            
                            <button
                              onClick={() => handleRemoveStation(station.stationuuid)}
                              className="flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 bg-red-500/20 text-red-400 hover:bg-red-500/30"
                              title="Remove from favorites"
                            >
                              <Heart className="w-4 h-4 fill-current" />
                            </button>
                          </div>
                          
                          <div className="text-right">
                            <p className="text-xs text-gray-400">
                              {station.votes} votes
                            </p>
                            {station.bitrate && (
                              <p className="text-xs text-gray-500">
                                {station.bitrate} kbps
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <div className="w-20 h-20 bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Heart className="w-10 h-10 text-gray-500" />
                </div>
                <h3 className="text-xl font-semibold text-gray-300 mb-2">No favorites yet</h3>
                <p className="text-gray-400 mb-6 max-w-md mx-auto">
                  Browse stations in the Map or List view and click the heart icon to add them to your favorites.
                </p>
                <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                  <Heart className="w-4 h-4" />
                  <span>Click the heart icon on any station to add it here</span>
                </div>
              </div>
            )}
          </>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Toast Notification */}
        {toast.show && (
          <div className={`fixed bottom-6 right-6 z-50 px-6 py-4 rounded-xl shadow-large border backdrop-blur-sm transform transition-all duration-300 ${
            toast.type === 'success' 
              ? 'bg-green-900/90 border-green-700 text-green-200'
              : toast.type === 'error'
              ? 'bg-red-900/90 border-red-700 text-red-200'  
              : 'bg-blue-900/90 border-blue-700 text-blue-200'
          }`}>
            <p className="font-medium">{toast.message}</p>
          </div>
        )}
      </div>
    </div>
  );
} 