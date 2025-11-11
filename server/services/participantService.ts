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

      // CRITICAL: Use actual LIVE conference SID from database
      // If not available, wait and retry (race condition: host just joined, webhook hasn't fired yet)
      let liveConferenceSid = call.episode?.liveConferenceSid;
      
      if (!liveConferenceSid) {
        console.log(`⏳ [PARTICIPANT] No LIVE SID yet, waiting for participant-join webhook...`);
        
        // Wait up to 3 seconds for webhook to update database
        // Now using participant-join webhook which fires IMMEDIATELY
        for (let i = 0; i < 6; i++) {
          await new Promise(resolve => setTimeout(resolve, 500)); // Check every 500ms
          
          // Re-fetch episode to get updated SID
          const updatedEpisode = await prisma.episode.findUnique({
            where: { id: call.episodeId }
          });
          
          if (updatedEpisode?.liveConferenceSid) {
            liveConferenceSid = updatedEpisode.liveConferenceSid;
            console.log(`✅ [PARTICIPANT] Got LIVE SID after ${(i + 1) * 500}ms: ${liveConferenceSid}`);
            break;
          }
          
          if (i === 0 || i === 2 || i === 5) {
            console.log(`   Waiting for LIVE conference SID... (${(i + 1) * 500}ms)`);
          }
        }
        
        if (!liveConferenceSid) {
          console.error(`❌ [PARTICIPANT] Episode ${call.episodeId} has no LIVE conference SID after 3 seconds!`);
          console.error(`   Host may not have connected to conference yet`);
          throw new Error(`Episode ${call.episodeId} has no live conference - host must connect first`);
        }
      }
      
      console.log(`📡 [PARTICIPANT] Putting on air: ${callId}`);
      console.log(`   LIVE Conference SID: ${liveConferenceSid}`);
      console.log(`   CallSid: ${call.twilioCallSid}`);
      console.log(`   Current conference: ${call.currentConferenceType || 'unknown'}`);
      
      // If caller is still in SCREENING, move them to LIVE first
      if (call.currentConferenceType === 'screening') {
        console.log(`🔄 [PARTICIPANT] Moving from SCREENING to LIVE first...`);
        try {
          const { moveParticipantToLiveConference } = await import('../services/conferenceService.js');
          await moveParticipantToLiveConference(call.twilioCallSid, call.episodeId);
          
          // Re-fetch call to get updated conference SID (moveParticipantToLiveConference updates it)
          call = await prisma.call.findUnique({
            where: { id: callId },
            include: {
              caller: true,
              episode: true
            }
          }) as any;
          
          if (!call) {
            throw new Error(`Call ${callId} not found after move`);
          }
          
          // Update liveConferenceSid to use the new SID from call record
          liveConferenceSid = call.twilioConferenceSid!;
          
          console.log(`✅ [PARTICIPANT] Moved to LIVE, using SID: ${liveConferenceSid}`);
        } catch (moveError: any) {
          console.error(`❌ [PARTICIPANT] Failed to move to LIVE:`, moveError.message);
          // Continue anyway - they might already be there
        }
      }

      try {
        // First, check if conference exists and list participants
        const conference = await twilioClient
          .conferences(liveConferenceSid)
          .fetch()
          .catch(() => {
            console.log(`⚠️ [CONFERENCE] Conference not found: ${liveConferenceSid}`);
            return null;
          });

        if (conference) {
          console.log(`📞 [CONFERENCE] Found conference: ${conference.sid}, Status: ${conference.status}`);
          
          // List all participants to find the right one
          const participants = await twilioClient
            .conferences(liveConferenceSid)
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
                .conferences(liveConferenceSid)
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
          console.warn(`⚠️ [CONFERENCE] Conference ${liveConferenceSid} doesn't exist yet`);
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

      // CRITICAL: Use LIVE conference
      const { getLiveConferenceName } = await import('../utils/conferenceNames.js');
      const liveConference = getLiveConferenceName(call.episodeId);
      
      console.log(`⏸️ [PARTICIPANT] Putting on hold: ${callId}`);
      console.log(`   Using: ${liveConference} (LIVE)`);

      try {
        const appUrl = process.env.APP_URL || 'https://audioroad-broadcast-production.up.railway.app';
        
        // Mute and apply hold in LIVE conference
        await retryTwilioCall(
          () => twilioClient
            .conferences(liveConference)
            .participants(call.twilioCallSid)
            .update({ muted: true }),
          'Mute participant'
        );
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
        await retryTwilioCall(
          () => twilioClient
            .conferences(liveConference)
            .participants(call.twilioCallSid)
            .update({
              hold: true,
              holdUrl: `${appUrl}/api/twilio/wait-audio`,
              holdMethod: 'POST'
            } as any),
          'Put on hold'
        );
        
        console.log(`✅ [TWILIO] On hold in LIVE`);
      } catch (twilioError: any) {
        console.error(`❌ [TWILIO] Failed:`, twilioError.message);
        console.error(`   Conf: ${liveConference}, Call: ${call.twilioCallSid}`);
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

      // CRITICAL: Use LIVE conference
      const { getLiveConferenceName } = await import('../utils/conferenceNames.js');
      const liveConference = getLiveConferenceName(call.episodeId);
      
      console.log(`🔇 [PARTICIPANT] Muting: ${callId}`);
      console.log(`   Using: ${liveConference} (LIVE)`);

      try {
        // Mute in LIVE conference
        await retryTwilioCall(
          () => twilioClient
            .conferences(liveConference)
            .participants(call.twilioCallSid)
            .update({ muted: true }),
          'Mute'
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

      // CRITICAL: Use the CALL's conference SID (stored when they joined)
      // NOT the episode's SID (which may be from an old conference)
      const conferenceSid = call.twilioConferenceSid;
      const isScreening = call.status === 'screening';
      
      if (!conferenceSid) {
        console.error(`❌ [PARTICIPANT] Call ${callId} has no conference SID!`);
        console.error(`   This means the call didn't join a conference properly`);
        throw new Error(`Call ${callId} has no conference SID`);
      }
      
      console.log(`🔊 [PARTICIPANT] Unmuting: ${callId}`);
      console.log(`   Status: ${call.status}`);
      console.log(`   Conference SID: ${conferenceSid} (${isScreening ? 'SCREENING' : 'LIVE'})`);
      console.log(`   CallSid: ${call.twilioCallSid}`);

      try {
        // First, check if conference exists and list participants
        const conference = await twilioClient
          .conferences(conferenceSid)
          .fetch()
          .catch(() => {
            console.log(`⚠️ [CONFERENCE] Conference not found: ${conferenceSid}`);
            return null;
          });

        if (conference) {
          console.log(`📞 [CONFERENCE] Found conference: ${conference.sid}, Status: ${conference.status}`);
          
          // List all participants to find the right one
          const participants = await twilioClient
            .conferences(conferenceSid)
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
                .conferences(conferenceSid)
                .participants(call.twilioCallSid)
                .update({ muted: false }),
              'Unmute participant'
            );
            
            console.log(`✅ [TWILIO] Successfully unmuted participant in conference`);
          }
        } else {
          console.warn(`⚠️ [CONFERENCE] Conference ${conferenceSid} doesn't exist yet`);
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

