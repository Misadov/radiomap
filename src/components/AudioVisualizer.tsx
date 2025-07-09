'use client';

import { useEffect, useRef, useState } from 'react';

interface AudioVisualizerProps {
  audioElement: HTMLAudioElement | null;
  isPlaying: boolean;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ audioElement, isPlaying }) => {
  const [audioData, setAudioData] = useState<number[]>(new Array(24).fill(0));
  const animationRef = useRef<number>();
  const analyserRef = useRef<AnalyserNode>();
  const dataArrayRef = useRef<Uint8Array>();
  const audioContextRef = useRef<AudioContext>();
  const sourceRef = useRef<MediaElementAudioSourceNode>();

  useEffect(() => {
    if (!audioElement || !isPlaying) {
      // Reset to zero when not playing
      setAudioData(new Array(24).fill(0));
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    // Set up Web Audio API
    const setupAudioAnalysis = async () => {
      try {
        // Create or reuse audio context
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }

        const audioContext = audioContextRef.current;

        // Resume context if suspended
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }

        // Create or reuse source
        if (!sourceRef.current) {
          sourceRef.current = audioContext.createMediaElementSource(audioElement);
        }

        // Create analyser
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256; // Higher resolution for 24 bars
        analyser.smoothingTimeConstant = 0.1; // Minimal smoothing for max responsiveness
        
        // Connect: source -> analyser -> destination
        sourceRef.current.connect(analyser);
        analyser.connect(audioContext.destination);

        analyserRef.current = analyser;
        dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

        // Start animation loop
        updateVisualizerData();
      } catch (error) {
        console.log('Audio analysis setup failed (CORS or other restriction):', error);
        // Fallback to fake but realistic-looking animation
        useFallbackAnimation();
      }
    };

    setupAudioAnalysis();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [audioElement, isPlaying]);

  const updateVisualizerData = () => {
    if (!analyserRef.current || !dataArrayRef.current) return;

    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    
    // Map frequency data to 24 bars with logarithmic distribution
    const bars = [];
    const dataLength = dataArrayRef.current.length;
    
    for (let i = 0; i < 24; i++) {
      // Professional bass-focused distribution - more bars for bass frequencies
      let startPercent, endPercent;
      
      if (i < 8) {
        // First 8 bars cover bass (0-25% of spectrum) with high resolution
        startPercent = (i / 8) * 0.25;
        endPercent = ((i + 1) / 8) * 0.25;
      } else if (i < 16) {
        // Next 8 bars cover mids (25-65% of spectrum)
        const midIndex = i - 8;
        startPercent = 0.25 + (midIndex / 8) * 0.4;
        endPercent = 0.25 + ((midIndex + 1) / 8) * 0.4;
      } else {
        // Last 8 bars cover treble (65-100% of spectrum)
        const highIndex = i - 16;
        startPercent = 0.65 + (highIndex / 8) * 0.35;
        endPercent = 0.65 + ((highIndex + 1) / 8) * 0.35;
      }
      
      const start = Math.floor(startPercent * dataLength);
      const end = Math.floor(endPercent * dataLength);
      let max = 0;
      let sum = 0;
      let count = 0;
      
      // Get both average and peak for more dynamic response
      for (let j = start; j < end && j < dataLength; j++) {
        const value = dataArrayRef.current[j];
        sum += value;
        max = Math.max(max, value);
        count++;
      }
      
      const average = count > 0 ? sum / count : 0;
      const peak = max;
      
      // Different processing for bass, mid, treble like professional visualizers
      const combined = (average * 0.3 + peak * 0.7) / 255;
      
      let scaled, baseline, maxScale;
      
      if (i < 8) {
        // Bass frequencies - more responsive but controlled
        scaled = Math.pow(combined, 0.4); // More aggressive for bass response
        baseline = 0.08; // Higher baseline for bass presence
        maxScale = 0.9; // Allow bass to go higher
      } else if (i < 16) {
        // Mid frequencies - balanced
        scaled = Math.pow(combined, 0.5);
        baseline = 0.05;
        maxScale = 0.8;
      } else {
        // Treble frequencies - more sensitive to detail
        scaled = Math.pow(combined, 0.6); // Less aggressive, more detail
        baseline = 0.03;
        maxScale = 0.75;
      }
      
      const final = Math.max(baseline, Math.min(maxScale, scaled));
      
      bars.push(final);
    }

    setAudioData(bars);
    animationRef.current = requestAnimationFrame(updateVisualizerData);
  };

  const useFallbackAnimation = () => {
    // Dynamic fallback with punchy, random behavior
    let lastUpdate = 0;
    const updateInterval = 30; // Ultra fast updates for maximum responsiveness
    
    const updateFallback = (currentTime: number) => {
      if (!isPlaying) return;
      
      if (currentTime - lastUpdate >= updateInterval) {
        const bars = audioData.map((_, index) => {
          const time = currentTime * 0.001;
          
          // Create patterns that match the bass-focused approach
          let fastOscillation, slowOscillation, randomSpike, baseline, maxScale;
          
          if (index < 8) {
            // Bass - more prominent movement
            fastOscillation = Math.sin(time * (2 + index * 0.5)) * 0.5;
            slowOscillation = Math.sin(time * (0.3 + index * 0.1)) * 0.4;
            randomSpike = Math.random() > 0.8 ? Math.random() * 0.5 : 0;
            baseline = 0.08;
            maxScale = 0.9;
          } else if (index < 16) {
            // Mid - balanced
            fastOscillation = Math.sin(time * (3 + index * 1)) * 0.3;
            slowOscillation = Math.sin(time * (0.5 + index * 0.2)) * 0.3;
            randomSpike = Math.random() > 0.85 ? Math.random() * 0.3 : 0;
            baseline = 0.05;
            maxScale = 0.8;
          } else {
            // Treble - more detailed, less prominent
            fastOscillation = Math.sin(time * (4 + index * 2)) * 0.2;
            slowOscillation = Math.sin(time * (0.7 + index * 0.3)) * 0.2;
            randomSpike = Math.random() > 0.9 ? Math.random() * 0.2 : 0;
            baseline = 0.03;
            maxScale = 0.75;
          }
          
          // Combine all elements
          const value = baseline + fastOscillation + slowOscillation + randomSpike;
          
          return Math.max(baseline, Math.min(maxScale, value));
        });
        
        setAudioData(bars);
        lastUpdate = currentTime;
      }
      
      animationRef.current = requestAnimationFrame(updateFallback);
    };
    
    animationRef.current = requestAnimationFrame(updateFallback);
  };

  // Calculate bar heights based on audio data
  const getBarHeight = (value: number, index: number) => {
    // Different height ranges for bass-focused visualizer
    let minHeight, maxHeight;
    
    if (index < 8) {
      // Bass bars - taller range for prominence
      minHeight = 6;
      maxHeight = 42;
    } else if (index < 16) {
      // Mid bars - medium range
      minHeight = 4;
      maxHeight = 36;
    } else {
      // Treble bars - smaller but detailed
      minHeight = 3;
      maxHeight = 28;
    }
    
    const height = minHeight + (maxHeight - minHeight) * value;
    return Math.round(height);
  };

  // Hidden for now
  return null;
};

export default AudioVisualizer; 