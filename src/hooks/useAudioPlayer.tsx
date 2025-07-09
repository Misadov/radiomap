'use client';

import React, { createContext, useContext, useReducer, useRef, useEffect } from 'react';
import { AudioPlayerState, RadioStation } from '@/types/radio';
import { RadioAPI } from '@/utils/radioApi';

type AudioPlayerAction =
  | { type: 'SET_STATION'; payload: RadioStation }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_VOLUME'; payload: number }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'CLEAR_STATION' };

const initialState: AudioPlayerState = {
  isPlaying: false,
  currentStation: null,
  volume: 1,
  isLoading: false,
  error: null,
};

function audioPlayerReducer(state: AudioPlayerState, action: AudioPlayerAction): AudioPlayerState {
  switch (action.type) {
    case 'SET_STATION':
      return {
        ...state,
        currentStation: action.payload,
        error: null,
      };
    case 'PLAY':
      return {
        ...state,
        isPlaying: true,
        error: null,
      };
    case 'PAUSE':
      return {
        ...state,
        isPlaying: false,
      };
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };
    case 'SET_VOLUME':
      return {
        ...state,
        volume: action.payload,
      };
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false,
        isPlaying: false,
      };
    case 'CLEAR_STATION':
      return {
        ...state,
        currentStation: null,
        isPlaying: false,
        error: null,
      };
    default:
      return state;
  }
}

interface AudioPlayerContextType {
  state: AudioPlayerState;
  audioElement: HTMLAudioElement | null;
  playStation: (station: RadioStation) => Promise<void>;
  pause: () => void;
  resume: () => void;
  setVolume: (volume: number) => void;
  stopAndClear: () => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined);

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(audioPlayerReducer, initialState);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.crossOrigin = 'anonymous';
    
    const audio = audioRef.current;

    const handleLoadStart = () => dispatch({ type: 'SET_LOADING', payload: true });
    const handleCanPlay = () => dispatch({ type: 'SET_LOADING', payload: false });
    const handlePlay = () => dispatch({ type: 'PLAY' });
    const handlePause = () => dispatch({ type: 'PAUSE' });
    const handleError = () => {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load radio stream' });
    };

    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
      audio.pause();
      audio.src = '';
    };
  }, []);

  // Update audio volume when state changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = state.volume;
    }
  }, [state.volume]);

  const playStation = async (station: RadioStation) => {
    if (!audioRef.current) return;

    try {
      // Batch state updates for better performance
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_STATION', payload: station });

      // Stop current audio
      audioRef.current.pause();
      audioRef.current.currentTime = 0;

      // Set new source
      audioRef.current.src = station.url_resolved || station.url;

      // Start playing audio immediately (non-blocking)
      audioRef.current.play().catch((error) => {
        console.error('Error playing station:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to play radio station' });
      });

      // Click station to update play count (fire and forget - non-blocking)
      RadioAPI.clickStation(station.stationuuid).catch((error) => {
        console.warn('Click tracking failed:', error);
        // Don't dispatch error for tracking failures
      });

    } catch (error) {
      console.error('Error setting up station:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to play radio station' });
    }
  };

  const pause = () => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
    }
  };

  const resume = () => {
    if (audioRef.current && audioRef.current.paused && state.currentStation) {
      audioRef.current.play().catch(() => {
        dispatch({ type: 'SET_ERROR', payload: 'Failed to resume playback' });
      });
    }
  };

  const setVolume = (volume: number) => {
    dispatch({ type: 'SET_VOLUME', payload: Math.max(0, Math.min(1, volume)) });
  };

  const stopAndClear = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = '';
    }
    dispatch({ type: 'CLEAR_STATION' });
  };

  const contextValue: AudioPlayerContextType = {
    state,
    audioElement: audioRef.current,
    playStation,
    pause,
    resume,
    setVolume,
    stopAndClear,
  };

  return (
    <AudioPlayerContext.Provider value={contextValue}>
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext);
  if (context === undefined) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider');
  }
  return context;
} 