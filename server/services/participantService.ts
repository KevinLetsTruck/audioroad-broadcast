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

      console.log(`📡 [PARTICIPANT] Putting on air: ${callId}`);
      console.log(`   Conference: ${call.twilioConferenceSid}`);
      console.log(`   CallSid: ${call.twilioCallSid}`);

      try {
        // First, check if conference exists and list participants
        const conference = await twilioClient
          .conferences(call.twilioConferenceSid)
          .fetch()
          .catch((err) => {
            console.log(`⚠️ [CONFERENCE] Conference not found, it will be created when participant joins`);
            return null;
          });

        if (conference) {
          console.log(`📞 [CONFERENCE] Found conference: ${conference.friendlyName}, Status: ${conference.status}`);
          
          // List all participants to find the right one
          const participants = await twilioClient
            .conferences(call.twilioConferenceSid)
            .participants
            .list();
          
          console.log(`👥 [CONFERENCE] ${participants.length} participants in conference`);
          participants.forEach((p: any) => {
            console.log(`   - ${p.callSid}: ${p.muted ? 'MUTED' : 'UNMUTED'}`);
          });
          
          // Find participant by CallSid
          const participant = participants.find((p: any) => p.callSid === call.twilioCallSid);
          
          if (!participant) {
            throw new Error(`Participant ${call.twilioCallSid} not found in conference ${call.twilioConferenceSid}`);
          }
          
          console.log(`✅ [CONFERENCE] Found participant: ${participant.callSid}`);
          
          // Unmute the participant using their call SID
          await twilioClient
            .conferences(call.twilioConferenceSid)
            .participants(call.twilioCallSid)
            .update({
              muted: false,
              hold: false
            });
          
          console.log(`✅ [TWILIO] Successfully unmuted participant in conference`);
        } else {
          console.warn(`⚠️ [CONFERENCE] Conference doesn't exist yet - participant will be unmuted when they join`);
          // Just update database state - they'll be unmuted when conference is created
        }
      } catch (twilioError: any) {
        console.error(`❌ [TWILIO] Conference API error:`, twilioError.message);
        console.error(`   Status: ${twilioError.status}, Code: ${twilioError.code}`);
        throw new Error(`Twilio conference error: ${twilioError.message}`);
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
        where: { id: callId }
      });

      if (!call || !call.twilioConferenceSid) {
        throw new Error('Call or conference not found');
      }

      console.log(`⏸️ [PARTICIPANT] Putting on hold: ${callId}`);

      // Mute in Twilio conference (can still hear)
      await twilioClient
        .conferences(call.twilioConferenceSid)
        .participants(call.twilioCallSid)
        .update({
          muted: true,
          hold: false // Not true hold with music, just muted
        });

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
        where: { id: callId }
      });

      if (!call || !call.twilioConferenceSid) {
        throw new Error('Call or conference not found');
      }

      console.log(`🔇 [PARTICIPANT] Muting: ${callId}`);

      // Mute in Twilio conference
      await twilioClient
        .conferences(call.twilioConferenceSid)
        .participants(call.twilioCallSid)
        .update({
          muted: true
        });

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
        where: { id: callId }
      });

      if (!call || !call.twilioConferenceSid) {
        throw new Error('Call or conference not found');
      }

      console.log(`🔊 [PARTICIPANT] Unmuting: ${callId}`);

      // Unmute in Twilio conference
      await twilioClient
        .conferences(call.twilioConferenceSid)
        .participants(call.twilioCallSid)
        .update({
          muted: false
        });

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

