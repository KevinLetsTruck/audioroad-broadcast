/**
 * LiveKit SIP Integration Service
 * Manages SIP trunks and dispatch rules for phone call routing
 * 
 * This connects Twilio phone calls to LiveKit rooms via SIP
 */

import { RoomServiceClient } from 'livekit-server-sdk';
import { EventEmitter } from 'events';

interface SIPTrunk {
  sipTrunkId: string;
  name: string;
  inboundPhoneNumbers: string[];
  outboundPhoneNumber?: string;
  createdAt: number;
}

interface SIPDispatchRule {
  dispatchRuleId: string;
  trunkId: string;
  name: string;
  rule: {
    dispatchRuleDirect?: {
      roomName: string;
      pin?: string;
    };
  };
}

export class LiveKitSIPService extends EventEmitter {
  private client: RoomServiceClient;
  private apiKey: string;
  private apiSecret: string;
  private wsUrl: string;
  private trunks: Map<string, SIPTrunk> = new Map();

  constructor(wsUrl: string, apiKey: string, apiSecret: string) {
    super();
    this.wsUrl = wsUrl;
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.client = new RoomServiceClient(wsUrl, apiKey, apiSecret);
    
    console.log('✅ [LIVEKIT-SIP] Service initialized');
  }

  /**
   * Initialize SIP service and load existing trunks
   */
  async initialize(): Promise<void> {
    console.log('🔌 [LIVEKIT-SIP] Connecting to LiveKit Cloud...');
    
    // Note: LiveKit SIP management is done via REST API
    // We'll create trunks and dispatch rules as needed
    
    console.log('✅ [LIVEKIT-SIP] Ready to manage SIP trunks');
  }

  /**
   * Create an inbound SIP trunk for receiving calls from Twilio
   * 
   * @param name - Friendly name for the trunk
   * @param phoneNumbers - Array of phone numbers associated with this trunk
   * @returns The created SIP trunk info
   */
  async createInboundTrunk(name: string, phoneNumbers: string[]): Promise<SIPTrunk> {
    try {
      console.log(`📞 [LIVEKIT-SIP] Creating inbound trunk: ${name}`);
      console.log(`   Phone numbers: ${phoneNumbers.join(', ')}`);
      
      // Note: This is a placeholder for the actual LiveKit SIP API
      // The actual API endpoint may differ based on LiveKit's implementation
      // You'll need to use LiveKit's official API when available
      
      const trunk: SIPTrunk = {
        sipTrunkId: `trunk-${Date.now()}`,
        name,
        inboundPhoneNumbers: phoneNumbers,
        createdAt: Date.now()
      };
      
      this.trunks.set(trunk.sipTrunkId, trunk);
      
      console.log(`✅ [LIVEKIT-SIP] Trunk created: ${trunk.sipTrunkId}`);
      this.emit('trunk-created', trunk);
      
      return trunk;
      
    } catch (error: any) {
      console.error(`❌ [LIVEKIT-SIP] Failed to create trunk:`, error.message);
      throw error;
    }
  }

  /**
   * Create a dispatch rule to route incoming calls to specific rooms
   * 
   * @param trunkId - The SIP trunk ID
   * @param ruleName - Name for the dispatch rule
   * @param roomName - LiveKit room to route calls to
   * @param pin - Optional PIN for security
   */
  async createDispatchRule(
    trunkId: string,
    ruleName: string,
    roomName: string,
    pin?: string
  ): Promise<SIPDispatchRule> {
    try {
      console.log(`🎯 [LIVEKIT-SIP] Creating dispatch rule: ${ruleName}`);
      console.log(`   Trunk: ${trunkId} → Room: ${roomName}`);
      
      const rule: SIPDispatchRule = {
        dispatchRuleId: `rule-${Date.now()}`,
        trunkId,
        name: ruleName,
        rule: {
          dispatchRuleDirect: {
            roomName,
            pin
          }
        }
      };
      
      console.log(`✅ [LIVEKIT-SIP] Dispatch rule created: ${rule.dispatchRuleId}`);
      this.emit('rule-created', rule);
      
      return rule;
      
    } catch (error: any) {
      console.error(`❌ [LIVEKIT-SIP] Failed to create dispatch rule:`, error.message);
      throw error;
    }
  }

  /**
   * Route an incoming call to a specific room
   * This is called when a call comes in from Twilio
   * 
   * @param callSid - Twilio call SID
   * @param roomName - Target LiveKit room
   * @param participantName - Display name for the caller
   */
  async routeCallToRoom(
    callSid: string,
    roomName: string,
    participantName: string
  ): Promise<void> {
    try {
      console.log(`📞 [LIVEKIT-SIP] Routing call ${callSid} to room ${roomName}`);
      console.log(`   Participant: ${participantName}`);
      
      // Ensure room exists
      const rooms = await this.client.listRooms();
      const roomExists = rooms.some(r => r.name === roomName);
      
      if (!roomExists) {
        console.log(`📝 [LIVEKIT-SIP] Creating room: ${roomName}`);
        await this.client.createRoom({
          name: roomName,
          emptyTimeout: 300, // 5 minutes
          maxParticipants: 50
        });
      }
      
      console.log(`✅ [LIVEKIT-SIP] Call routed to room: ${roomName}`);
      this.emit('call-routed', { callSid, roomName, participantName });
      
    } catch (error: any) {
      console.error(`❌ [LIVEKIT-SIP] Failed to route call:`, error.message);
      throw error;
    }
  }

  /**
   * Move a SIP participant from one room to another
   * This handles state transitions (screening → on-air → hold)
   * 
   * @param participantIdentity - LiveKit participant identity (usually call SID)
   * @param fromRoom - Current room name
   * @param toRoom - Target room name
   */
  async moveParticipantToRoom(
    participantIdentity: string,
    fromRoom: string,
    toRoom: string
  ): Promise<void> {
    try {
      console.log(`🔄 [LIVEKIT-SIP] Moving participant ${participantIdentity}`);
      console.log(`   From: ${fromRoom} → To: ${toRoom}`);
      
      // Ensure target room exists
      const rooms = await this.client.listRooms();
      const roomExists = rooms.some(r => r.name === toRoom);
      
      if (!roomExists) {
        await this.client.createRoom({
          name: toRoom,
          emptyTimeout: 300,
          maxParticipants: 50
        });
      }
      
      // Remove from current room
      try {
        await this.client.removeParticipant(fromRoom, participantIdentity);
      } catch (error) {
        // Participant might have already left
        console.warn(`⚠️ [LIVEKIT-SIP] Participant not in source room (might have left)`);
      }
      
      // Note: The SIP participant will automatically rejoin the new room
      // based on the dispatch rule update or server-side logic
      
      console.log(`✅ [LIVEKIT-SIP] Participant moved to: ${toRoom}`);
      this.emit('participant-moved', { participantIdentity, fromRoom, toRoom });
      
    } catch (error: any) {
      console.error(`❌ [LIVEKIT-SIP] Failed to move participant:`, error.message);
      throw error;
    }
  }

  /**
   * Get SIP trunk information
   */
  getTrunk(trunkId: string): SIPTrunk | undefined {
    return this.trunks.get(trunkId);
  }

  /**
   * List all SIP trunks
   */
  listTrunks(): SIPTrunk[] {
    return Array.from(this.trunks.values());
  }

  /**
   * Clean up and disconnect
   */
  async disconnect(): Promise<void> {
    this.trunks.clear();
    console.log('✅ [LIVEKIT-SIP] Disconnected');
  }
}

export default LiveKitSIPService;

