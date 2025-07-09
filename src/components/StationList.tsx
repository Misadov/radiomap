'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Filter, Play, Pause, Globe, Tag, Users, Loader, X, Heart } from 'lucide-react';
import { RadioStation, CountryStats, GenreStats, SearchFilters } from '@/types/radio';
import { useStationData } from '@/contexts/StationDataContext';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { useFavorites } from '@/hooks/useFavorites';
import StationImage from '@/components/shared/StationImage';

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

export default function StationList() {
  const [filteredStations, setFilteredStations] = useState<RadioStation[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const { isVisible, componentRef } = useComponentVisibility();
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 24;
  
  // Filter states
  const [filters, setFilters] = useState<SearchFilters>({});
  const [searchTerm, setSearchTerm] = useState('');
  
  const { playStation, pause, state } = useAudioPlayer();
  const { isFavorite, toggleFavorite } = useFavorites();
  
  // Use shared station data context
  const { allStations, countries, genres, loading, error, refresh } = useStationData();

  // Apply filters when they change, but only if component is visible
  useEffect(() => {
    if (isVisible) {
      applyFilters();
    }
  }, [filters, searchTerm, allStations, isVisible]);

  const applyFilters = () => {
    let filtered = [...allStations];

    // Apply search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(station => {
        const nameMatch = station.name.toLowerCase().includes(term);
        const countryMatch = station.country.toLowerCase().includes(term);
        const languageMatch = station.language?.toLowerCase().includes(term);
        
        // Search in individual tags
        let tagsMatch = false;
        if (station.tags) {
          const tags = station.tags.split(',').map(tag => tag.trim().toLowerCase());
          tagsMatch = tags.some(tag => tag.includes(term));
        }
        
        return nameMatch || countryMatch || languageMatch || tagsMatch;
      });
    }

    // Apply country filter
    if (filters.country) {
      filtered = filtered.filter(station => station.country === filters.country);
    }

    // Apply genre filter
    if (filters.genre) {
      filtered = filtered.filter(station => {
        if (!station.tags) return false;
        const tags = station.tags.split(',').map(tag => tag.trim().toLowerCase());
        return tags.includes(filters.genre!.toLowerCase());
      });
    }

    // Apply language filter
    if (filters.language) {
      filtered = filtered.filter(station => station.language === filters.language);
    }

    // Apply minimum votes filter
    if (filters.minVotes) {
      filtered = filtered.filter(station => station.votes >= filters.minVotes!);
    }

    // Sort by votes (descending)
    filtered.sort((a, b) => b.votes - a.votes);

    setFilteredStations(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  };

  const handleStationPlay = async (station: RadioStation) => {
    try {
      if (state.currentStation?.stationuuid === station.stationuuid && state.isPlaying) {
        pause();
      } else {
        await playStation(station);
      }
    } catch (err) {
      console.error('Error playing station:', err);
    }
  };

  const clearFilters = () => {
    setFilters({});
    setSearchTerm('');
  };

  // Count only filters with actual values
  const activeFilterCount = Object.values(filters).filter(value => value !== undefined && value !== '').length;
  const hasActiveFilters = activeFilterCount > 0 || searchTerm;

  // Pagination calculations - only when visible
  const totalPages = useMemo(() => {
    if (!isVisible) return 0;
    return Math.ceil(filteredStations.length / itemsPerPage);
  }, [filteredStations.length, itemsPerPage, isVisible]);
  
  const currentStations = useMemo(() => {
    if (!isVisible) return [];
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredStations.slice(startIndex, endIndex);
  }, [filteredStations, currentPage, itemsPerPage, isVisible]);

  // Get unique languages from stations - only when visible
  const languages = useMemo(() => {
    if (!isVisible) return [];
    const langSet = new Set(allStations.map(s => s.language).filter(Boolean));
    return Array.from(langSet).sort();
  }, [allStations, isVisible]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-primary-500 mx-auto mb-4" />
          <p className="text-gray-300">Loading radio stations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Globe className="w-8 h-8 text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Error Loading Stations</h3>
          <p className="text-gray-300 mb-4">{error}</p>
          <button
            onClick={refresh}
            className="bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors"
          >
            Try Again
          </button>
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
            Radio Stations
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Discover and listen to <span className="font-semibold text-primary-400">{allStations.length.toLocaleString()}</span> radio stations from around the world
            {filteredStations.length !== allStations.length && (
              <span className="block text-sm text-gray-400 mt-1">
                {filteredStations.length.toLocaleString()} matching your search
              </span>
            )}
          </p>
        </div>

        {/* Search and Filters - Only render expensive parts when visible */}
        {isVisible && (
          <>
            {/* Search and Filters */}
            <div className="bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-soft border border-gray-700/50 p-6 mb-10">
              <div className="flex flex-col lg:flex-row lg:items-center space-y-4 lg:space-y-0 lg:space-x-4">
                {/* Search Input */}
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search stations, countries, or genres..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-600 rounded-xl bg-gray-700/50 backdrop-blur-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-400 transition-all duration-200 placeholder-gray-400 text-white"
                  />
                </div>

                {/* Filter Toggle */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center space-x-2 px-6 py-3 rounded-xl transition-all duration-200 font-medium shadow-medium hover:shadow-large ${
                    showFilters || hasActiveFilters
                      ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white transform scale-105'
                      : 'bg-gradient-to-r from-gray-700 to-gray-600 text-gray-200 hover:from-primary-600 hover:to-primary-500 hover:text-white'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  <span>Filters</span>
                  {hasActiveFilters && (
                    <span className="bg-white bg-opacity-20 text-xs px-2 py-1 rounded-full">
                      {activeFilterCount + (searchTerm ? 1 : 0)}
                    </span>
                  )}
                </button>

                {/* Clear Filters */}
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center space-x-2 px-4 py-2 text-gray-300 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              {/* Filter Panel */}
              {showFilters && (
                <div className="mt-6 pt-6 border-t border-gray-600">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Country Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        <Globe className="w-4 h-4 inline mr-1" />
                        Country
                      </label>
                      <select
                        value={filters.country || ''}
                        onChange={(e) => setFilters({ ...filters, country: e.target.value || undefined })}
                        className="w-full px-3 py-2 border border-gray-600 rounded-lg bg-gray-700 text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        <option value="">All Countries</option>
                        {countries.map(country => (
                          <option key={country.iso_3166_1} value={country.name}>
                            {country.name} ({country.stationcount})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Genre Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        <Tag className="w-4 h-4 inline mr-1" />
                        Genre
                      </label>
                      <select
                        value={filters.genre || ''}
                        onChange={(e) => setFilters({ ...filters, genre: e.target.value || undefined })}
                        className="w-full px-3 py-2 border border-gray-600 rounded-lg bg-gray-700 text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        <option value="">All Genres</option>
                        {genres.map(genre => (
                          <option key={genre.name} value={genre.name}>
                            {genre.name} ({genre.stationcount})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Language Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        <Users className="w-4 h-4 inline mr-1" />
                        Language
                      </label>
                      <select
                        value={filters.language || ''}
                        onChange={(e) => setFilters({ ...filters, language: e.target.value || undefined })}
                        className="w-full px-3 py-2 border border-gray-600 rounded-lg bg-gray-700 text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        <option value="">All Languages</option>
                        {languages.map(language => (
                          <option key={language} value={language}>
                            {language}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Minimum Votes Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Min Popularity
                      </label>
                      <select
                        value={filters.minVotes || ''}
                        onChange={(e) => setFilters({ ...filters, minVotes: e.target.value ? parseInt(e.target.value) : undefined })}
                        className="w-full px-3 py-2 border border-gray-600 rounded-lg bg-gray-700 text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        <option value="">Any</option>
                        <option value="10">10+ votes</option>
                        <option value="50">50+ votes</option>
                        <option value="100">100+ votes</option>
                        <option value="500">500+ votes</option>
                        <option value="1000">1000+ votes</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Station Grid - Only render when visible */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {currentStations.map((station: RadioStation) => (
                <div
                  key={station.stationuuid}
                  className="radio-item bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-soft border border-gray-700/50 p-6 hover:shadow-large transition-all duration-300 hover:-translate-y-1"
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
                            onClick={() => handleStationPlay(station)}
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
                            onClick={() => toggleFavorite(station)}
                            className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 ${
                              isFavorite(station.stationuuid)
                                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                : 'bg-gray-700 text-gray-400 hover:bg-red-500/20 hover:text-red-400'
                            }`}
                          >
                            <Heart 
                              className={`w-4 h-4 ${isFavorite(station.stationuuid) ? 'fill-current' : ''}`} 
                            />
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

            {/* Pagination - Only render when visible */}
            {totalPages > 1 && (
              <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-gray-400">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredStations.length)} of {filteredStations.length} stations
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 text-sm bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-10 h-10 text-sm rounded-lg transition-colors ${
                            currentPage === pageNum
                              ? 'bg-primary-500 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 text-sm bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Empty State */}
        {filteredStations.length === 0 && !loading && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No stations found</h3>
            <p className="text-gray-300">
              Try adjusting your search terms or filters to find more stations.
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 