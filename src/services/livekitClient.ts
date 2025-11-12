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
          console.log('📞 [LIVEKIT-CLIENT] Received phone audio chunk');
          
          // Decode base64 audio
          const audioBase64 = data.audio;
          const audioBytes = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
          
          // Create AudioBuffer and play
          this.playPhoneAudio(audioBytes, data.sampleRate || 8000);
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

      // Create media stream from track
      this.audioCapture = new MediaStream([audioTrack]);
      
      // Create audio source
      const source = this.audioContext.createMediaStreamSource(this.audioCapture);
      
      // Use ScriptProcessor to capture audio chunks
      const bufferSize = 4096;
      this.audioProcessor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
      
      this.audioProcessor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Convert Float32 to Int16 PCM
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Send to server via data channel every 100ms (about 10 packets/sec)
        if (Math.random() < 0.2) { // Send ~20% of packets to reduce bandwidth
          this.sendAudioToPhone(pcmData);
        }
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

      // Use fetch with keepalive to avoid blocking
      fetch('/api/webrtc/forward-to-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(() => {}); // Ignore errors (too many requests)

    } catch (error) {
      // Don't log every error (too noisy)
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

  private async playPhoneAudio(pcmBytes: Uint8Array, sampleRate: number): Promise<void> {
    try {
      // Initialize audio context if needed
      if (!this.audioContext) {
        this.audioContext = new AudioContext({ sampleRate: 48000 }); // Standard rate
        this.nextPlayTime = this.audioContext.currentTime;
        console.log('🔊 [AUDIO] AudioContext created, sample rate:', this.audioContext.sampleRate);
      }

      // Resume AudioContext if suspended (browser security requires user gesture)
      if (this.audioContext.state === 'suspended') {
        console.log('🔊 [AUDIO] Resuming suspended AudioContext...');
        await this.audioContext.resume();
        console.log('✅ [AUDIO] AudioContext resumed, state:', this.audioContext.state);
      }

      // Convert PCM bytes to Float32 samples
      const int16Array = new Int16Array(pcmBytes.buffer);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0; // Convert to -1.0 to 1.0
      }

      // Create audio buffer at phone's sample rate (8kHz from Twilio)
      // Browser will automatically resample to match AudioContext rate (48kHz)
      const audioBuffer = this.audioContext.createBuffer(
        1, // Mono
        float32Array.length,
        sampleRate // Use phone's actual rate (8000)
      );
      audioBuffer.copyToChannel(float32Array, 0);

      // Schedule playback
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      
      // Add low-pass filter to reduce noise/static
      const filter = this.audioContext.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 3400; // Phone audio bandwidth
      filter.Q.value = 1;
      
      source.connect(filter);
      filter.connect(this.audioContext.destination);

      // Play immediately or queue
      const now = this.audioContext.currentTime;
      const playTime = Math.max(now, this.nextPlayTime);
      source.start(playTime);
      
      // Update next play time
      this.nextPlayTime = playTime + audioBuffer.duration;

    } catch (error) {
      console.error('❌ [LIVEKIT-CLIENT] Failed to play phone audio:', error);
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

