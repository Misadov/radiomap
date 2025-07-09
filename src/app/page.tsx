'use client';

import { useState } from 'react';
import { Map, List, Radio, Heart } from 'lucide-react';
import { StationDataProvider } from '@/contexts/StationDataContext';
import RadioMap from '@/components/RadioMap';
import StationList from '@/components/StationList';
import Favorites from '@/components/Favorites';
import AudioPlayer from '@/components/AudioPlayer';
import Header from '@/components/Header';

type ViewMode = 'map' | 'list' | 'favorites';

export default function Home() {
  const [viewMode, setViewMode] = useState<ViewMode>('map');

  return (
    <StationDataProvider>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <Header />
        
        {/* View Mode Toggle */}
        <div className="fixed top-20 left-6 z-[1000] bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-soft border border-gray-700/50">
          <div className="flex p-1">
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-200 font-medium ${
                viewMode === 'map'
                  ? 'bg-primary-500 text-white shadow-medium transform scale-105'
                  : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
              }`}
            >
              <Map className="w-4 h-4" />
              <span className="text-sm">Map</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-200 font-medium ${
                viewMode === 'list'
                  ? 'bg-primary-500 text-white shadow-medium transform scale-105'
                  : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
              }`}
            >
              <List className="w-4 h-4" />
              <span className="text-sm">List</span>
            </button>
            <button
              onClick={() => setViewMode('favorites')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-200 font-medium ${
                viewMode === 'favorites'
                  ? 'bg-primary-500 text-white shadow-medium transform scale-105'
                  : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
              }`}
            >
              <Heart className="w-4 h-4" />
              <span className="text-sm">Favorites</span>
            </button>
          </div>
        </div>

        {/* Main Content - All components stay mounted */}
        <main className="pt-16 relative">
          {/* RadioMap View */}
          <div 
            className={`absolute inset-0 transition-all duration-300 ease-in-out ${
              viewMode === 'map' 
                ? 'opacity-100 pointer-events-auto transform translate-x-0' 
                : 'opacity-0 pointer-events-none transform translate-x-full'
            }`}
            style={{ willChange: 'transform, opacity' }}
          >
            <RadioMap />
          </div>

          {/* StationList View */}
          <div 
            className={`absolute inset-0 transition-all duration-300 ease-in-out ${
              viewMode === 'list' 
                ? 'opacity-100 pointer-events-auto transform translate-x-0' 
                : 'opacity-0 pointer-events-none transform -translate-x-full'
            }`}
            style={{ willChange: 'transform, opacity' }}
          >
            <StationList />
          </div>

          {/* Favorites View */}
          <div 
            className={`absolute inset-0 transition-all duration-300 ease-in-out ${
              viewMode === 'favorites' 
                ? 'opacity-100 pointer-events-auto transform translate-x-0' 
                : 'opacity-0 pointer-events-none transform translate-x-full'
            }`}
            style={{ willChange: 'transform, opacity' }}
          >
            <Favorites />
          </div>
        </main>

        {/* Audio Player */}
        <AudioPlayer />
      </div>
    </StationDataProvider>
  );
} 