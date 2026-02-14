'use client';

import { useState, useMemo } from 'react';
import { useStationData } from '@/contexts/StationDataContext';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { useFavorites } from '@/hooks/useFavorites';
import { Play, Pause, Heart, Search, Globe, Music } from 'lucide-react';
import StationImage from '@/components/shared/StationImage';
import { RadioStation } from '@/types/radio';

export default function StationList() {
  const { allStations } = useStationData();
  const { playStation, state } = useAudioPlayer();
  const { isFavorite, toggleFavorite } = useFavorites();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [limit, setLimit] = useState(50); // Pagination/Limit for performance

  // Filter stations
  const filteredStations = useMemo(() => {
    if (!searchTerm) return allStations.slice(0, limit);
    
    const lower = searchTerm.toLowerCase();
    return allStations.filter(s => 
      s.name.toLowerCase().includes(lower) || 
      s.country.toLowerCase().includes(lower) ||
      (s.tags && s.tags.toLowerCase().includes(lower))
    ).slice(0, limit);
  }, [allStations, searchTerm, limit]);

  return (
    <div className="h-full w-full bg-black text-white flex flex-col pt-4 pb-24 overflow-hidden font-sans">
      
      {/* Header / Search Bar */}
      <div className="px-6 py-4 flex-shrink-0 border-b border-tech-800">
        <div className="flex items-center justify-between mb-4">
           <h2 className="text-xl font-bold uppercase tracking-widest text-signal">
              Global Frequency List
           </h2>
           <span className="font-mono text-xs text-tech-500">
              {allStations.length.toLocaleString()} RECORDS
           </span>
        </div>

        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-tech-500 group-focus-within:text-signal transition-colors" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-tech-700 rounded-none leading-5 bg-tech-900 text-gray-300 placeholder-tech-600 focus:outline-none focus:border-signal focus:ring-1 focus:ring-signal sm:text-sm font-mono transition-all"
            placeholder="SEARCH FREQUENCIES [NAME, COUNTRY, TAG]..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Data Grid Header */}
      <div className="grid grid-cols-12 gap-4 px-6 py-2 border-b border-tech-800 text-[10px] uppercase font-mono text-tech-500 tracking-wider">
         <div className="col-span-1 text-center">STS</div>
         <div className="col-span-6 md:col-span-5">Identity</div>
         <div className="col-span-3 hidden md:block">Origin</div>
         <div className="col-span-2 hidden md:block">Tags</div>
         <div className="col-span-2 md:col-span-1 text-right">Action</div>
      </div>

      {/* List Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filteredStations.map((station, index) => {
           const isPlaying = state.currentStation?.stationuuid === station.stationuuid && state.isPlaying;
           
           return (
             <div 
               key={station.stationuuid}
               className={`grid grid-cols-12 gap-4 px-6 py-3 border-b border-tech-900 hover:bg-tech-900/50 transition-colors group items-center ${isPlaying ? 'bg-tech-900/80 border-l-2 border-l-signal pl-[22px]' : 'pl-6'}`}
             >
                {/* Status / Play Button */}
                <div className="col-span-1 flex justify-center">
                   <button
                      onClick={() => playStation(station)}
                      className={`w-8 h-8 flex items-center justify-center border transition-all ${
                         isPlaying 
                           ? 'border-signal text-signal bg-signal-dim' 
                           : 'border-tech-700 text-tech-500 hover:border-white hover:text-white bg-black'
                      }`}
                   >
                      {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.5" />}
                   </button>
                </div>

                {/* Identity (Name + Bitrate) */}
                <div className="col-span-6 md:col-span-5 min-w-0">
                   <div className={`font-bold text-sm truncate ${isPlaying ? 'text-signal' : 'text-gray-200 group-hover:text-white'}`}>
                      {station.name}
                   </div>
                   <div className="font-mono text-[10px] text-tech-500 truncate flex items-center gap-2">
                      <span>ID: {station.stationuuid.slice(0, 8)}</span>
                      {station.bitrate > 0 && <span className="text-tech-600">| {station.bitrate}k</span>}
                   </div>
                </div>

                {/* Origin */}
                <div className="col-span-3 hidden md:flex items-center text-xs text-tech-400 font-mono gap-2">
                   <Globe className="w-3 h-3 flex-shrink-0 opacity-50" />
                   <span className="truncate">{station.country}</span>
                </div>

                {/* Tags */}
                <div className="col-span-2 hidden md:flex items-center text-[10px] text-tech-500 uppercase tracking-tight gap-2">
                   <span className="truncate">{station.tags?.split(',').slice(0, 2).join(', ') || '-'}</span>
                </div>

                {/* Actions */}
                <div className="col-span-2 md:col-span-1 flex justify-end">
                   <button
                      onClick={() => toggleFavorite(station)}
                      className={`p-2 transition-colors ${isFavorite(station.stationuuid) ? 'text-on-air' : 'text-tech-600 hover:text-white'}`}
                   >
                      <Heart className={`w-4 h-4 ${isFavorite(station.stationuuid) ? 'fill-current' : ''}`} />
                   </button>
                </div>
             </div>
           );
        })}
        
        {/* Load More Trigger (Simple) */}
        {filteredStations.length >= limit && (
           <div className="p-4 text-center">
              <button 
                 onClick={() => setLimit(l => l + 50)}
                 className="px-6 py-2 border border-tech-700 text-tech-400 font-mono text-xs hover:border-signal hover:text-signal transition-colors uppercase"
              >
                 Load More Data...
              </button>
           </div>
        )}
      </div>
    </div>
  );
}
