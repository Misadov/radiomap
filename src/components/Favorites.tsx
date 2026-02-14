'use client';

import { useFavorites } from '@/hooks/useFavorites';
import { useStationData } from '@/contexts/StationDataContext';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { Play, Pause, Heart, Radio, AlertTriangle } from 'lucide-react';
import { RadioStation } from '@/types/radio';

export default function Favorites() {
  const { favorites, toggleFavorite } = useFavorites();
  const { allStations } = useStationData();
  const { playStation, state } = useAudioPlayer();

  // Hydrate favorites with full station data from the big list if available,
  // otherwise fallback to stored favorite data
  const favoriteStations = favorites.map(fav => {
     const freshData = allStations.find(s => s.stationuuid === fav.stationuuid);
     return freshData || fav;
  });

  return (
    <div className="h-full w-full bg-black text-white flex flex-col pt-4 pb-24 font-sans">
      
      {/* Header */}
      <div className="px-6 py-4 border-b border-on-air-dim flex items-center justify-between">
         <div>
            <h2 className="text-xl font-bold uppercase tracking-widest text-on-air flex items-center gap-2">
               <Heart className="w-5 h-5 fill-current" />
               Secure Frequencies
            </h2>
            <p className="font-mono text-[10px] text-tech-500 mt-1">
               ENCRYPTED STORAGE // {favoriteStations.length} SLOTS USED
            </p>
         </div>
      </div>

      {favoriteStations.length === 0 ? (
         <div className="flex-1 flex flex-col items-center justify-center text-tech-600">
            <Radio className="w-16 h-16 mb-4 opacity-20" />
            <p className="font-mono text-sm">NO FREQUENCIES SAVED</p>
            <p className="text-xs mt-2 opacity-50">SCAN MAP TO ACQUIRE TARGETS</p>
         </div>
      ) : (
         <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {favoriteStations.map(station => {
               const isPlaying = state.currentStation?.stationuuid === station.stationuuid && state.isPlaying;
               
               return (
                  <div 
                     key={station.stationuuid}
                     className={`relative bg-tech-900 border transition-all duration-300 group ${
                        isPlaying ? 'border-signal shadow-glow-signal' : 'border-tech-800 hover:border-tech-500'
                     }`}
                  >
                     {/* Active Indicator */}
                     {isPlaying && <div className="absolute top-0 right-0 w-2 h-2 bg-signal animate-pulse"></div>}

                     <div className="p-4 flex items-center gap-4">
                        {/* Play Button */}
                        <button
                           onClick={() => playStation(station)}
                           className={`w-12 h-12 flex items-center justify-center border transition-colors flex-shrink-0 ${
                              isPlaying 
                                 ? 'bg-signal-dim text-signal border-signal' 
                                 : 'bg-black text-white border-tech-700 group-hover:border-white'
                           }`}
                        >
                           {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                        </button>

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                           <h3 className="font-bold text-sm truncate text-gray-200 group-hover:text-white">
                              {station.name}
                           </h3>
                           <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] font-mono text-tech-500 bg-tech-800 px-1">
                                 {station.countrycode || 'UNK'}
                              </span>
                              <span className="text-[10px] font-mono text-tech-500 truncate">
                                 {station.bitrate}k
                              </span>
                           </div>
                        </div>

                        {/* Remove Action */}
                        <button
                           onClick={() => toggleFavorite(station)}
                           className="text-tech-600 hover:text-on-air transition-colors"
                           title="Remove"
                        >
                           <Heart className="w-4 h-4 fill-current" />
                        </button>
                     </div>
                  </div>
               );
            })}
         </div>
      )}
    </div>
  );
}
