'use client';

import React, { createContext, useContext, useReducer, useRef, useEffect, ReactNode } from 'react';
import { AudioPlayerState, RadioStation } from '@/types/radio';
import { RadioAPI } from '@/utils/radioApi';

type AudioPlayerAction =
  | { type: 'SET_STATION'; payload: RadioStation }
  | { type: 'PLAY'; payload?: RadioStation }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
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
        isLoading: true,
      };
    case 'PLAY':
      return {
        ...state,
        isPlaying: true,
        currentStation: action.payload || state.currentStation,
        error: null,
        isLoading: false,
      };
    case 'PAUSE':
      return { ...state, isPlaying: false };
    case 'RESUME':
      return { ...state, isPlaying: true, error: null };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_VOLUME':
      return { ...state, volume: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false, isPlaying: false };
    case 'CLEAR_STATION':
      return { ...state, currentStation: null, isPlaying: false, error: null, isLoading: false };
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

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(audioPlayerReducer, initialState);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Ref to track if we should ignore audio events (e.g. during stop)
  const ignoreEventsRef = useRef(false);

  // Initialize audio element
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.preload = 'none';
      audioRef.current = audio;

      const handleLoadStart = () => {
         if (!ignoreEventsRef.current) dispatch({ type: 'SET_LOADING', payload: true });
      };
      const handleCanPlay = () => {
         if (!ignoreEventsRef.current) dispatch({ type: 'SET_LOADING', payload: false });
      };
      const handlePlaying = () => {
         if (!ignoreEventsRef.current) dispatch({ type: 'RESUME' });
      };
      const handlePause = () => {
         if (!ignoreEventsRef.current) dispatch({ type: 'PAUSE' });
      };
      const handleError = () => {
        if (ignoreEventsRef.current) return;
        console.error('Audio Error:', audio.error);
        dispatch({ type: 'SET_ERROR', payload: 'Stream offline' });
      };
      const handleWaiting = () => {
         if (!ignoreEventsRef.current) dispatch({ type: 'SET_LOADING', payload: true });
      };

      audio.addEventListener('loadstart', handleLoadStart);
      audio.addEventListener('waiting', handleWaiting);
      audio.addEventListener('canplay', handleCanPlay);
      audio.addEventListener('playing', handlePlaying);
      audio.addEventListener('pause', handlePause);
      audio.addEventListener('error', handleError);

      return () => {
        audio.removeEventListener('loadstart', handleLoadStart);
        audio.removeEventListener('waiting', handleWaiting);
        audio.removeEventListener('canplay', handleCanPlay);
        audio.removeEventListener('playing', handlePlaying);
        audio.removeEventListener('pause', handlePause);
        audio.removeEventListener('error', handleError);
        audio.pause();
        audio.src = '';
      };
    }
  }, []);

  // Sync volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = state.volume;
    }
  }, [state.volume]);

  const playStation = async (station: RadioStation) => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      ignoreEventsRef.current = false;
      
      // Optimistic update
      dispatch({ type: 'SET_STATION', payload: station });
      audio.pause();

      let streamUrl = station.url_resolved || station.url;

      // Fetch stream URL if missing (lazy loading)
      if (!streamUrl) {
        console.log('Fetching stream details for:', station.stationuuid);
        const fullStation = await RadioAPI.getStationById(station.stationuuid);
        
        if (!fullStation || (!fullStation.url_resolved && !fullStation.url)) {
          throw new Error('Stream URL not found');
        }

        streamUrl = fullStation.url_resolved || fullStation.url;
        // Update station in state with full details
        dispatch({ type: 'SET_STATION', payload: { ...station, ...fullStation } });
      }

      audio.src = streamUrl;
      audio.load();
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          if (err.name !== 'AbortError' && !ignoreEventsRef.current) {
             console.error('Playback failed:', err);
             dispatch({ type: 'SET_ERROR', payload: 'Playback failed' });
          }
        });
      }

      // Fire-and-forget analytics
      RadioAPI.clickStation(station.stationuuid).catch(() => {});

    } catch (err) {
      console.error('Play error:', err);
      dispatch({ type: 'SET_ERROR', payload: 'Station unavailable' });
    }
  };

  const pause = () => audioRef.current?.pause();
  
  const resume = () => {
    if (audioRef.current && state.currentStation) {
      audioRef.current.play().catch(() => {});
    }
  };

  const setVolume = (vol: number) => {
    dispatch({ type: 'SET_VOLUME', payload: Math.max(0, Math.min(1, vol)) });
  };

  const stopAndClear = () => {
    ignoreEventsRef.current = true; // SILENCE EVENTS!
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = ''; // Detach stream
      audioRef.current.load();   // Force reset
    }
    dispatch({ type: 'CLEAR_STATION' });
  };

  return (
    <AudioPlayerContext.Provider value={{ state, audioElement: audioRef.current, playStation, pause, resume, setVolume, stopAndClear }}>
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
