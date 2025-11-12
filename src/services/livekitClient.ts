/**
 * LiveKit Client (Browser)
 * Connects browser to LiveKit Cloud for WebRTC audio rooms
 * 
 * Much simpler than Janus - LiveKit SDK handles everything!
 */

import { Room, RoomEvent, Track, RemoteTrack, RemoteTrackPublication, LocalParticipant } from 'livekit-client';

export interface LiveKitConfig {
  wsUrl: string;
  token: string;
}

export class LiveKitClient {
  private room: Room | null = null;
  private wsUrl: string;
  private currentToken: string | null = null;
  private eventCallbacks: Map<string, Function> = new Map();

  constructor(wsUrl: string) {
    this.wsUrl = wsUrl;
  }

  /**
   * Connect to LiveKit room
   */
  async connect(token: string): Promise<void> {
    console.log('📡 [LIVEKIT-CLIENT] Connecting to LiveKit...');

    this.currentToken = token;
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
      this.emit('connected', { roomName: this.room.name });
    } catch (error) {
      console.error('❌ [LIVEKIT-CLIENT] Connection failed:', error);
      throw error;
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
  }

  /**
   * Publish local audio track
   */
  async publishAudio(audioTrack: MediaStreamTrack): Promise<void> {
    if (!this.room) {
      throw new Error('Not connected to room');
    }

    console.log('🎤 [LIVEKIT-CLIENT] Publishing audio track...');

    try {
      await this.room.localParticipant.publishTrack(audioTrack, {
        name: 'microphone',
        source: Track.Source.Microphone
      });

      console.log('✅ [LIVEKIT-CLIENT] Audio track published');
      this.emit('track-published', audioTrack);

    } catch (error) {
      console.error('❌ [LIVEKIT-CLIENT] Failed to publish audio:', error);
      throw error;
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

    const publication = this.room.localParticipant.getTrack(Track.Source.Microphone);
    if (publication) {
      await this.room.localParticipant.unpublishTrack(publication.track!);
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
    this.currentToken = null;

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

