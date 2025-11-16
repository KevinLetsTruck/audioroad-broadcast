/**
 * Simplified Put On Air - Stream-based Hold System
 * Caller is either listening to stream OR in screening
 * We redirect them to join LIVE conference (unmuted)
 */
import { PrismaClient } from '@prisma/client';
import twilio from 'twilio';

const prisma = new PrismaClient();
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function putOnAirSimple(callId: string, mediaBridge?: any, sipService?: any): Promise<void> {
  try {
    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: { episode: true }
    });

    if (!call || !call.twilioCallSid) {
      throw new Error(`Call ${callId} not found or has no Twilio CallSid`);
    }

    console.log(`📡 [ON-AIR] Putting ${callId} on air`);
    console.log(`   CallSid: ${call.twilioCallSid}`);
    console.log(`   Current status: ${call.status}`);

    // Check if this is a SIP call (LiveKit participant ID starts with PA_)
    const isSIPCall = call.twilioCallSid.startsWith('PA_');
    
    // Check if using WebRTC (LiveKit)
    const useWebRTC = !!process.env.LIVEKIT_WS_URL && !!mediaBridge;

    if (isSIPCall) {
      console.log(`📞 [ON-AIR] SIP call detected - moving LiveKit participant to live room`);
      
      if (!sipService) {
        throw new Error('SIP service not available - cannot move SIP participant');
      }
      
      const liveRoom = `live-${call.episodeId}`;
      
      // Move SIP participant from lobby to live room
      console.log(`🔄 [ON-AIR] Moving ${call.twilioCallSid} from lobby to ${liveRoom}`);
      
      // Move the participant to the live room
      await sipService.moveParticipantToRoom(call.twilioCallSid, 'lobby', liveRoom);
      
      console.log(`✅ [ON-AIR] SIP caller moved to live room: ${liveRoom}`);
      
      // Update database
      await prisma.call.update({
        where: { id: callId },
        data: {
          participantState: 'on-air',
          status: 'on-air',
          onAirAt: call.onAirAt || new Date()
        }
      });
      
      console.log(`✅ [ON-AIR] ${callId} is now ON AIR (SIP/LiveKit)`);
      return;
    }
    
    if (useWebRTC) {
      console.log(`🔌 [ON-AIR] Using WebRTC - moving Media Stream to live room`);
      
      const liveRoom = `live-${call.episodeId}`;
      await mediaBridge.moveStreamToRoom(call.twilioCallSid, liveRoom);
      
      console.log(`✅ [ON-AIR] Caller moved to live room: ${liveRoom}`);
      
      // Update database
      await prisma.call.update({
        where: { id: callId },
        data: {
          participantState: 'on-air',
          status: 'on-air',
          onAirAt: call.onAirAt || new Date()
        }
      });
      
      console.log(`✅ [ON-AIR] ${callId} is now ON AIR (WebRTC)`);
      return;
    }

    // Otherwise use Twilio conference system (legacy)
    console.log(`📞 [ON-AIR] Using Twilio conferences (legacy)`);

    // Get LIVE conference SID (with retry for race condition)
    let liveConferenceSid = call.episode?.liveConferenceSid;
    
    if (!liveConferenceSid) {
      console.log(`⏳ [ON-AIR] Waiting for LIVE conference SID...`);
      
      for (let i = 0; i < 6; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const updatedEpisode = await prisma.episode.findUnique({
          where: { id: call.episodeId }
        });
        
        if (updatedEpisode?.liveConferenceSid) {
          liveConferenceSid = updatedEpisode.liveConferenceSid;
          console.log(`✅ [ON-AIR] Got LIVE SID: ${liveConferenceSid}`);
          break;
        }
      }
      
      if (!liveConferenceSid) {
        throw new Error(`Episode ${call.episodeId} has no LIVE conference - host must connect first`);
      }
    }

    // Check if caller is in screening - if so, move them to LIVE first
    if (call.currentConferenceType === 'screening' || call.status === 'approved') {
      console.log(`🔄 [ON-AIR] Moving caller from SCREENING to LIVE conference...`);
      
      const { moveParticipantToLiveConference } = await import('../services/conferenceService.js');
      await moveParticipantToLiveConference(call.twilioCallSid, call.episodeId);
      
      console.log(`✅ [ON-AIR] Moved to LIVE conference`);
      
      // Update database with new conference info
      await prisma.call.update({
        where: { id: callId },
        data: {
          twilioConferenceSid: liveConferenceSid,
          currentConferenceType: 'live'
        }
      });
    }
    
    // Now unmute them in LIVE conference (whether they just moved or were already there)
    console.log(`🔊 [ON-AIR] Unmuting in LIVE conference...`);
    
    await twilioClient
      .conferences(liveConferenceSid)
      .participants(call.twilioCallSid)
      .update({
        muted: false,
        hold: false
      } as any);
    
    console.log(`✅ [ON-AIR] Unmuted in LIVE`);
    
    // Update database
    await prisma.call.update({
      where: { id: callId },
      data: {
        participantState: 'on-air',
        isMutedInConference: false,
        isOnHold: false,
        onAirAt: call.onAirAt || new Date()
      }
    });

    console.log(`✅ [ON-AIR] ${callId} is now ON AIR`);
    
  } catch (error) {
    console.error(`❌ [ON-AIR] Failed:`, error);
    throw error;
  }
}

