/**
 * Broadcast Context
 * 
 * Shares broadcast state and mixer across all pages
 * Ensures mixer persists when navigating between pages
 */

import { createContext, useContext, useState, useRef, ReactNode } from 'react';
import { AudioMixerEngine, AudioSource } from '../services/audioMixerEngine';
import { StreamEncoder } from '../services/streamEncoder';

interface BroadcastState {
  isLive: boolean;
  episodeId: string | null;
  showId: string | null;
  showName: string;
  startTime: Date | null;
  selectedShow: any | null;
}

interface BroadcastContextType {
  // State
  state: BroadcastState;
  setState: (state: BroadcastState) => void;
  
  // Mixer
  mixer: AudioMixerEngine | null;
  encoder: StreamEncoder | null;
  audioSources: AudioSource[];
  levels: Record<string, number>;
  
  // Actions
  initializeMixer: () => Promise<void>;
  destroyMixer: () => Promise<void>;
  setVolume: (sourceId: string, volume: number) => void;
  setMuted: (sourceId: string, muted: boolean) => void;
}

const BroadcastContext = createContext<BroadcastContextType | null>(null);

export function BroadcastProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BroadcastState>({
    isLive: false,
    episodeId: null,
    showId: null,
    showName: '',
    startTime: null,
    selectedShow: null
  });

  const [audioSources, setAudioSources] = useState<AudioSource[]>([]);
  const [levels, setLevels] = useState<Record<string, number>>({});

  const mixerRef = useRef<AudioMixerEngine | null>(null);
  const encoderRef = useRef<StreamEncoder | null>(null);

  const initializeMixer = async () => {
    if (mixerRef.current) return; // Already initialized

    const mixer = new AudioMixerEngine({
      sampleRate: 48000,
      bitrate: 256,
      outputChannels: 2
    });

    await mixer.initialize();
    mixerRef.current = mixer;

    // Set up level monitoring
    mixer.onLevelUpdate((sourceId, level) => {
      setLevels(prev => ({ ...prev, [sourceId]: level }));
    });

    // Update sources
    setAudioSources(mixer.getSources());

    console.log('✅ Global mixer initialized');
  };

  const destroyMixer = async () => {
    if (mixerRef.current) {
      await mixerRef.current.destroy();
      mixerRef.current = null;
    }
    if (encoderRef.current) {
      await encoderRef.current.destroy();
      encoderRef.current = null;
    }
    setAudioSources([]);
    setLevels({});
  };

  const setVolume = (sourceId: string, volume: number) => {
    if (!mixerRef.current) return;
    mixerRef.current.setVolume(sourceId, volume);
    setAudioSources(mixerRef.current.getSources());
  };

  const setMuted = (sourceId: string, muted: boolean) => {
    if (!mixerRef.current) return;
    mixerRef.current.setMuted(sourceId, muted);
    setAudioSources(mixerRef.current.getSources());
  };

  const value: BroadcastContextType = {
    state,
    setState,
    mixer: mixerRef.current,
    encoder: encoderRef.current,
    audioSources,
    levels,
    initializeMixer,
    destroyMixer,
    setVolume,
    setMuted
  };

  return (
    <BroadcastContext.Provider value={value}>
      {children}
    </BroadcastContext.Provider>
  );
}

export function useBroadcast() {
  const context = useContext(BroadcastContext);
  if (!context) {
    throw new Error('useBroadcast must be used within BroadcastProvider');
  }
  return context;
}

