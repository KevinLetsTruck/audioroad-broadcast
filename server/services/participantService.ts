/**
 * Participant Management Service
 * 
 * Controls participant states (on-air, hold, screening) via Twilio API
 */

import twilio from 'twilio';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export class ParticipantService {
  /**
   * Put participant ON AIR (unmute in conference)
   */
  static async putOnAir(callId: string): Promise<void> {
    try {
      const call = await prisma.call.findUnique({
        where: { id: callId },
        include: { episode: true }
      });

      if (!call) {
        throw new Error(`Call ${callId} not found`);
      }

      if (!call.twilioConferenceSid) {
        throw new Error(`Call ${callId} has no conference SID`);
      }

      if (!call.twilioCallSid) {
        throw new Error(`Call ${callId} has no Twilio CallSid`);
      }

      // Get the actual Twilio Conference SID from the episode (not the friendly name)
      const actualConferenceSid = call.episode?.twilioConferenceSid;
      
      console.log(`📡 [PARTICIPANT] Putting on air: ${callId}`);
      console.log(`   Call Conference field: ${call.twilioConferenceSid}`);
      console.log(`   Episode Conference SID: ${actualConferenceSid}`);
      console.log(`   CallSid: ${call.twilioCallSid}`);

      // Use episode's conference SID if available (it has the real CF... SID)
      const conferenceSidToUse = actualConferenceSid || call.twilioConferenceSid;

      try {
        // First, check if conference exists and list participants
        const conference = await twilioClient
          .conferences(conferenceSidToUse)
          .fetch()
          .catch((err) => {
            console.log(`⚠️ [CONFERENCE] Conference not found: ${conferenceSidToUse}`);
            return null;
          });

        if (conference) {
          console.log(`📞 [CONFERENCE] Found conference: ${conference.sid}, Status: ${conference.status}`);
          
          // List all participants to find the right one
          const participants = await twilioClient
            .conferences(conferenceSidToUse)
            .participants
            .list();
          
          console.log(`👥 [CONFERENCE] ${participants.length} participants in conference`);
          participants.forEach((p: any) => {
            console.log(`   - ${p.callSid}: ${p.muted ? 'MUTED' : 'UNMUTED'}`);
          });
          
          // Find participant by CallSid
          const participant = participants.find((p: any) => p.callSid === call.twilioCallSid);
          
          if (!participant) {
            console.warn(`⚠️ Participant ${call.twilioCallSid} not in conference yet`);
            // Just update database - they'll be unmuted when they join
          } else {
            console.log(`✅ [CONFERENCE] Found participant: ${participant.callSid}`);
            
            // Unmute the participant using their call SID
            await twilioClient
              .conferences(conferenceSidToUse)
              .participants(call.twilioCallSid)
              .update({
                muted: false,
                hold: false
              });
            
            console.log(`✅ [TWILIO] Successfully unmuted participant in conference`);
          }
        } else {
          console.warn(`⚠️ [CONFERENCE] Conference ${conferenceSidToUse} doesn't exist yet`);
          // Just update database state
        }
      } catch (twilioError: any) {
        console.error(`❌ [TWILIO] Conference API error:`, twilioError.message);
        console.error(`   Status: ${twilioError.status}, Code: ${twilioError.code}`);
        // Don't throw - just log and continue with database update
      }

      // Update database
      await prisma.call.update({
        where: { id: callId },
        data: {
          participantState: 'on-air',
          isMutedInConference: false,
          isOnHold: false,
          onAirAt: call.onAirAt || new Date() // Set if not already set
        }
      });

      console.log(`✅ [PARTICIPANT] ${callId} is now ON AIR`);
    } catch (error) {
      console.error(`❌ [PARTICIPANT] Failed to put on air:`, error);
      throw error;
    }
  }

  /**
   * Put participant ON HOLD (muted but can hear)
   */
  static async putOnHold(callId: string): Promise<void> {
    try {
      const call = await prisma.call.findUnique({
        where: { id: callId },
        include: { episode: true }
      });

      if (!call || !call.twilioConferenceSid) {
        throw new Error('Call or conference not found');
      }

      // Use episode's real conference SID (CF...)
      const conferenceSid = call.episode?.twilioConferenceSid || call.twilioConferenceSid;
      console.log(`⏸️ [PARTICIPANT] Putting on hold: ${callId}`);
      console.log(`   Using conference SID: ${conferenceSid}`);

      try {
        // Mute in Twilio conference (can still hear)
        await twilioClient
          .conferences(conferenceSid)
          .participants(call.twilioCallSid)
          .update({
            muted: true,
            hold: false // Not true hold with music, just muted
          });
        
        console.log(`✅ [TWILIO] Successfully muted participant`);
      } catch (twilioError: any) {
        console.error(`❌ [TWILIO] Failed to mute in conference:`, twilioError.message);
        // Don't throw - just log and update database anyway
      }

      // Update database
      await prisma.call.update({
        where: { id: callId },
        data: {
          participantState: 'hold',
          isMutedInConference: true,
          isOnHold: false
        }
      });

      console.log(`✅ [PARTICIPANT] ${callId} is now ON HOLD`);
    } catch (error) {
      console.error(`❌ [PARTICIPANT] Failed to put on hold:`, error);
      throw error;
    }
  }

  /**
   * Put participant in SCREENING (muted, private with screener)
   */
  static async putInScreening(callId: string): Promise<void> {
    try {
      const call = await prisma.call.findUnique({
        where: { id: callId }
      });

      if (!call) {
        throw new Error('Call not found');
      }

      console.log(`🔍 [PARTICIPANT] Moving to screening: ${callId}`);

      // Update database (Twilio handles screening separately)
      await prisma.call.update({
        where: { id: callId },
        data: {
          participantState: 'screening',
          status: 'screening'
        }
      });

      console.log(`✅ [PARTICIPANT] ${callId} moved to screening`);
    } catch (error) {
      console.error(`❌ [PARTICIPANT] Failed to move to screening:`, error);
      throw error;
    }
  }

  /**
   * Mute participant in conference
   */
  static async muteParticipant(callId: string): Promise<void> {
    try {
      const call = await prisma.call.findUnique({
        where: { id: callId },
        include: { episode: true }
      });

      if (!call || !call.twilioConferenceSid) {
        throw new Error('Call or conference not found');
      }

      // Use episode's real conference SID (CF...)
      const conferenceSid = call.episode?.twilioConferenceSid || call.twilioConferenceSid;
      console.log(`🔇 [PARTICIPANT] Muting: ${callId}`);
      console.log(`   Using conference SID: ${conferenceSid}`);

      try {
        // Mute in Twilio conference
        await twilioClient
          .conferences(conferenceSid)
          .participants(call.twilioCallSid)
          .update({
            muted: true
          });
        
        console.log(`✅ [TWILIO] Successfully muted participant`);
      } catch (twilioError: any) {
        console.error(`❌ [TWILIO] Failed to mute:`, twilioError.message);
        // Don't throw - just log and update database anyway
      }

      // Update database
      await prisma.call.update({
        where: { id: callId },
        data: {
          isMutedInConference: true
        }
      });

      console.log(`✅ [PARTICIPANT] ${callId} is now MUTED`);
    } catch (error) {
      console.error(`❌ [PARTICIPANT] Failed to mute:`, error);
      throw error;
    }
  }

  /**
   * Unmute participant in conference
   */
  static async unmuteParticipant(callId: string): Promise<void> {
    try {
      const call = await prisma.call.findUnique({
        where: { id: callId },
        include: { episode: true }
      });

      if (!call || !call.twilioConferenceSid) {
        throw new Error('Call or conference not found');
      }

      // Use episode's real conference SID (CF...)
      const conferenceSid = call.episode?.twilioConferenceSid || call.twilioConferenceSid;
      console.log(`🔊 [PARTICIPANT] Unmuting: ${callId}`);
      console.log(`   Using conference SID: ${conferenceSid}`);

      try {
        // Unmute in Twilio conference
        await twilioClient
          .conferences(conferenceSid)
          .participants(call.twilioCallSid)
          .update({
            muted: false
          });
        
        console.log(`✅ [TWILIO] Successfully unmuted participant`);
      } catch (twilioError: any) {
        console.error(`❌ [TWILIO] Failed to unmute:`, twilioError.message);
        // Don't throw - just log and update database anyway
      }

      // Update database
      await prisma.call.update({
        where: { id: callId },
        data: {
          isMutedInConference: false
        }
      });

      console.log(`✅ [PARTICIPANT] ${callId} is now UNMUTED`);
    } catch (error) {
      console.error(`❌ [PARTICIPANT] Failed to unmute:`, error);
      throw error;
    }
  }

  /**
   * Get all active participants for an episode
   */
  static async getActiveParticipants(episodeId: string) {
    const participants = await prisma.call.findMany({
      where: {
        episodeId,
        endedAt: null,
        status: {
          notIn: ['completed', 'rejected', 'missed']
        }
      },
      include: {
        caller: true
      },
      orderBy: {
        incomingAt: 'asc'
      }
    });

    // Group by state
    return {
      onAir: participants.filter(p => p.participantState === 'on-air'),
      onHold: participants.filter(p => p.participantState === 'hold'),
      screening: participants.filter(p => p.participantState === 'screening'),
      all: participants
    };
  }
}

