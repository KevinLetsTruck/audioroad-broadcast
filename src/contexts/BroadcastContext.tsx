/**
 * Broadcast Context
 * 
 * Shares broadcast state and mixer across all pages
 * Ensures mixer persists when navigating between pages
 */

import { createContext, useContext, useState, ReactNode } from 'react';
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
  const [mixer, setMixer] = useState<AudioMixerEngine | null>(null);
  const [encoder, setEncoder] = useState<StreamEncoder | null>(null);
  
  // Wrapper for setState with logging
  const setStateWithLogging = (newState: BroadcastState) => {
    console.log('📝 [CONTEXT] State update:', { 
      from: { isLive: state.isLive, episodeId: state.episodeId },
      to: { isLive: newState.isLive, episodeId: newState.episodeId }
    });
    setState(newState);
  };

  const initializeMixer = async () => {
    if (mixer) {
      console.log('⚠️ [CONTEXT] Mixer already initialized');
      return; // Already initialized
    }

    console.log('🎚️ [CONTEXT] Creating new mixer...');
    const newMixer = new AudioMixerEngine({
      sampleRate: 48000,
      bitrate: 256,
      outputChannels: 2
    });

    await newMixer.initialize();
    setMixer(newMixer); // Use state instead of ref!

    // Set up level monitoring
    newMixer.onLevelUpdate((sourceId, level) => {
      setLevels(prev => ({ ...prev, [sourceId]: level }));
    });

    // Update sources
    setAudioSources(newMixer.getSources());

    console.log('✅ [CONTEXT] Global mixer initialized and stored in state');
  };

  const destroyMixer = async () => {
    console.log('🧹 [CONTEXT] destroyMixer called');
    console.trace('Destroy mixer called from:'); // Show stack trace
    
    if (mixer) {
      await mixer.destroy();
      setMixer(null);
    }
    if (encoder) {
      await encoder.destroy();
      setEncoder(null);
    }
    setAudioSources([]);
    setLevels({});
    console.log('✅ [CONTEXT] Mixer destroyed');
  };

  const setVolumeFunc = (sourceId: string, volume: number) => {
    if (!mixer) return;
    mixer.setVolume(sourceId, volume);
    setAudioSources(mixer.getSources());
  };

  const setMutedFunc = (sourceId: string, muted: boolean) => {
    if (!mixer) return;
    mixer.setMuted(sourceId, muted);
    setAudioSources(mixer.getSources());
  };

  const value: BroadcastContextType = {
    state,
    setState: setStateWithLogging,
    mixer,
    encoder,
    audioSources,
    levels,
    initializeMixer,
    destroyMixer,
    setVolume: setVolumeFunc,
    setMuted: setMutedFunc
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

