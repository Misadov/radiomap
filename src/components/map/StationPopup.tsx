import React from 'react';
import { Heart, Play, Pause } from 'lucide-react';
import StationImage from '@/components/shared/StationImage';
import { RadioStation } from '@/types/radio';
import '@/styles/cluster.css';

interface StationPopupProps {
  station: RadioStation;
  isPlaying: boolean;
  isLoading: boolean;
  isFav: boolean;
  onPlay: (station: RadioStation) => void;
  onToggleFavorite: (station: RadioStation) => void;
}

const StationPopup = ({
  station,
  isPlaying,
  isLoading,
  isFav,
  onPlay,
  onToggleFavorite,
}: StationPopupProps) => {
  return (
    <div className="w-[300px] bg-tech-900/95 backdrop-blur-md border border-tech-700 font-sans shadow-panel overflow-hidden group hover:border-signal/50 transition-colors duration-300">
      {/* Header: ID + Status */}
      <div className="bg-tech-800/50 px-3 py-1.5 border-b border-tech-700 flex justify-between items-center">
        <span className="font-mono text-[10px] text-tech-500 uppercase tracking-widest">
          ID: {station.stationuuid?.slice(0, 8) || 'Unknown'}
        </span>
        {isPlaying && (
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-signal opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-signal"></span>
            </span>
            <span className="font-mono text-[10px] text-signal font-bold tracking-wider">ON AIR</span>
          </span>
        )}
      </div>

      <div className="p-3 flex gap-3">
        {/* Album Art / Station Logo */}
        <div className="relative w-16 h-16 bg-black border border-tech-700 flex-shrink-0 group-hover:border-signal/30 transition-colors">
          <StationImage station={station} className="w-full h-full object-cover filter grayscale group-hover:grayscale-0 transition-all duration-500" />
          
          {/* Play Button Overlay */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPlay(station);
            }}
            disabled={isLoading}
            className={`absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${
              isPlaying ? 'opacity-100 bg-black/40' : ''
            }`}
          >
            {isLoading ? (
              <div className="w-6 h-6 border-2 border-signal border-t-transparent rounded-full animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-8 h-8 text-signal drop-shadow-glow" strokeWidth={1.5} />
            ) : (
              <Play className="w-8 h-8 text-white hover:text-signal transition-colors drop-shadow-md" strokeWidth={1.5} />
            )}
          </button>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
          <div>
            <h3 className="text-white font-bold text-sm leading-tight truncate mb-1 group-hover:text-signal transition-colors">
              {station.name}
            </h3>
            <div className="flex items-center gap-2 text-[10px] text-tech-400 font-mono">
              <span className="truncate max-w-[120px]">📍 {station.country}</span>
              {station.bitrate > 0 && (
                <span className="shrink-0 text-tech-500">
                  {station.bitrate}k
                </span>
              )}
            </div>
          </div>

          <div className="flex items-end justify-between mt-2">
            <div className="flex gap-2">
               {/* Tags (scrolling or truncated) */}
               <div className="text-[10px] text-tech-500 uppercase tracking-wide truncate max-w-[140px]">
                 {station.tags?.split(',').slice(0, 2).join(', ')}
               </div>
            </div>

            {/* Actions */}
            <div className="flex gap-1">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleFavorite(station);
                }}
                className={`p-1.5 rounded-sm transition-colors ${
                  isFav 
                    ? 'text-on-air hover:text-on-air-dim' 
                    : 'text-tech-600 hover:text-white'
                }`}
                title={isFav ? 'Remove Fav' : 'Add Fav'}
              >
                <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Audio Visualizer Strip (Fake for now, driven by CSS) */}
      <div className="h-0.5 w-full bg-tech-800 overflow-hidden">
        <div 
          className={`h-full bg-signal shadow-glow-signal transition-all duration-[2000ms] ease-in-out ${
             isPlaying ? 'w-full opacity-100 animate-pulse' : 'w-0 opacity-0'
          }`}
        />
      </div>
    </div>
  );
};

export default StationPopup;
