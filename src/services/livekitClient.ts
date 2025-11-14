/**
 * LiveKit Client (Browser)
 * Connects browser to LiveKit Cloud for WebRTC audio rooms
 * 
 * Much simpler than Janus - LiveKit SDK handles everything!
 */

import { Room, RoomEvent, Track, RemoteTrack, RemoteTrackPublication, LocalParticipant, RemoteParticipant } from 'livekit-client';

export interface LiveKitConfig {
  wsUrl: string;
  token: string;
}

export class LiveKitClient {
  private room: Room | null = null;
  private wsUrl: string;
  private eventCallbacks: Map<string, Function> = new Map();
  private phoneAudioPacketCount: number = 0;

  constructor(wsUrl: string) {
    this.wsUrl = wsUrl;
  }

  /**
   * Connect to LiveKit room
   */
  async connect(token: string): Promise<void> {
    console.log('📡 [LIVEKIT-CLIENT] Connecting to LiveKit...');
    this.room = new Room({
      adaptiveStream: true,
      dynacast: true,
      // Audio-only optimization
      videoCaptureDefaults: {
        resolution: { width: 0, height: 0 }
      }
    });

    // Set up event listeners
    this.setupEventListeners();

    try {
      await this.room.connect(this.wsUrl, token);
      console.log('✅ [LIVEKIT-CLIENT] Connected to room:', this.room.name);
      
      // Proactively resume AudioContext (browser requires user gesture)
      this.resumeAudioContext();
      
      this.emit('connected', { roomName: this.room.name });
    } catch (error) {
      console.error('❌ [LIVEKIT-CLIENT] Connection failed:', error);
      throw error;
    }
  }

  /**
   * Resume AudioContext (must be called after user gesture)
   */
  private async resumeAudioContext(): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: 48000 });
      this.nextPlayTime = this.audioContext.currentTime;
      console.log('🔊 [AUDIO] AudioContext created, sample rate:', this.audioContext.sampleRate);
    }

    if (this.audioContext.state === 'suspended') {
      console.log('🔊 [AUDIO] Resuming suspended AudioContext...');
      try {
        await this.audioContext.resume();
        console.log('✅ [AUDIO] AudioContext resumed, state:', this.audioContext.state);
      } catch (error) {
        console.error('❌ [AUDIO] Failed to resume AudioContext:', error);
      }
    } else {
      console.log('✅ [AUDIO] AudioContext already running, state:', this.audioContext.state);
    }
  }

  /**
   * Set up event listeners for room
   */
  private setupEventListeners(): void {
    if (!this.room) return;

    // Connection state changes
    this.room.on(RoomEvent.Connected, () => {
      console.log('✅ [LIVEKIT-CLIENT] Room connected');
      this.emit('webrtcup');
    });

    this.room.on(RoomEvent.Disconnected, (reason) => {
      console.log('📴 [LIVEKIT-CLIENT] Room disconnected:', reason);
      this.emit('disconnected', reason);
    });

    this.room.on(RoomEvent.Reconnecting, () => {
      console.log('🔄 [LIVEKIT-CLIENT] Reconnecting...');
      this.emit('reconnecting');
    });

    this.room.on(RoomEvent.Reconnected, () => {
      console.log('✅ [LIVEKIT-CLIENT] Reconnected');
      this.emit('reconnected');
    });

    // Track subscribed (remote participant audio)
    this.room.on(RoomEvent.TrackSubscribed, (
      track: RemoteTrack,
      publication: RemoteTrackPublication
    ) => {
      if (track.kind === Track.Kind.Audio) {
        console.log('📥 [LIVEKIT-CLIENT] Received audio track from:', publication.trackName);
        
        // Attach to audio element for playback
        const audioElement = track.attach();
        document.body.appendChild(audioElement); // Auto-play remote audio
        
        this.emit('track', track);
      }
    });

    // Track unsubscribed
    this.room.on(RoomEvent.TrackUnsubscribed, (
      track: RemoteTrack,
      publication: RemoteTrackPublication
    ) => {
      console.log('📤 [LIVEKIT-CLIENT] Track unsubscribed:', publication.trackName);
      track.detach(); // Remove audio elements
    });

    // Participant events
    this.room.on(RoomEvent.ParticipantConnected, (participant) => {
      console.log('👤 [LIVEKIT-CLIENT] Participant joined:', participant.identity);
      this.emit('participant-joined', participant);
    });

    this.room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      console.log('👋 [LIVEKIT-CLIENT] Participant left:', participant.identity);
      this.emit('participant-left', participant);
    });

    // CRITICAL: Receive phone audio data packets
    this.room.on(RoomEvent.DataReceived, (
      payload: Uint8Array,
      _participant?: RemoteParticipant
    ) => {
      try {
        // Decode data message
        const text = new TextDecoder().decode(payload);
        const data = JSON.parse(text);

        // Check if it's phone audio
        if (data.type === 'phone-audio') {
          // Log every 100th packet to reduce noise but maintain visibility
          this.phoneAudioPacketCount++;
          if (this.phoneAudioPacketCount % 100 === 0) {
            console.log(`📞 [LIVEKIT-CLIENT] Received ${this.phoneAudioPacketCount} phone audio chunks`);
          }
          
          // Decode base64 audio
          const audioBase64 = data.audio;
          const audioBytes = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
          
          // Create AudioBuffer and play - Log ALL errors during debugging
          this.playPhoneAudio(audioBytes, data.sampleRate || 8000).catch(err => {
            console.error('❌ [LIVEKIT-CLIENT] Failed to play audio:', err);
            console.error('   Audio size:', audioBytes.length, 'bytes');
            console.error('   Sample rate:', data.sampleRate);
            console.error('   Error type:', err instanceof Error ? err.constructor.name : typeof err);
            console.error('   Error stack:', err instanceof Error ? err.stack : 'No stack');
          });
        }
      } catch (error) {
        console.error('❌ [LIVEKIT-CLIENT] Failed to process data:', error);
      }
    });
  }

  /**
   * Publish local audio track
   * ALSO captures audio to send to phone callers
   */
  private audioCapture: MediaStream | null = null;
  private audioProcessor: ScriptProcessorNode | null = null;

  async publishAudio(audioTrack: MediaStreamTrack): Promise<void> {
    if (!this.room) {
      throw new Error('Not connected to room');
    }

    console.log('🎤 [LIVEKIT-CLIENT] Publishing audio track...');

    try {
      // Publish to LiveKit (for other WebRTC participants)
      await this.room.localParticipant.publishTrack(audioTrack, {
        name: 'microphone',
        source: Track.Source.Microphone
      });

      // ALSO capture audio to forward to phone callers
      await this.startAudioCapture(audioTrack);

      console.log('✅ [LIVEKIT-CLIENT] Audio track published + capture started');
      this.emit('track-published', audioTrack);

    } catch (error) {
      console.error('❌ [LIVEKIT-CLIENT] Failed to publish audio:', error);
      throw error;
    }
  }

  /**
   * Start capturing audio to send to phone callers
   */
  private async startAudioCapture(audioTrack: MediaStreamTrack): Promise<void> {
    try {
      // Create audio context for processing
      if (!this.audioContext) {
        this.audioContext = new AudioContext({ sampleRate: 48000 });
      }

      // CRITICAL: Use the track directly, don't create a new MediaStream
      // Creating a new stream can cause the audio to be silent
      this.audioCapture = new MediaStream([audioTrack]);
      
      // Log track state for debugging
      console.log(`🎤 [AUDIO-CAPTURE] Track state: ${audioTrack.readyState}, enabled: ${audioTrack.enabled}, muted: ${audioTrack.muted}`);
      console.log(`🎤 [AUDIO-CAPTURE] Track settings:`, audioTrack.getSettings());
      
      // Create audio source
      const source = this.audioContext.createMediaStreamSource(this.audioCapture);
      
      // Use ScriptProcessor to capture audio chunks
      const bufferSize = 4096;
      this.audioProcessor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
      
      let debugPacketCount = 0;
      this.audioProcessor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Debug: Log first few packets to see if we're getting audio
        debugPacketCount++;
        if (debugPacketCount <= 3) {
          const max = Math.max(...Array.from(inputData));
          const min = Math.min(...Array.from(inputData));
          console.log(`🔊 [AUDIO-CAPTURE] Packet ${debugPacketCount}:`);
          console.log(`   Samples: ${inputData.length}`);
          console.log(`   Range: ${min.toFixed(4)} to ${max.toFixed(4)}`);
          console.log(`   First 5: [${Array.from(inputData.slice(0, 5)).map(v => v.toFixed(4)).join(', ')}]`);
        }
        
        // Convert Float32 to Int16 PCM with gain boost
        // Apply 100x gain to compensate for extremely low input levels
        // Browser meter shows audio but ScriptProcessorNode captures very quiet signal
        const GAIN = 100.0;
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const boosted = inputData[i] * GAIN;
          const s = Math.max(-1, Math.min(1, boosted)); // Clamp after gain
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Send ALL audio to phone (don't drop packets!)
        this.sendAudioToPhone(pcmData);
      };

      source.connect(this.audioProcessor);
      this.audioProcessor.connect(this.audioContext.destination);

      console.log('✅ [LIVEKIT-CLIENT] Audio capture started for phone forwarding');

    } catch (error) {
      console.error('❌ [LIVEKIT-CLIENT] Failed to start audio capture:', error);
    }
  }

  /**
   * Send captured audio to phone caller via HTTP endpoint
   */
  private audioSentCount = 0;
  private lastAudioLog = 0;
  
  private sendAudioToPhone(pcmData: Int16Array): void {
    if (!this.room) return;

    try {
      // Send audio directly to backend endpoint for phone forwarding
      const payload = {
        roomName: this.room.name,
        audio: btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer))),
        timestamp: Date.now(),
        sampleRate: 48000
      };

      // Log periodically to confirm audio is being sent
      this.audioSentCount++;
      const now = Date.now();
      if (now - this.lastAudioLog > 5000) {
        console.log(`🎤 [AUDIO-TO-PHONE] Sent ${this.audioSentCount} audio packets in last 5s to room: ${this.room.name}`);
        this.audioSentCount = 0;
        this.lastAudioLog = now;
      }

      // Use fetch with keepalive to avoid blocking
      fetch('/api/webrtc/forward-to-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch((err) => {
        // Log all errors with throttling (every 10th error after first 5)
        const shouldLog = this.audioSentCount <= 5 || this.audioSentCount % 10 === 0;
        if (shouldLog) {
          console.error('❌ [AUDIO-TO-PHONE] Fetch error:', err);
          console.error('   Error type:', err instanceof Error ? err.constructor.name : typeof err);
          console.error('   Error message:', err instanceof Error ? err.message : String(err));
          console.error('   Room name:', this.room?.name || 'null');
          console.error('   Audio packet size:', pcmData.length, 'samples');
          if (this.audioSentCount > 5) {
            console.error(`   (Logging every 10th error - this is error #${this.audioSentCount})`);
          }
        }
      });

    } catch (error) {
      console.error('❌ [AUDIO-TO-PHONE] Error preparing audio:', error);
      console.error('   Error type:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('   Error message:', error instanceof Error ? error.message : String(error));
      console.error('   Room:', this.room?.name || 'null');
      console.error('   PCM data length:', pcmData?.length || 'null', 'samples');
      if (error instanceof Error && error.stack) {
        console.error('   Error stack:', error.stack);
      }
    }
  }

  /**
   * Unpublish audio track
   */
  async unpublishAudio(): Promise<void> {
    if (!this.room) {
      return;
    }

    console.log('🔇 [LIVEKIT-CLIENT] Unpublishing audio...');

    // Get microphone track publication
    const publications = Array.from(this.room.localParticipant.trackPublications.values());
    const micPublication = publications.find(p => p.source === Track.Source.Microphone);
    
    if (micPublication && micPublication.track) {
      await this.room.localParticipant.unpublishTrack(micPublication.track);
      console.log('✅ [LIVEKIT-CLIENT] Audio unpublished');
    }
  }

  /**
   * Mute/unmute local microphone
   */
  async setMuted(muted: boolean): Promise<void> {
    if (!this.room) {
      return;
    }

    await this.room.localParticipant.setMicrophoneEnabled(!muted);
    console.log(`${muted ? '🔇' : '🔊'} [LIVEKIT-CLIENT] Microphone ${muted ? 'muted' : 'unmuted'}`);
    this.emit('muted-changed', muted);
  }

  /**
   * Disconnect from room
   */
  async disconnect(): Promise<void> {
    if (!this.room) {
      return;
    }

    console.log('📴 [LIVEKIT-CLIENT] Disconnecting...');

    await this.room.disconnect();
    this.room = null;

    console.log('✅ [LIVEKIT-CLIENT] Disconnected');
    this.emit('disconnected');
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.room !== null && this.room.state === 'connected';
  }

  /**
   * Get current room
   */
  getRoom(): Room | null {
    return this.room;
  }

  /**
   * Play phone audio using Web Audio API
   * Converts PCM bytes to AudioBuffer and plays
   */
  private audioContext: AudioContext | null = null;
  private nextPlayTime: number = 0;
  private audioPlaybackStarted: boolean = false;

  private async playPhoneAudio(pcmBytes: Uint8Array, sampleRate: number): Promise<void> {
    try {
      // Validate input
      if (pcmBytes.length === 0) {
        console.error('❌ [AUDIO] Received 0 bytes - skipping');
        return;
      }
      
      if (pcmBytes.length % 2 !== 0) {
        console.error(`❌ [AUDIO] Odd byte count: ${pcmBytes.length} - truncating to even`);
        pcmBytes = pcmBytes.slice(0, pcmBytes.length - 1);
      }

      // Initialize audio context if needed
      if (!this.audioContext) {
        this.audioContext = new AudioContext({ sampleRate: 48000 });
        this.nextPlayTime = this.audioContext.currentTime;
        console.log('🔊 [AUDIO] AudioContext created, sample rate:', this.audioContext.sampleRate);
      }

      // Resume AudioContext if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Log first playback with detailed info
      if (!this.audioPlaybackStarted) {
        this.audioPlaybackStarted = true;
        console.log('🔊 [AUDIO] Starting phone audio playback...');
        console.log(`   PCM bytes: ${pcmBytes.length}, sample rate: ${sampleRate}Hz`);
        console.log(`   First 10 bytes: [${Array.from(pcmBytes.slice(0, 10)).join(', ')}]`);
      }

      // Convert PCM bytes to Float32 (16-bit signed little-endian)
      const numSamples = Math.floor(pcmBytes.length / 2);
      const float32Array = new Float32Array(numSamples);
      
      for (let i = 0; i < numSamples; i++) {
        // Read 16-bit little-endian signed integer
        const byte1 = pcmBytes[i * 2];
        const byte2 = pcmBytes[i * 2 + 1];
        let value = byte1 | (byte2 << 8);
        
        // Convert to signed 16-bit
        if (value >= 0x8000) {
          value -= 0x10000;
        }
        
        // Normalize to -1.0 to 1.0
        float32Array[i] = value / 32768.0;
      }

      // Verify we have valid audio data
      const hasNonZero = float32Array.some(s => Math.abs(s) > 0.001);
      if (!hasNonZero && !this.audioPlaybackStarted) {
        console.warn('⚠️ [AUDIO] All samples near zero - might be silence or corrupt data');
      }

      // Create audio buffer - let browser resample from 8kHz to 48kHz
      const audioBuffer = this.audioContext.createBuffer(
        1, // Mono
        numSamples,
        sampleRate // Original rate (8000)
      );
      audioBuffer.copyToChannel(float32Array, 0);

      // Create audio source and play
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      
      // Add gain to boost volume
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = 2.0; // Boost phone audio
      
      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      // Schedule playback to prevent gaps
      const now = this.audioContext.currentTime;
      const playTime = Math.max(now, this.nextPlayTime);
      source.start(playTime);
      
      // Update next play time
      const duration = numSamples / sampleRate;
      this.nextPlayTime = playTime + duration;

    } catch (error) {
      console.error('❌ [AUDIO] Playback FAILED:', error);
      console.error('   PCM bytes length:', pcmBytes.length);
      console.error('   Sample rate:', sampleRate);
      console.error('   Error message:', error instanceof Error ? error.message : error);
      console.error('   Error stack:', error instanceof Error ? error.stack : 'No stack');
      // DON'T silence - we need to see this error
      throw error;
    }
  }

  /**
   * Get local participant
   */
  getLocalParticipant(): LocalParticipant | null {
    return this.room?.localParticipant || null;
  }

  /**
   * Event handling
   */
  on(event: string, callback: Function): void {
    this.eventCallbacks.set(event, callback);
  }

  private emit(event: string, data?: any): void {
    const callback = this.eventCallbacks.get(event);
    if (callback) {
      callback(data);
    }
  }

  /**
   * Get connection stats
   */
  async getStats(): Promise<Map<string, any>> {
    const stats = new Map<string, any>();
    
    if (!this.room) {
      return stats;
    }

    // Get stats from local participant's tracks
    for (const pub of this.room.localParticipant.trackPublications.values()) {
      if (pub.track) {
        const trackStats = await pub.track.getRTCStatsReport();
        stats.set(pub.trackSid, trackStats);
      }
    }

    return stats;
  }
}

export default LiveKitClient;

