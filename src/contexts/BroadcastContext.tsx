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
import { getWebRTCService, resetWebRTCService, WebRTCService } from '../services/webrtcService';

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
  
  // Calls (Twilio)
  activeCalls: Map<string, CallInfo>;
  onAirCall: CallInfo | null;
  twilioDevice: Device | null;
  
  // WebRTC
  webrtcService: WebRTCService | null;
  useWebRTC: boolean;
  webrtcConnected: boolean;
  
  // Actions - Mixer
  initializeMixer: () => Promise<AudioMixerEngine>;
  destroyMixer: () => Promise<void>;
  setVolume: (sourceId: string, volume: number) => void;
  setMuted: (sourceId: string, muted: boolean) => void;
  refreshAudioSources: () => void;
  
  // Actions - Calls (Twilio)
  initializeTwilio: (identity: string) => Promise<Device>;
  destroyTwilioDevice: () => Promise<void>; // Keep for cleanup, but don't use for role switching
  connectToCall: (callId: string, callerName: string, episodeId: string, role?: 'host' | 'screener') => Promise<void>;
  disconnectCall: (callId: string) => Promise<void>;
  setOnAir: (callId: string) => void;
  disconnectCurrentCall: () => Promise<void>;
  
  // Actions - WebRTC (Host)
  initializeWebRTC: () => Promise<WebRTCService>;
  joinLiveRoomWebRTC: (episodeId: string, displayName: string) => Promise<void>;
  leaveRoomWebRTC: () => Promise<void>;
  setUseWebRTC: (enabled: boolean) => void;
  disconnectWebRTC: () => Promise<void>;
  
  // Actions - WebRTC (Screener)
  joinScreeningRoomWebRTC: (episodeId: string, callId: string, displayName: string) => Promise<void>;
}

const BroadcastContext = createContext<BroadcastContextType | null>(null);

export function BroadcastProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BroadcastState>(() => {
    // Try to restore state from sessionStorage on mount
    try {
      const savedState = sessionStorage.getItem('broadcastState');
      if (savedState) {
        const parsed = JSON.parse(savedState);
        // Convert startTime back to Date if it exists
        if (parsed.startTime) {
          parsed.startTime = new Date(parsed.startTime);
        }
        console.log('🔄 [CONTEXT] Restored state from sessionStorage:', parsed);
        return parsed;
      }
    } catch (e) {
      console.warn('⚠️ [CONTEXT] Could not restore state from sessionStorage:', e);
    }
    
    return {
      isLive: false,
      linesOpen: false,
      episodeId: null,
      showId: null,
      showName: '',
      startTime: null,
      selectedShow: null
    };
  });

  const [audioSources, setAudioSources] = useState<AudioSource[]>([]);
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [mixer, setMixer] = useState<AudioMixerEngine | null>(null);
  const [encoder, setEncoder] = useState<StreamEncoder | null>(null);
  
  // Call management (Twilio)
  const [activeCalls, setActiveCalls] = useState<Map<string, CallInfo>>(new Map());
  const [onAirCall, setOnAirCallState] = useState<CallInfo | null>(null);
  const [twilioDevice, setTwilioDevice] = useState<Device | null>(null);
  const [duration, setDuration] = useState('00:00:00');
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // WebRTC state
  const [webrtcService, setWebrtcService] = useState<WebRTCService | null>(null);
  const [useWebRTC, setUseWebRTC] = useState<boolean>(false);
  const [webrtcConnected, setWebrtcConnected] = useState<boolean>(false);
  
  // Wrapper for setState with logging and persistence
  const setStateWithLogging = (newState: BroadcastState) => {
    console.log('📝 [CONTEXT] State update:', { 
      from: { isLive: state.isLive, episodeId: state.episodeId },
      to: { isLive: newState.isLive, episodeId: newState.episodeId }
    });
    setState(newState);
    
    // Save to sessionStorage for recovery after accidental refreshes
    try {
      sessionStorage.setItem('broadcastState', JSON.stringify(newState));
      console.log('💾 [CONTEXT] State saved to sessionStorage');
    } catch (e) {
      console.warn('⚠️ [CONTEXT] Could not save state to sessionStorage:', e);
    }
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
    // Reuse existing device if available (one device per session)
    if (twilioDevice) {
      console.log('⚠️ [TWILIO] Device already initialized - reusing for all roles');
      return twilioDevice;
    }

    try {
      console.log('📞 [TWILIO] Initializing session device');
      
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

  /**
   * Destroy Twilio device completely (for clean slate when switching roles)
   */
  const destroyTwilioDevice = async () => {
    if (!twilioDevice) {
      console.log('ℹ️ [TWILIO] No device to destroy');
      return;
    }

    console.log('🔥 [TWILIO] Destroying device for clean slate...');
    
    try {
      // Disconnect all active calls first
      const calls = Array.from(activeCalls.values());
      for (const call of calls) {
        if (call.twilioCall) {
          try {
            call.twilioCall.disconnect();
          } catch (e) {
            console.warn('⚠️ [TWILIO] Error disconnecting call:', e);
          }
        }
      }
      
      // Destroy device
      twilioDevice.destroy();
      console.log('✅ [TWILIO] Device.destroy() called successfully');
    } catch (error) {
      console.error('❌ [TWILIO] Error during device destruction:', error);
      // Continue with cleanup even if destroy fails
    }
    
    // Always clear state regardless of destroy success
    setTwilioDevice(null);
    setActiveCalls(new Map());
    setOnAirCallState(null);
    
    console.log('✅ [TWILIO] Device state cleared - ready for fresh start');
  };

  /**
   * Initialize WebRTC service (for WebRTC-based call management)
   */
  const initializeWebRTC = async (): Promise<WebRTCService> => {
    if (webrtcService && webrtcService.isConnected()) {
      console.log('ℹ️ [WEBRTC] Already connected');
      return webrtcService;
    }

    // Get LiveKit URL from environment
    // Fallback to hardcoded URL if build variable not set
    const livekitUrl = import.meta.env.VITE_LIVEKIT_WS_URL || 'wss://audioroad-broadcast-st6f3yzp.livekit.cloud';
    
    if (!livekitUrl) {
      throw new Error('VITE_LIVEKIT_WS_URL not configured');
    }
    
    console.log('🔌 [WEBRTC] LiveKit URL:', livekitUrl);

    console.log('🔌 [WEBRTC] Initializing LiveKit WebRTC service...');

    try {
      const service = getWebRTCService({
        livekitUrl
      });

      // Set up event listeners
      service.on('connected', () => {
        console.log('✅ [WEBRTC] Connected to LiveKit Cloud');
        setWebrtcConnected(true);
      });

      service.on('disconnected', () => {
        console.log('📴 [WEBRTC] Disconnected from LiveKit Cloud');
        setWebrtcConnected(false);
      });

      service.on('reconnected', () => {
        console.log('🔄 [WEBRTC] Reconnected to LiveKit Cloud');
        setWebrtcConnected(true);
      });

      service.on('connection-failed', () => {
        console.error('❌ [WEBRTC] Connection failed');
        setWebrtcConnected(false);
      });

      service.on('local-stream', () => {
        console.log('🎤 [WEBRTC] Local stream ready');
        // Local stream is managed by WebRTC service
      });

      service.on('remote-stream', (stream: MediaStream) => {
        console.log('📥 [WEBRTC] Remote stream received');
        // Play remote audio directly (participants in room)
        // Note: This plays through default audio output, not the mixer
        // The mixer is for the broadcast stream, this is for host monitoring
        const audio = new Audio();
        audio.srcObject = stream;
        audio.play().catch(e => console.error('Failed to play remote stream:', e));
      });

      await service.initialize();
      setWebrtcService(service);
      
      console.log('✅ [WEBRTC] Service initialized');
      return service;

    } catch (error) {
      console.error('❌ [WEBRTC] Failed to initialize:', error);
      throw error;
    }
  };

  /**
   * Join live room via WebRTC (for host)
   */
  const joinLiveRoomWebRTC = async (episodeId: string, displayName: string): Promise<void> => {
    if (!webrtcService || !webrtcService.isConnected()) {
      throw new Error('WebRTC service not initialized');
    }

    console.log(`🔌 [WEBRTC] Joining live room for episode: ${episodeId}`);

    try {
      // Get local microphone stream
      await webrtcService.setLocalAudioStream();
      
      // Join live room
      await webrtcService.joinLiveRoom(episodeId, displayName);

      // Note: Host mic goes directly to Janus via WebRTC
      // It doesn't need to go through the mixer here
      // The mixer is for the final broadcast output

      console.log('✅ [WEBRTC] Joined live room');

    } catch (error) {
      console.error('❌ [WEBRTC] Failed to join live room:', error);
      throw error;
    }
  };

  /**
   * Join screening room via WebRTC (for screener)
   */
  const joinScreeningRoomWebRTC = async (
    episodeId: string,
    callId: string,
    displayName: string
  ): Promise<void> => {
    if (!webrtcService || !webrtcService.isConnected()) {
      throw new Error('WebRTC service not initialized');
    }

    console.log(`🔌 [WEBRTC] Joining screening room: episode=${episodeId}, call=${callId}`);

    try {
      // Get local microphone stream
      await webrtcService.setLocalAudioStream();
      
      // Join screening room
      await webrtcService.joinScreeningRoom(episodeId, callId, displayName);

      // Note: Screener mic goes directly to Janus via WebRTC
      // Remote stream (caller) will be played via 'remote-stream' event handler

      console.log('✅ [WEBRTC] Joined screening room');

    } catch (error) {
      console.error('❌ [WEBRTC] Failed to join screening room:', error);
      throw error;
    }
  };

  /**
   * Leave current WebRTC room
   */
  const leaveRoomWebRTC = async (): Promise<void> => {
    if (!webrtcService) {
      return;
    }

    console.log('📴 [WEBRTC] Leaving room...');

    try {
      await webrtcService.leaveRoom();
      
      // WebRTC streams are managed by the WebRTC service
      // No mixer cleanup needed

      console.log('✅ [WEBRTC] Left room');

    } catch (error) {
      console.error('❌ [WEBRTC] Failed to leave room:', error);
      throw error;
    }
  };

  /**
   * Toggle WebRTC mode
   */
  const setUseWebRTCFunc = (enabled: boolean) => {
    console.log(`🔀 [WEBRTC] Setting useWebRTC: ${enabled}`);
    setUseWebRTC(enabled);
    
    // Save preference
    try {
      localStorage.setItem('useWebRTC', enabled.toString());
    } catch (e) {
      console.warn('⚠️ [WEBRTC] Could not save preference:', e);
    }
  };

  /**
   * Disconnect from WebRTC
   */
  const disconnectWebRTC = async (): Promise<void> => {
    console.log('🔌 [WEBRTC] Disconnecting...');

    if (webrtcService) {
      try {
        await webrtcService.disconnect();
      } catch (error) {
        console.error('❌ [WEBRTC] Error during disconnect:', error);
      }
    }

    resetWebRTCService();
    setWebrtcService(null);
    setWebrtcConnected(false);

    console.log('✅ [WEBRTC] Disconnected');
  };

  // Load WebRTC preference on mount
  useEffect(() => {
    try {
      const savedPreference = localStorage.getItem('useWebRTC');
      if (savedPreference) {
        setUseWebRTC(savedPreference === 'true');
      }
    } catch (e) {
      console.warn('⚠️ [WEBRTC] Could not load preference:', e);
    }
  }, []);

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
    webrtcService,
    useWebRTC,
    webrtcConnected,
    initializeMixer,
    destroyMixer,
    setVolume: setVolumeFunc,
    setMuted: setMutedFunc,
    refreshAudioSources,
    initializeTwilio,
    destroyTwilioDevice,
    connectToCall,
    disconnectCall,
    setOnAir,
    disconnectCurrentCall,
    initializeWebRTC,
    joinLiveRoomWebRTC,
    joinScreeningRoomWebRTC,
    leaveRoomWebRTC,
    setUseWebRTC: setUseWebRTCFunc,
    disconnectWebRTC
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

