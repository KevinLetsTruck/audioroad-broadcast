/**
 * Participant Management Service
 * 
 * Controls participant states (on-air, hold, screening) via Twilio API
 */

import twilio from 'twilio';
import { PrismaClient } from '@prisma/client';
import { retryTwilioCall } from '../utils/retry.js';

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

      // CRITICAL: Use LIVE conference (not screening)
      // Approved callers are already in LIVE conference after moveParticipantToLiveConference()
      const { getLiveConferenceName } = await import('../utils/conferenceNames.js');
      const liveConference = getLiveConferenceName(call.episodeId);
      
      console.log(`📡 [PARTICIPANT] Putting on air: ${callId}`);
      console.log(`   Call Conference field: ${call.twilioConferenceSid}`);
      console.log(`   Target conference: ${liveConference} (LIVE show)`);
      console.log(`   CallSid: ${call.twilioCallSid}`);

      // Use LIVE conference name
      const conferenceSidToUse = liveConference;

      try {
        // First, check if conference exists and list participants
        const conference = await twilioClient
          .conferences(conferenceSidToUse)
          .fetch()
          .catch(() => {
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
            
            // Unmute AND take off hold so caller can hear conference directly
            await retryTwilioCall(
              () => twilioClient
                .conferences(conferenceSidToUse)
                .participants(call.twilioCallSid)
                .update({
                  muted: false,
                  hold: false, // Take off hold so they hear the conference (host/screener)
                  // Enable recording with transcription for this participant
                  // This records ONLY this participant's audio (not the whole conference)
                  coach: call.twilioCallSid, // Record in coach mode (participant only)
                  record: 'record-from-start',
                  recordingStatusCallback: `${process.env.APP_URL || 'https://audioroad-broadcast-production.up.railway.app'}/api/twilio/participant-recording-status`,
                  recordingStatusCallbackMethod: 'POST'
                } as any),
              'Put participant on air'
            );
            
            console.log(`✅ [TWILIO] Successfully unmuted participant and started recording`);
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

      // CRITICAL: Use LIVE conference name
      // Callers are in LIVE conference after being approved
      const { getLiveConferenceName } = await import('../utils/conferenceNames.js');
      const liveConference = getLiveConferenceName(call.episodeId);
      
      console.log(`⏸️ [PARTICIPANT] Putting on hold: ${callId}`);
      console.log(`   Using LIVE conference: ${liveConference}`);

      try {
        const appUrl = process.env.APP_URL || 'https://audioroad-broadcast-production.up.railway.app';
        
        // First ensure they're muted
        await retryTwilioCall(
          () => twilioClient
            .conferences(liveConference)
            .participants(call.twilioCallSid)
            .update({ muted: true }),
          'Mute participant for hold'
        );
        
        // Wait briefly for mute to register
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Then apply hold with music
        await retryTwilioCall(
          () => twilioClient
            .conferences(liveConference)
            .participants(call.twilioCallSid)
            .update({
              hold: true,
              holdUrl: `${appUrl}/api/twilio/wait-audio`,
              holdMethod: 'POST'
            } as any),
          'Put participant on hold'
        );
        
        console.log(`✅ [TWILIO] Participant on hold with music`);
      } catch (twilioError: any) {
        console.error(`❌ [TWILIO] Failed to put on hold:`, twilioError.message);
        console.error(`   Conference used: ${liveConference}`);
        console.error(`   CallSid: ${call.twilioCallSid}`);
        console.error(`   Error code: ${twilioError.code}`);
        // Don't throw - just log and update database anyway
      }

      // Update database
      await prisma.call.update({
        where: { id: callId },
        data: {
          participantState: 'hold',
          isMutedInConference: true,
          isOnHold: true // They are on hold with Radio.co stream
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

      // CRITICAL: Use LIVE conference name  
      // Callers on air are in LIVE conference
      const { getLiveConferenceName } = await import('../utils/conferenceNames.js');
      const liveConference = getLiveConferenceName(call.episodeId);
      
      console.log(`🔇 [PARTICIPANT] Muting: ${callId}`);
      console.log(`   Using LIVE conference: ${liveConference}`);

      try {
        // Mute in Twilio LIVE conference
        await retryTwilioCall(
          () => twilioClient
            .conferences(liveConference)
            .participants(call.twilioCallSid)
            .update({ muted: true }),
          'Mute participant'
        );
        
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

      if (!call) {
        throw new Error(`Call ${callId} not found`);
      }

      if (!call.twilioCallSid) {
        throw new Error(`Call ${callId} has no Twilio CallSid`);
      }

      // CRITICAL: Determine which conference the caller is in
      // - If status is 'screening', they're in SCREENING conference
      // - If status is 'approved' or 'on-air', they're in LIVE conference
      const { getScreeningConferenceName, getLiveConferenceName } = await import('../utils/conferenceNames.js');
      
      const isInScreening = call.status === 'screening';
      const conferenceSidToUse = isInScreening 
        ? getScreeningConferenceName(call.episodeId)
        : getLiveConferenceName(call.episodeId);
      
      console.log(`🔊 [PARTICIPANT] Unmuting: ${callId}`);
      console.log(`   Call status: ${call.status}`);
      console.log(`   Conference: ${conferenceSidToUse} (${isInScreening ? 'SCREENING' : 'LIVE'})`);
      console.log(`   CallSid: ${call.twilioCallSid}`);

      try {
        // First, check if conference exists and list participants
        const conference = await twilioClient
          .conferences(conferenceSidToUse)
          .fetch()
          .catch(() => {
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
            console.warn(`⚠️ Participant ${call.twilioCallSid} not in conference yet - they may still be connecting`);
            // Update database anyway - they'll be unmuted when they join
          } else {
            console.log(`✅ [CONFERENCE] Found participant: ${participant.callSid}, currently ${participant.muted ? 'MUTED' : 'UNMUTED'}`);
            
            // Unmute the participant using their call SID (silently)
            await retryTwilioCall(
              () => twilioClient
                .conferences(conferenceSidToUse)
                .participants(call.twilioCallSid)
                .update({ muted: false }),
              'Unmute participant'
            );
            
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
        caller: {
          select: {
            id: true,
            name: true,
            location: true,
            phoneNumber: true,
            totalCalls: true,
            isFavorite: true,
            sentiment: true
          }
        }
      },
      orderBy: {
        incomingAt: 'asc'
      }
    });

    // Group by state and include callerId for easy access
    const mapParticipant = (p: any) => ({
      ...p,
      callerId: p.caller.id // Add callerId at top level for frontend access
    });

    return {
      onAir: participants.filter(p => p.participantState === 'on-air').map(mapParticipant),
      onHold: participants.filter(p => p.participantState === 'hold').map(mapParticipant),
      screening: participants.filter(p => p.participantState === 'screening').map(mapParticipant),
      all: participants.map(mapParticipant)
    };
  }
}

