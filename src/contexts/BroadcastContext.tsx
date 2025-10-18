/**
 * Broadcast Context
 * 
 * Shares broadcast state and mixer across all pages
 * Ensures mixer persists when navigating between pages
 */

import { createContext, useContext, useState, ReactNode } from 'react';
import { Device, Call } from '@twilio/voice-sdk';
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

interface CallInfo {
  id: string;
  callId: string;
  callerName: string;
  twilioCall: Call | null;
  audioStream: MediaStream | null;
  isOnAir: boolean;
  connectedAt: Date;
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
  
  // Calls
  activeCalls: Map<string, CallInfo>;
  onAirCall: CallInfo | null;
  twilioDevice: Device | null;
  
  // Actions - Mixer
  initializeMixer: () => Promise<AudioMixerEngine>;
  destroyMixer: () => Promise<void>;
  setVolume: (sourceId: string, volume: number) => void;
  setMuted: (sourceId: string, muted: boolean) => void;
  
  // Actions - Calls
  initializeTwilio: (identity: string) => Promise<void>;
  connectToCall: (callId: string, callerName: string, episodeId: string) => Promise<void>;
  disconnectCall: (callId: string) => Promise<void>;
  setOnAir: (callId: string) => void;
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
  
  // Call management
  const [activeCalls, setActiveCalls] = useState<Map<string, CallInfo>>(new Map());
  const [onAirCall, setOnAirCallState] = useState<CallInfo | null>(null);
  const [twilioDevice, setTwilioDevice] = useState<Device | null>(null);
  
  // Wrapper for setState with logging
  const setStateWithLogging = (newState: BroadcastState) => {
    console.log('📝 [CONTEXT] State update:', { 
      from: { isLive: state.isLive, episodeId: state.episodeId },
      to: { isLive: newState.isLive, episodeId: newState.episodeId }
    });
    setState(newState);
  };

  const initializeMixer = async (): Promise<AudioMixerEngine> => {
    if (mixer) {
      console.log('⚠️ [CONTEXT] Mixer already initialized, returning existing');
      return mixer; // Already initialized
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
    return newMixer; // Return the mixer instance!
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

  /**
   * Initialize Twilio Device (global, persists across pages)
   */
  const initializeTwilio = async (identity: string) => {
    if (twilioDevice) {
      console.log('⚠️ [TWILIO] Device already initialized');
      return;
    }

    try {
      console.log('📞 [TWILIO] Initializing device for:', identity);
      
      // Get token from backend
      const response = await fetch('/api/twilio/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity })
      });

      if (!response.ok) {
        throw new Error('Failed to get Twilio token');
      }

      const { token } = await response.json();

      // Create device
      const device = new Device(token, {
        enableImprovedSignalingErrorPrecision: true,
        logLevel: 'error'
      });

      device.on('registered', () => {
        console.log('✅ [TWILIO] Device registered');
      });

      device.on('error', (error) => {
        console.error('❌ [TWILIO] Device error:', error);
      });

      await device.register();
      setTwilioDevice(device);
      console.log('✅ [TWILIO] Device initialized globally');
    } catch (error) {
      console.error('❌ [TWILIO] Failed to initialize:', error);
      throw error;
    }
  };

  /**
   * Connect to a call and add to mixer
   */
  const connectToCall = async (callId: string, callerName: string, episodeId: string) => {
    if (!twilioDevice) {
      throw new Error('Twilio device not initialized');
    }

    try {
      console.log('📞 [CALL] Connecting to call:', callId, callerName);

      // Make Twilio call
      const call = await twilioDevice.connect({
        params: { callId, episodeId, role: 'host' }
      });

      // Wait for call to connect
      await new Promise((resolve, reject) => {
        call.on('accept', () => resolve(true));
        call.on('error', reject);
        setTimeout(() => reject(new Error('Call timeout')), 10000);
      });

      console.log('✅ [CALL] Twilio call connected');

      // Get audio stream from call
      // @ts-ignore - Twilio SDK internal API
      const remoteStream = call.getRemoteStream();
      
      if (!remoteStream) {
        console.warn('⚠️ [CALL] No remote stream available');
      }

      // Add to mixer if available
      if (mixer && remoteStream) {
        console.log('🎚️ [CALL] Adding to mixer...');
        mixer.addCallerAudio(callId, callerName, remoteStream);
        console.log('✅ [CALL] Added to mixer');
      }

      // Store call info
      const callInfo: CallInfo = {
        id: `call-${callId}`,
        callId,
        callerName,
        twilioCall: call,
        audioStream: remoteStream || null,
        isOnAir: true,
        connectedAt: new Date()
      };

      setActiveCalls(prev => new Map(prev).set(callId, callInfo));
      setOnAirCallState(callInfo);

      console.log('✅ [CALL] Call fully connected and added to state');

    } catch (error) {
      console.error('❌ [CALL] Failed to connect:', error);
      throw error;
    }
  };

  /**
   * Disconnect a call
   */
  const disconnectCall = async (callId: string) => {
    const callInfo = activeCalls.get(callId);
    if (!callInfo) return;

    console.log('📴 [CALL] Disconnecting call:', callId);

    // Disconnect Twilio call
    if (callInfo.twilioCall) {
      callInfo.twilioCall.disconnect();
    }

    // Remove from mixer
    if (mixer) {
      mixer.removeSource(`caller-${callId}`);
    }

    // Remove from state
    setActiveCalls(prev => {
      const next = new Map(prev);
      next.delete(callId);
      return next;
    });

    if (onAirCall?.callId === callId) {
      setOnAirCallState(null);
    }

    console.log('✅ [CALL] Call disconnected and removed');
  };

  /**
   * Set a call as on-air
   */
  const setOnAir = (callId: string) => {
    const callInfo = activeCalls.get(callId);
    if (callInfo) {
      setOnAirCallState(callInfo);
    }
  };

  const value: BroadcastContextType = {
    state,
    setState: setStateWithLogging,
    mixer,
    encoder,
    audioSources,
    levels,
    activeCalls,
    onAirCall,
    twilioDevice,
    initializeMixer,
    destroyMixer,
    setVolume: setVolumeFunc,
    setMuted: setMutedFunc,
    initializeTwilio,
    connectToCall,
    disconnectCall,
    setOnAir
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

