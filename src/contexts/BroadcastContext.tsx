/**
 * Broadcast Context
 * 
 * Shares broadcast state and mixer across all pages
 * Ensures mixer persists when navigating between pages
 */

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { Device, Call } from '@twilio/voice-sdk';
import { AudioMixerEngine, AudioSource } from '../services/audioMixerEngine';
import { StreamEncoder } from '../services/streamEncoder';

interface BroadcastState {
  isLive: boolean;
  linesOpen: boolean; // Frontend tracking only
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
  topic?: string;
  twilioCall: Call | null;
  audioStream: MediaStream | null;
  isOnAir: boolean;
  connectedAt: Date;
}

interface BroadcastContextType {
  // State
  state: BroadcastState;
  setState: (state: BroadcastState) => void;
  duration: string; // Global timer
  
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
  refreshAudioSources: () => void;
  
  // Actions - Calls
  initializeTwilio: (identity: string) => Promise<void>;
  connectToCall: (callId: string, callerName: string, episodeId: string, role?: 'host' | 'screener') => Promise<void>;
  disconnectCall: (callId: string) => Promise<void>;
  setOnAir: (callId: string) => void;
  disconnectCurrentCall: () => Promise<void>;
}

const BroadcastContext = createContext<BroadcastContextType | null>(null);

export function BroadcastProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BroadcastState>({
    isLive: false,
    linesOpen: false,
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
  const [duration, setDuration] = useState('00:00:00');
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Wrapper for setState with logging
  const setStateWithLogging = (newState: BroadcastState) => {
    console.log('📝 [CONTEXT] State update:', { 
      from: { isLive: state.isLive, episodeId: state.episodeId },
      to: { isLive: newState.isLive, episodeId: newState.episodeId }
    });
    setState(newState);
  };

  /**
   * Duration timer - runs globally when live
   */
  useEffect(() => {
    if (state.isLive && state.startTime) {
      console.log('⏱️ [CONTEXT] Starting global duration timer');
      
      // Clear any existing timer
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }
      
      // Start new timer
      durationTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - state.startTime!.getTime();
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        
        const formatted = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        setDuration(formatted);
      }, 1000);
      
      console.log('✅ [CONTEXT] Global timer running');
    } else {
      // Stop timer when not live
      if (durationTimerRef.current) {
        console.log('⏹️ [CONTEXT] Stopping duration timer');
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
      setDuration('00:00:00');
    }
    
    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }
    };
  }, [state.isLive, state.startTime]);

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
      console.log('🎤 [CONTEXT] Destroying mixer - this will stop all audio sources including microphone');
      await mixer.destroy();
      setMixer(null);
      console.log('✅ [CONTEXT] Mixer destroyed - microphone should now be OFF');
    }
    if (encoder) {
      await encoder.destroy();
      setEncoder(null);
    }
    setAudioSources([]);
    setLevels({});
    console.log('✅ [CONTEXT] All audio cleanup complete - mic indicator should turn off');
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
   * Refresh audio sources from mixer (force update)
   */
  const refreshAudioSources = () => {
    if (mixer) {
      const sources = mixer.getSources();
      console.log('🔄 [CONTEXT] Refreshing audio sources:', sources.length);
      setAudioSources([...sources]); // Create new array to trigger React update
    }
  };

  /**
   * Initialize Twilio Device (global, persists across pages)
   */
  const initializeTwilio = async (identity: string): Promise<Device> => {
    if (twilioDevice) {
      console.log('⚠️ [TWILIO] Device already initialized - returning existing');
      return twilioDevice;
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

      // Silent sounds prevent annoying beeps (worked perfectly on Oct 31!)
      const silentSound = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
      const device = new Device(token, {
        enableImprovedSignalingErrorPrecision: true,
        logLevel: 'error',
        // Disable all Twilio device sounds - prevents beeps on connect/disconnect
        sounds: {
          disconnect: silentSound,
          incoming: silentSound,
          outgoing: silentSound
        }
      });
      
      console.log('🎤 [CONTEXT] Twilio Device created (browser handles noise suppression automatically)');

      device.on('registered', () => {
        console.log('✅ [TWILIO] Device registered');
      });

      device.on('error', (error) => {
        console.error('❌ [TWILIO] Device error:', error);
      });

      await device.register();
      setTwilioDevice(device);
      console.log('✅ [TWILIO] Device initialized globally');
      
      // Return the device so caller can use it immediately
      return device;
    } catch (error) {
      console.error('❌ [TWILIO] Failed to initialize:', error);
      throw error;
    }
  };

  /**
   * Connect to a call (host = adds to mixer, screener = just audio)
   */
  const connectToCall = async (callId: string, callerName: string, episodeId: string, role: 'host' | 'screener' = 'host') => {
    if (!twilioDevice) {
      throw new Error('Twilio device not initialized');
    }

    try {
      console.log(`📞 [CALL] Connecting as ${role}:`, callId, callerName);

      // Simple - Twilio handles audio natively (worked perfectly on Oct 31!)
      const call = await twilioDevice.connect({
        params: { callId, episodeId, role }
      });

      // Wait for call to connect
      await new Promise((resolve, reject) => {
        call.on('accept', () => resolve(true));
        call.on('error', reject);
        setTimeout(() => reject(new Error('Call timeout')), 10000);
      });

      console.log(`✅ [CALL] Twilio call connected (role: ${role})`);

      // Store call info (no custom audio stream handling)
      const callInfo: CallInfo = {
        id: `call-${callId}`,
        callId,
        callerName,
        twilioCall: call,
        audioStream: null, // Twilio handles natively
        isOnAir: role === 'host',
        connectedAt: new Date()
      };

      setActiveCalls(prev => new Map(prev).set(callId, callInfo));
      
      if (role === 'host') {
        setOnAirCallState(callInfo);
      }

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

  /**
   * Disconnect the most recent active call (for screener)
   */
  const disconnectCurrentCall = async () => {
    // Get the most recent call
    const calls = Array.from(activeCalls.values());
    if (calls.length === 0) {
      console.log('⚠️ [CALL] No active calls to disconnect');
      return;
    }

    const mostRecent = calls[calls.length - 1];
    await disconnectCall(mostRecent.callId);
  };

  const value: BroadcastContextType = {
    state,
    setState: setStateWithLogging,
    duration,
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
    refreshAudioSources,
    initializeTwilio,
    connectToCall,
    disconnectCall,
    setOnAir,
    disconnectCurrentCall
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

