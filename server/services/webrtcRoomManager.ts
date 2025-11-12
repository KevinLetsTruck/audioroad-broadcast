/**
 * WebRTC Room Manager
 * Manages audio rooms (screening, live) using Janus Gateway
 */

import JanusGateway from './janusGateway.js';
import { EventEmitter } from 'events';

interface Participant {
  id: string;
  displayName: string;
  handleId: number;
  muted: boolean;
  room: string;
}

export class WebRTCRoomManager extends EventEmitter {
  private janus: JanusGateway;
  private participants: Map<string, Participant> = new Map();
  private rooms: Set<string> = new Set();

  constructor(janusUrl: string) {
    super();
    this.janus = new JanusGateway(janusUrl);

    // Forward Janus events
    this.janus.on('event', (event) => this.emit('janus-event', event));
    this.janus.on('error', (error) => this.emit('error', error));
    this.janus.on('reconnected', () => this.emit('reconnected'));
  }

  /**
   * Initialize connection to Janus
   */
  async initialize(): Promise<void> {
    try {
      await this.janus.connect();
      console.log('✅ [ROOM-MANAGER] Connected to Janus Gateway');
      
      // Create default rooms
      await this.ensureRoomExists('lobby', 'Lobby - Incoming calls');
      
    } catch (error) {
      console.error('❌ [ROOM-MANAGER] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Ensure a room exists (create if needed)
   */
  async ensureRoomExists(roomId: string, description: string): Promise<void> {
    if (this.rooms.has(roomId)) {
      return;
    }

    try {
      await this.janus.createRoom(roomId, description);
      this.rooms.add(roomId);
      console.log(`✅ [ROOM-MANAGER] Room ready: ${roomId}`);
    } catch (error: any) {
      // Room might already exist
      if (error.message.includes('already exists')) {
        this.rooms.add(roomId);
        console.log(`ℹ️ [ROOM-MANAGER] Room already exists: ${roomId}`);
      } else {
        console.error(`❌ [ROOM-MANAGER] Failed to create room ${roomId}:`, error);
        throw error;
      }
    }
  }

  /**
   * Add participant to room
   */
  async addParticipant(
    participantId: string,
    roomId: string,
    displayName: string,
    asPublisher: boolean = true
  ): Promise<void> {
    console.log(`🔌 [ROOM-MANAGER] Adding ${participantId} to ${roomId} as ${asPublisher ? 'publisher' : 'subscriber'}`);

    // Ensure room exists
    await this.ensureRoomExists(roomId, `Room ${roomId}`);

    try {
      let result;
      if (asPublisher) {
        result = await this.janus.joinRoomAsPublisher(roomId, participantId, displayName);
      } else {
        // Subscriber needs feed ID - for now, join as publisher (can send + receive)
        result = await this.janus.joinRoomAsPublisher(roomId, participantId, displayName);
      }

      this.participants.set(participantId, {
        id: participantId,
        displayName,
        handleId: result.handleId,
        muted: false,
        room: roomId
      });

      console.log(`✅ [ROOM-MANAGER] ${participantId} added to ${roomId}`);
      this.emit('participant-joined', { participantId, roomId });

    } catch (error) {
      console.error(`❌ [ROOM-MANAGER] Failed to add participant:`, error);
      throw error;
    }
  }

  /**
   * Remove participant from current room
   */
  async removeParticipant(participantId: string): Promise<void> {
    const participant = this.participants.get(participantId);
    
    if (!participant) {
      console.warn(`⚠️ [ROOM-MANAGER] Participant ${participantId} not found`);
      return;
    }

    console.log(`📴 [ROOM-MANAGER] Removing ${participantId} from ${participant.room}`);

    try {
      await this.janus.leaveRoom(participant.handleId);
      this.participants.delete(participantId);
      
      console.log(`✅ [ROOM-MANAGER] ${participantId} removed`);
      this.emit('participant-left', { participantId, room: participant.room });

    } catch (error) {
      console.error(`❌ [ROOM-MANAGER] Failed to remove participant:`, error);
      throw error;
    }
  }

  /**
   * Move participant from one room to another
   */
  async moveParticipant(
    participantId: string,
    fromRoom: string,
    toRoom: string,
    muted: boolean = false
  ): Promise<void> {
    console.log(`🔄 [ROOM-MANAGER] Moving ${participantId} from ${fromRoom} to ${toRoom}`);

    const participant = this.participants.get(participantId);
    
    if (!participant) {
      throw new Error(`Participant ${participantId} not found`);
    }

    if (participant.room !== fromRoom) {
      console.warn(`⚠️ [ROOM-MANAGER] Participant in ${participant.room}, not ${fromRoom}`);
    }

    // Leave current room
    await this.removeParticipant(participantId);

    // Join new room
    await this.addParticipant(participantId, toRoom, participant.displayName);

    // Apply mute if needed
    if (muted) {
      await this.muteParticipant(participantId, true);
    }

    console.log(`✅ [ROOM-MANAGER] ${participantId} moved to ${toRoom}`);
    this.emit('participant-moved', { participantId, fromRoom, toRoom });
  }

  /**
   * Mute/unmute participant
   */
  async muteParticipant(participantId: string, muted: boolean): Promise<void> {
    const participant = this.participants.get(participantId);
    
    if (!participant) {
      throw new Error(`Participant ${participantId} not found`);
    }

    // For now, muting is controlled client-side (browser)
    // We'll emit event to client to mute their microphone
    participant.muted = muted;
    
    console.log(`${muted ? '🔇' : '🔊'} [ROOM-MANAGER] ${participantId} ${muted ? 'muted' : 'unmuted'}`);
    this.emit('participant-mute-changed', { participantId, muted });
  }

  /**
   * Get participants in a room
   */
  getParticipantsInRoom(roomId: string): Participant[] {
    return Array.from(this.participants.values()).filter(p => p.room === roomId);
  }

  /**
   * Get participant info
   */
  getParticipant(participantId: string): Participant | undefined {
    return this.participants.get(participantId);
  }

  /**
   * Destroy a room
   */
  async destroyRoom(roomId: string): Promise<void> {
    // Remove all participants first
    const participants = this.getParticipantsInRoom(roomId);
    for (const p of participants) {
      await this.removeParticipant(p.id);
    }

    this.rooms.delete(roomId);
    console.log(`✅ [ROOM-MANAGER] Room destroyed: ${roomId}`);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.janus.isConnected();
  }

  /**
   * Disconnect
   */
  async disconnect(): Promise<void> {
    // Remove all participants
    for (const participantId of this.participants.keys()) {
      await this.removeParticipant(participantId);
    }

    await this.janus.disconnect();
    this.rooms.clear();
    console.log('✅ [ROOM-MANAGER] Disconnected');
  }
}

export default WebRTCRoomManager;

