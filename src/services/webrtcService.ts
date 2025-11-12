/**
 * WebRTC Service
 * High-level API for WebRTC audio rooms
 * Uses LiveKit Cloud for production-ready WebRTC
 */

import LiveKitClient from './livekitClient';

export interface WebRTCConfig {
  livekitUrl: string;
}

export interface RoomInfo {
  id: string;
  type: 'live' | 'screening' | 'lobby';
  episodeId?: string;
  participantCount?: number;
}

export interface ParticipantInfo {
  id: string;
  displayName: string;
  muted: boolean;
  speaking: boolean;
}

export class WebRTCService {
  private client: LiveKitClient | null = null;
  private config: WebRTCConfig;
  private currentRoom: RoomInfo | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  
  private eventHandlers: Map<string, Set<Function>> = new Map();

  constructor(config: WebRTCConfig) {
    this.config = config;
  }

  /**
   * Initialize WebRTC connection
   */
  async initialize(): Promise<void> {
    if (this.client && this.client.isConnected()) {
      console.log('ℹ️ [WEBRTC] Already connected');
      return;
    }

    console.log('🔌 [WEBRTC] Initializing LiveKit WebRTC service...');

    try {
      this.client = new LiveKitClient(this.config.livekitUrl);

      // Forward events
      this.client.on('connected', () => {
        this.emit('connected');
      });

      this.client.on('webrtcup', () => {
        this.emit('webrtcup');
      });

      this.client.on('track', () => {
        // Track automatically plays via audio element in LiveKit
        this.emit('remote-track');
      });

      this.client.on('disconnected', () => {
        this.emit('disconnected');
      });

      this.client.on('reconnecting', () => {
        this.emit('reconnecting');
      });

      this.client.on('reconnected', () => {
        this.emit('reconnected');
      });

      console.log('✅ [WEBRTC] LiveKit service initialized');

    } catch (error) {
      console.error('❌ [WEBRTC] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Join live broadcast room as host
   */
  async joinLiveRoom(episodeId: string, displayName: string): Promise<void> {
    if (!this.client) {
      throw new Error('WebRTC client not initialized');
    }

    if (!this.localStream) {
      throw new Error('No local audio stream available');
    }

    const roomName = `live-${episodeId}`;

    console.log(`🔌 [WEBRTC] Joining live room: ${roomName}`);

    try {
      // Get access token from backend
      const response = await fetch('/api/webrtc/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName,
          participantName: displayName,
          participantId: `host-${episodeId}`
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get LiveKit token');
      }

      const { token } = await response.json();

      // Connect to LiveKit room
      await this.client.connect(token);

      // Publish local audio
      const audioTrack = this.localStream.getAudioTracks()[0];
      await this.client.publishAudio(audioTrack);

      this.currentRoom = {
        id: roomName,
        type: 'live',
        episodeId
      };

      this.emit('room-joined', this.currentRoom);
      console.log('✅ [WEBRTC] Joined live room:', roomName);

    } catch (error) {
      console.error('❌ [WEBRTC] Failed to join live room:', error);
      throw error;
    }
  }

  /**
   * Join screening room as screener
   */
  async joinScreeningRoom(
    episodeId: string,
    callId: string,
    displayName: string
  ): Promise<void> {
    if (!this.client) {
      throw new Error('WebRTC client not initialized');
    }

    if (!this.localStream) {
      throw new Error('No local audio stream available');
    }

    const roomName = `screening-${episodeId}-${callId}`;

    console.log(`🔌 [WEBRTC] Joining screening room: ${roomName}`);

    try {
      // Get access token from backend
      const response = await fetch('/api/webrtc/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName,
          participantName: displayName,
          participantId: `screener-${callId}`
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get LiveKit token');
      }

      const { token } = await response.json();

      // Connect to LiveKit room
      await this.client.connect(token);

      // Publish local audio
      const audioTrack = this.localStream.getAudioTracks()[0];
      await this.client.publishAudio(audioTrack);

      this.currentRoom = {
        id: roomName,
        type: 'screening',
        episodeId
      };

      this.emit('room-joined', this.currentRoom);
      console.log('✅ [WEBRTC] Joined screening room:', roomName);

    } catch (error) {
      console.error('❌ [WEBRTC] Failed to join screening room:', error);
      throw error;
    }
  }

  /**
   * Leave current room
   */
  async leaveRoom(): Promise<void> {
    if (!this.client) {
      return;
    }

    console.log('📴 [WEBRTC] Leaving room:', this.currentRoom?.id);

    try {
      await this.client.disconnect();
      
      const leftRoom = this.currentRoom;
      this.currentRoom = null;
      
      this.emit('room-left', leftRoom);
      console.log('✅ [WEBRTC] Left room');

    } catch (error) {
      console.error('❌ [WEBRTC] Failed to leave room:', error);
      throw error;
    }
  }

  /**
   * Set local audio stream (microphone)
   */
  async setLocalAudioStream(constraints?: MediaStreamConstraints): Promise<MediaStream> {
    console.log('🎤 [WEBRTC] Getting local audio stream...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        constraints || {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000
          },
          video: false
        }
      );

      this.localStream = stream;
      this.emit('local-stream', stream);
      
      console.log('✅ [WEBRTC] Local audio stream ready');
      return stream;

    } catch (error) {
      console.error('❌ [WEBRTC] Failed to get audio stream:', error);
      throw error;
    }
  }

  /**
   * Mute/unmute local microphone
   */
  async setMuted(muted: boolean): Promise<void> {
    if (!this.client) {
      return;
    }

    await this.client.setMuted(muted);
    this.emit('muted-changed', muted);
    console.log(`🔇 [WEBRTC] ${muted ? 'Muted' : 'Unmuted'} local microphone`);
  }

  /**
   * Get local stream
   */
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Get remote stream (other participants)
   */
  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  /**
   * Get current room info
   */
  getCurrentRoom(): RoomInfo | null {
    return this.currentRoom;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.client !== null && this.client.isConnected();
  }

  /**
   * Check if in a room
   */
  isInRoom(): boolean {
    return this.currentRoom !== null;
  }

  /**
   * Get connection stats
   */
  async getStats(): Promise<Map<string, any> | null> {
    if (!this.client) {
      return null;
    }
    return await this.client.getStats();
  }

  /**
   * Stop local audio stream
   */
  stopLocalStream(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
      console.log('✅ [WEBRTC] Local stream stopped');
    }
  }

  /**
   * Disconnect from WebRTC
   */
  async disconnect(): Promise<void> {
    console.log('📴 [WEBRTC] Disconnecting...');

    if (this.currentRoom) {
      await this.leaveRoom();
    }

    this.stopLocalStream();

    if (this.client) {
      await this.client.disconnect();
      this.client = null;
    }

    this.remoteStream = null;
    this.currentRoom = null;

    this.emit('disconnected');
    console.log('✅ [WEBRTC] Disconnected');
  }

  /**
   * Event handling
   */
  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit(event: string, data?: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`❌ [WEBRTC] Error in event handler for ${event}:`, error);
        }
      });
    }
  }
}

/**
 * Singleton instance
 * Create once, use throughout the app
 */
let webrtcServiceInstance: WebRTCService | null = null;

export function getWebRTCService(config?: WebRTCConfig): WebRTCService {
  if (!webrtcServiceInstance) {
    if (!config) {
      throw new Error('WebRTC config required for first initialization');
    }
    webrtcServiceInstance = new WebRTCService(config);
  }
  return webrtcServiceInstance;
}

export function resetWebRTCService(): void {
  if (webrtcServiceInstance) {
    webrtcServiceInstance.disconnect();
    webrtcServiceInstance = null;
  }
}

export default WebRTCService;

