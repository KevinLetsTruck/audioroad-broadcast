/**
 * LiveKit Room Manager
 * Manages audio rooms using LiveKit Cloud infrastructure
 * 
 * Much simpler than Janus - LiveKit handles all the complexity!
 */

import { RoomServiceClient, AccessToken, Room } from 'livekit-server-sdk';
import { EventEmitter } from 'events';

interface Participant {
  id: string;
  displayName: string;
  roomName: string;
  identity: string;
  muted: boolean;
}

export class LiveKitRoomManager extends EventEmitter {
  private client: RoomServiceClient;
  private apiKey: string;
  private apiSecret: string;
  private wsUrl: string;
  private participants: Map<string, Participant> = new Map();

  constructor(wsUrl: string, apiKey: string, apiSecret: string) {
    super();
    this.wsUrl = wsUrl;
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    
    // Initialize LiveKit client
    this.client = new RoomServiceClient(wsUrl, apiKey, apiSecret);
    
    console.log('✅ [LIVEKIT] Room Manager initialized');
  }

  /**
   * Initialize connection (LiveKit doesn't need explicit connection)
   */
  async initialize(): Promise<void> {
    console.log('✅ [LIVEKIT] Connected to LiveKit Cloud:', this.wsUrl);
    
    // Create default lobby room
    await this.ensureRoomExists('lobby', 10); // 10 max participants
  }

  /**
   * Ensure room exists (create if needed)
   */
  async ensureRoomExists(roomName: string, maxParticipants: number = 50): Promise<void> {
    try {
      // List rooms to check if it exists
      const rooms = await this.client.listRooms();
      const exists = rooms.some(r => r.name === roomName);
      
      if (exists) {
        console.log(`ℹ️ [LIVEKIT] Room already exists: ${roomName}`);
        return;
      }
      
      // Room doesn't exist, create it
      await this.client.createRoom({
        name: roomName,
        emptyTimeout: 300, // Room closes after 5 minutes empty
        maxParticipants: maxParticipants
      });
      console.log(`✅ [LIVEKIT] Room created: ${roomName}`);
      
    } catch (error: any) {
      console.error(`❌ [LIVEKIT] Error with room ${roomName}:`, error.message);
      // Continue anyway - room might exist or will be created on join
    }
  }

  /**
   * Generate access token for participant to join room
   */
  async generateToken(roomName: string, participantIdentity: string, participantName: string): Promise<string> {
    const token = new AccessToken(this.apiKey, this.apiSecret, {
      identity: participantIdentity,
      name: participantName
    });

    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true
    });

    return token.toJwt();
  }

  /**
   * Add participant to room (generates token for them to join)
   */
  async addParticipant(
    participantId: string,
    roomName: string,
    displayName: string,
    canPublish: boolean = true
  ): Promise<string> {
    console.log(`🔌 [LIVEKIT] Adding ${participantId} to ${roomName}`);

    // Ensure room exists
    await this.ensureRoomExists(roomName);

    // Generate token for participant
    const token = await this.generateToken(roomName, participantId, displayName);

    // Track participant
    this.participants.set(participantId, {
      id: participantId,
      displayName,
      roomName,
      identity: participantId,
      muted: false
    });

    console.log(`✅ [LIVEKIT] Token generated for ${participantId} to join ${roomName}`);
    this.emit('participant-joined', { participantId, roomName });

    return token;
  }

  /**
   * Remove participant from room
   */
  async removeParticipant(participantId: string): Promise<void> {
    const participant = this.participants.get(participantId);
    
    if (!participant) {
      console.warn(`⚠️ [LIVEKIT] Participant ${participantId} not found`);
      return;
    }

    console.log(`📴 [LIVEKIT] Removing ${participantId} from ${participant.roomName}`);

    try {
      // Remove from LiveKit room
      await this.client.removeParticipant(participant.roomName, participant.identity);
      
      this.participants.delete(participantId);
      console.log(`✅ [LIVEKIT] ${participantId} removed`);
      this.emit('participant-left', { participantId, room: participant.roomName });

    } catch (error: any) {
      // Participant might have already left
      console.warn(`⚠️ [LIVEKIT] Could not remove participant:`, error.message);
      this.participants.delete(participantId);
    }
  }

  /**
   * Move participant from one room to another
   * In LiveKit, we do this by removing from old room and generating new token
   */
  async moveParticipant(
    participantId: string,
    fromRoom: string,
    toRoom: string,
    muted: boolean = false
  ): Promise<string> {
    console.log(`🔄 [LIVEKIT] Moving ${participantId} from ${fromRoom} to ${toRoom}`);

    const participant = this.participants.get(participantId);
    
    if (!participant) {
      throw new Error(`Participant ${participantId} not found`);
    }

    // Remove from current room
    await this.removeParticipant(participantId);

    // Generate new token for new room
    const token = await this.addParticipant(
      participantId,
      toRoom,
      participant.displayName
    );

    // Apply mute if needed
    if (muted) {
      await this.muteParticipant(participantId, true);
    }

    console.log(`✅ [LIVEKIT] ${participantId} moved to ${toRoom}`);
    this.emit('participant-moved', { participantId, fromRoom, toRoom });

    return token;
  }

  /**
   * Mute/unmute participant
   */
  async muteParticipant(participantId: string, muted: boolean): Promise<void> {
    const participant = this.participants.get(participantId);
    
    if (!participant) {
      throw new Error(`Participant ${participantId} not found`);
    }

    try {
      await this.client.mutePublishedTrack(
        participant.roomName,
        participant.identity,
        '', // Track SID (empty = all tracks)
        muted
      );

      participant.muted = muted;
      
      console.log(`${muted ? '🔇' : '🔊'} [LIVEKIT] ${participantId} ${muted ? 'muted' : 'unmuted'}`);
      this.emit('participant-mute-changed', { participantId, muted });

    } catch (error: any) {
      console.error(`❌ [LIVEKIT] Failed to ${muted ? 'mute' : 'unmute'}:`, error.message);
      throw error;
    }
  }

  /**
   * Get participants in a room
   */
  getParticipantsInRoom(roomName: string): Participant[] {
    return Array.from(this.participants.values()).filter(p => p.roomName === roomName);
  }

  /**
   * Get participant info
   */
  getParticipant(participantId: string): Participant | undefined {
    return this.participants.get(participantId);
  }

  /**
   * List all rooms
   */
  async listRooms(): Promise<Room[]> {
    try {
      const rooms = await this.client.listRooms();
      return rooms;
    } catch (error: any) {
      console.error('❌ [LIVEKIT] Failed to list rooms:', error.message);
      return [];
    }
  }

  /**
   * Delete a room
   */
  async destroyRoom(roomName: string): Promise<void> {
    try {
      // Remove all participants first
      const participants = this.getParticipantsInRoom(roomName);
      for (const p of participants) {
        await this.removeParticipant(p.id);
      }

      // Delete room
      await this.client.deleteRoom(roomName);
      console.log(`✅ [LIVEKIT] Room deleted: ${roomName}`);

    } catch (error: any) {
      console.error(`❌ [LIVEKIT] Failed to delete room:`, error.message);
      throw error;
    }
  }

  /**
   * Check if connected (LiveKit is always "connected" via REST API)
   */
  isConnected(): boolean {
    return true; // LiveKit uses REST API, no persistent connection needed
  }

  /**
   * Disconnect (cleanup)
   */
  async disconnect(): Promise<void> {
    // Remove all tracked participants
    for (const participantId of this.participants.keys()) {
      await this.removeParticipant(participantId);
    }
    
    this.participants.clear();
    console.log('✅ [LIVEKIT] Disconnected');
  }

  /**
   * Get room statistics
   */
  async getRoomStats(roomName: string): Promise<any> {
    try {
      const rooms = await this.client.listRooms();
      const room = rooms.find(r => r.name === roomName);
      return room || null;
    } catch (error: any) {
      console.error('❌ [LIVEKIT] Failed to get room stats:', error.message);
      return null;
    }
  }
}

export default LiveKitRoomManager;

