/**
 * SIP Call Flow Manager
 * Manages the complete lifecycle of phone callers through LiveKit rooms
 * 
 * Call States & Room Mapping:
 * - queued/ringing → lobby room
 * - screening → screening-{episodeId}-{callId} room (private 1-on-1)
 * - approved/on-hold → hold-{episodeId} room (hears live show!)
 * - on-air → live-{episodeId} room (talks on show)
 * 
 * Unlimited transitions: screening → hold → on-air → hold → on-air (repeat!)
 */

import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';
import LiveKitRoomManager from './livekitRoomManager.js';
import LiveKitSIPService from './livekitSipService.js';

interface CallParticipant {
  callId: string;
  callSid: string;
  episodeId: string;
  callerName: string;
  currentRoom: string;
  status: string;
}

export class SIPCallFlowManager extends EventEmitter {
  private prisma: PrismaClient;
  private roomManager: LiveKitRoomManager;
  private sipService: LiveKitSIPService;
  private participants: Map<string, CallParticipant> = new Map();

  constructor(
    prisma: PrismaClient,
    roomManager: LiveKitRoomManager,
    sipService: LiveKitSIPService
  ) {
    super();
    this.prisma = prisma;
    this.roomManager = roomManager;
    this.sipService = sipService;
  }

  /**
   * Initialize the call flow manager
   */
  async initialize(): Promise<void> {
    console.log('🎬 [CALL-FLOW] Initializing SIP call flow manager...');
    
    // Load active calls from database
    const activeCalls = await this.prisma.call.findMany({
      where: {
        status: {
          in: ['queued', 'screening', 'approved', 'on-hold', 'on-air']
        }
      },
      include: {
        caller: true,
        episode: true
      }
    });
    
    for (const call of activeCalls) {
      await this.restoreCallState(call);
    }
    
    console.log(`✅ [CALL-FLOW] Initialized with ${activeCalls.length} active calls`);
  }

  /**
   * Handle incoming call from Twilio
   * This is called when a phone call first comes in
   */
  async handleIncomingCall(
    callSid: string,
    callId: string,
    episodeId: string,
    callerName: string,
    callerPhone: string
  ): Promise<string> {
    try {
      console.log(`📞 [CALL-FLOW] Incoming call: ${callSid}`);
      console.log(`   Caller: ${callerName} (${callerPhone})`);
      console.log(`   Episode: ${episodeId}`);
      
      // Start in lobby room (queued state)
      const roomName = 'lobby';
      
      // Ensure lobby exists
      await this.roomManager.ensureRoomExists(roomName, 100);
      
      // Route SIP call to lobby
      await this.sipService.routeCallToRoom(callSid, roomName, callerName);
      
      // Track participant
      this.participants.set(callId, {
        callId,
        callSid,
        episodeId,
        callerName,
        currentRoom: roomName,
        status: 'queued'
      });
      
      // Update database
      await this.prisma.call.update({
        where: { id: callId },
        data: {
          status: 'queued',
          twilioCallSid: callSid
        }
      });
      
      console.log(`✅ [CALL-FLOW] Call ${callId} routed to lobby`);
      this.emit('call-queued', { callId, callSid, roomName });
      
      return roomName;
      
    } catch (error: any) {
      console.error(`❌ [CALL-FLOW] Failed to handle incoming call:`, error.message);
      throw error;
    }
  }

  /**
   * Move caller to screening room (private with screener)
   */
  async moveToScreening(callId: string, screenerId: string): Promise<string> {
    try {
      const participant = this.participants.get(callId);
      if (!participant) {
        throw new Error(`Call ${callId} not found`);
      }
      
      console.log(`🎯 [CALL-FLOW] Moving call ${callId} to screening`);
      
      // Create unique screening room (private 1-on-1)
      const screeningRoom = `screening-${participant.episodeId}-${callId}`;
      
      // Ensure screening room exists
      await this.roomManager.ensureRoomExists(screeningRoom, 2); // Just caller + screener
      
      // Move SIP participant to screening room
      await this.sipService.moveParticipantToRoom(
        participant.callSid,
        participant.currentRoom,
        screeningRoom
      );
      
      // Update participant state
      participant.currentRoom = screeningRoom;
      participant.status = 'screening';
      
      // Update database
      await this.prisma.call.update({
        where: { id: callId },
        data: {
          status: 'screening',
          screenerUserId: screenerId
        }
      });
      
      console.log(`✅ [CALL-FLOW] Call ${callId} moved to screening room: ${screeningRoom}`);
      this.emit('call-screening', { callId, roomName: screeningRoom, screenerId });
      
      return screeningRoom;
      
    } catch (error: any) {
      console.error(`❌ [CALL-FLOW] Failed to move to screening:`, error.message);
      throw error;
    }
  }

  /**
   * Move caller to hold (they hear the live show!)
   */
  async moveToHold(callId: string): Promise<string> {
    try {
      const participant = this.participants.get(callId);
      if (!participant) {
        throw new Error(`Call ${callId} not found`);
      }
      
      console.log(`⏸️ [CALL-FLOW] Moving call ${callId} to hold`);
      
      // Hold room where callers hear the live show
      const holdRoom = `hold-${participant.episodeId}`;
      
      // Ensure hold room exists
      await this.roomManager.ensureRoomExists(holdRoom, 50);
      
      // Move SIP participant to hold room
      await this.sipService.moveParticipantToRoom(
        participant.callSid,
        participant.currentRoom,
        holdRoom
      );
      
      // Update participant state
      participant.currentRoom = holdRoom;
      participant.status = 'on-hold';
      
      // Update database
      await this.prisma.call.update({
        where: { id: callId },
        data: {
          status: 'on-hold'
        }
      });
      
      console.log(`✅ [CALL-FLOW] Call ${callId} on hold in room: ${holdRoom}`);
      console.log(`   🎵 Caller will hear live show audio!`);
      this.emit('call-on-hold', { callId, roomName: holdRoom });
      
      return holdRoom;
      
    } catch (error: any) {
      console.error(`❌ [CALL-FLOW] Failed to move to hold:`, error.message);
      throw error;
    }
  }

  /**
   * Move caller to live (on-air with host)
   */
  async moveToLive(callId: string): Promise<string> {
    try {
      const participant = this.participants.get(callId);
      if (!participant) {
        throw new Error(`Call ${callId} not found`);
      }
      
      console.log(`📡 [CALL-FLOW] Moving call ${callId} ON AIR`);
      
      // Live room where host and callers talk
      const liveRoom = `live-${participant.episodeId}`;
      
      // Ensure live room exists
      await this.roomManager.ensureRoomExists(liveRoom, 20);
      
      // Move SIP participant to live room
      await this.sipService.moveParticipantToRoom(
        participant.callSid,
        participant.currentRoom,
        liveRoom
      );
      
      // Update participant state
      participant.currentRoom = liveRoom;
      participant.status = 'on-air';
      
      // Update database
      const call = await this.prisma.call.update({
        where: { id: callId },
        data: {
          status: 'on-air',
          onAirAt: new Date()
        }
      });
      
      console.log(`✅ [CALL-FLOW] Call ${callId} is NOW LIVE in room: ${liveRoom}`);
      this.emit('call-on-air', { callId, roomName: liveRoom });
      
      return liveRoom;
      
    } catch (error: any) {
      console.error(`❌ [CALL-FLOW] Failed to move to live:`, error.message);
      throw error;
    }
  }

  /**
   * End the call
   */
  async endCall(callId: string): Promise<void> {
    try {
      const participant = this.participants.get(callId);
      if (!participant) {
        console.warn(`⚠️ [CALL-FLOW] Call ${callId} not found (might be already ended)`);
        return;
      }
      
      console.log(`📴 [CALL-FLOW] Ending call ${callId}`);
      
      // Remove from LiveKit room
      await this.sipService.moveParticipantToRoom(
        participant.callSid,
        participant.currentRoom,
        'ended' // Special room that immediately hangs up
      );
      
      // Update database
      await this.prisma.call.update({
        where: { id: callId },
        data: {
          status: 'completed',
          endedAt: new Date()
        }
      });
      
      // Remove from tracking
      this.participants.delete(callId);
      
      console.log(`✅ [CALL-FLOW] Call ${callId} ended`);
      this.emit('call-ended', { callId });
      
    } catch (error: any) {
      console.error(`❌ [CALL-FLOW] Failed to end call:`, error.message);
      throw error;
    }
  }

  /**
   * Get participant info
   */
  getParticipant(callId: string): CallParticipant | undefined {
    return this.participants.get(callId);
  }

  /**
   * List all active participants
   */
  listActiveParticipants(): CallParticipant[] {
    return Array.from(this.participants.values());
  }

  /**
   * Get participants in a specific room
   */
  getParticipantsInRoom(roomName: string): CallParticipant[] {
    return Array.from(this.participants.values()).filter(
      p => p.currentRoom === roomName
    );
  }

  /**
   * Restore call state from database (on server restart)
   */
  private async restoreCallState(call: any): Promise<void> {
    const roomName = this.getRoomNameForStatus(call.status, call.episodeId, call.id);
    
    this.participants.set(call.id, {
      callId: call.id,
      callSid: call.twilioCallSid,
      episodeId: call.episodeId,
      callerName: call.caller.name || call.caller.phoneNumber,
      currentRoom: roomName,
      status: call.status
    });
    
    console.log(`♻️ [CALL-FLOW] Restored call ${call.id} in room ${roomName}`);
  }

  /**
   * Get room name for a given call status
   */
  private getRoomNameForStatus(status: string, episodeId: string, callId: string): string {
    switch (status) {
      case 'queued':
      case 'ringing':
        return 'lobby';
      case 'screening':
        return `screening-${episodeId}-${callId}`;
      case 'approved':
      case 'on-hold':
        return `hold-${episodeId}`;
      case 'on-air':
        return `live-${episodeId}`;
      default:
        return 'lobby';
    }
  }

  /**
   * Clean up on shutdown
   */
  async shutdown(): Promise<void> {
    console.log('🛑 [CALL-FLOW] Shutting down...');
    
    // End all active calls gracefully
    const activeCallIds = Array.from(this.participants.keys());
    for (const callId of activeCallIds) {
      try {
        await this.endCall(callId);
      } catch (error) {
        console.error(`Failed to end call ${callId}:`, error);
      }
    }
    
    this.participants.clear();
    console.log('✅ [CALL-FLOW] Shutdown complete');
  }
}

export default SIPCallFlowManager;

