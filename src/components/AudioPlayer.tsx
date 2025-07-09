'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Play, Pause, Volume2, VolumeX, Info, ExternalLink, X, Radio } from 'lucide-react';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import StationImage from '@/components/shared/StationImage';
import AudioVisualizer from '@/components/AudioVisualizer';

export default function AudioPlayer() {
  const { state, audioElement, pause, resume, setVolume, stopAndClear } = useAudioPlayer();
  const [showInfo, setShowInfo] = useState(false);
  const [volumeVisible, setVolumeVisible] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [userClosed, setUserClosed] = useState(false);
  const volumeTimeoutRef = useRef<NodeJS.Timeout>();
  const volumeContainerRef = useRef<HTMLDivElement>(null);

  const { currentStation, isPlaying, volume, isLoading, error } = state;

  // Show/hide player with animation
  useEffect(() => {
    if ((currentStation || error) && !userClosed) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [currentStation, error, userClosed]);

  // Reset userClosed when a new station starts playing
  useEffect(() => {
    if (currentStation && !error) {
      setUserClosed(false);
    }
  }, [currentStation, error]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (volumeTimeoutRef.current) {
        clearTimeout(volumeTimeoutRef.current);
      }
    };
  }, []);

  // Improved volume hover handling
  const handleVolumeMouseEnter = () => {
    if (volumeTimeoutRef.current) {
      clearTimeout(volumeTimeoutRef.current);
    }
    setVolumeVisible(true);
  };

  const handleVolumeMouseLeave = () => {
    volumeTimeoutRef.current = setTimeout(() => {
      setVolumeVisible(false);
    }, 300); // Delay to prevent flickering
  };

  const handleVolumeInteraction = () => {
    if (volumeTimeoutRef.current) {
      clearTimeout(volumeTimeoutRef.current);
    }
    setVolumeVisible(true);
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      pause();
    } else {
      resume();
    }
  };

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    handleVolumeInteraction();
  }, [setVolume, handleVolumeInteraction]);

  // Handle scroll volume change
  const handleWheelVolumeChange = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Calculate volume change: 1% per scroll step
    const volumeStep = 0.01; // 1% steps (0.01 = 1%)
    const delta = e.deltaY < 0 ? volumeStep : -volumeStep; // Scroll up = increase, scroll down = decrease
    const newVolume = Math.max(0, Math.min(1, volume + delta));
    
    setVolume(newVolume);
    handleVolumeInteraction();
  }, [volume, setVolume, handleVolumeInteraction]);

  const handleClose = () => {
    setUserClosed(true);
    setShowInfo(false);
    setVolumeVisible(false);
    setTimeout(() => {
      stopAndClear();
    }, 300); // Wait for animation
  };

  const formatVolume = (vol: number) => Math.round(vol * 100);

  // Memoize volume slider background style to prevent re-calculations
  const volumeSliderStyle = useMemo(() => ({
    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${volume * 100}%, #4b5563 ${volume * 100}%, #4b5563 100%)`,
  }), [volume]);

  if ((!currentStation && !error) || userClosed) {
    return null;
  }

  return (
    <>
      {/* Player Container with slide-up animation */}
      <div 
        className={`fixed bottom-0 left-0 right-0 z-[1100] transition-all duration-300 ease-out ${
          isVisible 
            ? 'transform translate-y-0 opacity-100' 
            : 'transform translate-y-full opacity-0'
        }`}
        style={{ 
          pointerEvents: isVisible ? 'auto' : 'none',
          isolation: 'isolate'
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheelVolumeChange}
        title="Scroll to adjust volume"
      >
        <div className="bg-gray-900/95 backdrop-blur-xl shadow-2xl border-t border-gray-700/50 relative">
          {/* Additional black dim overlay for better readability */}
          <div className="absolute inset-0 bg-black/30 pointer-events-none"></div>
          <div className="relative z-10">
          {/* Main Player Content */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-4">
              {/* Station Info */}
              <div className="flex items-center space-x-4 flex-shrink-0">
                {/* Station Image */}
                <div className="relative">
                  {currentStation && <StationImage station={currentStation} size="medium" className="hover:scale-105 transition-transform duration-200" />}
                </div>

                {/* Station Details */}
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold text-white truncate mb-1 transition-colors duration-200">
                    {currentStation?.name || 'Radio Station'}
                  </h3>
                  <div className="flex items-center space-x-2 text-sm text-gray-300">
                    <span className="flex items-center">
                      {currentStation?.country}
                    </span>
                    {currentStation?.tags && (
                      <>
                        <span className="text-gray-500">•</span>
                        <span className="truncate opacity-75">{currentStation.tags.split(',')[0]}</span>
                      </>
                    )}
                  </div>
                  {error && (
                    <div className="flex items-center mt-2 text-sm text-red-400 animate-pulse">
                      <div className="w-2 h-2 bg-red-400 rounded-full mr-2"></div>
                      {error}
                    </div>
                  )}
                </div>
              </div>

              {/* Central Audio Visualizer */}
              <div className="flex-1 flex justify-center items-center mx-6">
                <AudioVisualizer audioElement={audioElement} isPlaying={isPlaying} />
              </div>

              {/* Controls */}
              <div className="flex items-center space-x-3 flex-shrink-0">
                {/* Volume Control */}
                <div 
                  ref={volumeContainerRef}
                  className="relative"
                  onMouseEnter={handleVolumeMouseEnter}
                  onMouseLeave={handleVolumeMouseLeave}
                >
                  <button
                    onClick={() => setVolume(volume > 0 ? 0 : 1)}
                    className="p-3 text-gray-300 hover:text-white transition-all duration-200 rounded-lg hover:bg-gray-700/50 transform hover:scale-110"
                    title={`Volume: ${formatVolume(volume)}%`}
                  >
                    {volume > 0 ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                  </button>
                  
                  {/* Volume Slider */}
                  <div 
                    className={`absolute bottom-full mb-3 left-1/2 transform -translate-x-1/2 transition-all duration-200 ${
                      volumeVisible 
                        ? 'opacity-100 translate-y-0 pointer-events-auto' 
                        : 'opacity-0 translate-y-2 pointer-events-none'
                    }`}
                    onMouseEnter={handleVolumeInteraction}
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseUp={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="bg-gray-800/95 backdrop-blur-sm rounded-xl shadow-xl border border-gray-600/50 p-4 min-w-[140px]">
                      {/* Volume slider container */}
                      <div className="flex items-center space-x-3">
                        <VolumeX className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <div className="flex-1 relative">
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={volume}
                            onChange={handleVolumeChange}
                            onMouseDown={(e) => e.stopPropagation()}
                            onMouseUp={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            onTouchEnd={(e) => e.stopPropagation()}
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                            style={{ ...volumeSliderStyle, isolation: 'isolate' }}
                          />
                        </div>
                        <Volume2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      </div>
                      
                      {/* Volume percentage */}
                      <div className="text-xs text-center text-gray-400 mt-2 font-medium">
                        {formatVolume(volume)}%
                      </div>
                    </div>
                    
                    {/* Arrow pointer */}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2">
                      <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800/95"></div>
                    </div>
                  </div>
                </div>

                {/* Play/Pause Button */}
                <button
                  onClick={handlePlayPause}
                  disabled={isLoading || !!error}
                  className={`flex items-center justify-center w-16 h-16 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 ${
                    isPlaying
                      ? 'bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white pulse-glow'
                      : 'bg-gradient-to-r from-gray-700 to-gray-600 hover:from-primary-500 hover:to-primary-600 text-gray-300 hover:text-white'
                  } disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
                >
                  {isLoading ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="w-7 h-7" />
                  ) : (
                    <Play className="w-7 h-7 ml-0.5" />
                  )}
                </button>

                {/* Info Button */}
                <button
                  onClick={() => setShowInfo(!showInfo)}
                  className={`p-3 rounded-lg transition-all duration-200 transform hover:scale-110 ${
                    showInfo 
                      ? 'text-primary-400 bg-primary-500/20' 
                      : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                  }`}
                  title="Station Info"
                >
                  <Info className="w-5 h-5" />
                </button>

                {/* Close Button */}
                <button
                  onClick={handleClose}
                  className="p-3 text-gray-300 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 rounded-lg transform hover:scale-110"
                  title="Close Player"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Extended Info Panel with slide animation */}
            <div 
              className={`overflow-hidden transition-all duration-300 ease-out ${
                showInfo 
                  ? 'max-h-96 opacity-100' 
                  : 'max-h-0 opacity-0'
              }`}
            >
              {currentStation && (
                <div className="border-t border-gray-600/50 py-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
                    {/* Station Details */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-white text-base flex items-center">
                        <Radio className="w-4 h-4 mr-2 text-primary-400" />
                        Station Details
                      </h4>
                      <div className="space-y-2 text-gray-300">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Country:</span> 
                          <span className="font-medium">{currentStation.country}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Language:</span> 
                          <span className="font-medium">{currentStation.language || 'Unknown'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Codec:</span> 
                          <span className="font-medium">{currentStation.codec || 'Unknown'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Bitrate:</span> 
                          <span className="font-medium">
                            {currentStation.bitrate ? `${currentStation.bitrate} kbps` : 'Unknown'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Links & Actions */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-white text-base flex items-center">
                        <ExternalLink className="w-4 h-4 mr-2 text-primary-400" />
                        Links & Info
                      </h4>
                      <div className="space-y-3">
                        {currentStation.homepage && (
                          <a
                            href={currentStation.homepage}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center space-x-2 text-primary-400 hover:text-primary-300 transition-colors p-2 rounded-lg hover:bg-primary-500/10"
                          >
                            <ExternalLink className="w-4 h-4" />
                            <span>Visit Website</span>
                          </a>
                        )}
                        <div className="flex items-center justify-between p-2 bg-gray-700/30 rounded-lg">
                          <span className="text-gray-400">Community Votes:</span>
                          <span className="font-bold text-primary-400">{currentStation.votes}</span>
                        </div>
                      </div>
                    </div>

                    {/* Tags */}
                    {currentStation.tags && (
                      <div className="space-y-3">
                        <h4 className="font-semibold text-white text-base">Tags</h4>
                        <div className="flex flex-wrap gap-2">
                          {currentStation.tags.split(',').slice(0, 6).map((tag, index) => (
                            <span 
                              key={index}
                              className="px-2 py-1 bg-gray-700/50 text-gray-300 text-xs rounded-md border border-gray-600/30"
                            >
                              {tag.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* Global styles for volume slider - simplified for performance */}
      <style jsx global>{`
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #ffffff;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        
        input[type="range"]::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #ffffff;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        
        .pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }
        
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.4);
          }
          50% {
            box-shadow: 0 0 30px rgba(59, 130, 246, 0.6), 0 0 40px rgba(59, 130, 246, 0.3);
          }
        }
      `}</style>
    </>
  );
} 