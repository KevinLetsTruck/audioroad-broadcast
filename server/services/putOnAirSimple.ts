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

export async function putOnAirSimple(callId: string): Promise<void> {
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

    // Get LIVE conference name
    const liveConferenceName = `live-${call.episodeId}`;
    const appUrl = process.env.APP_URL || 'https://audioroad-broadcast-production.up.railway.app';
    
    console.log(`🔄 [ON-AIR] Redirecting to LIVE conference: ${liveConferenceName}`);
    
    // Redirect call to join LIVE conference (UNMUTED for on-air)
    await twilioClient
      .calls(call.twilioCallSid)
      .update({
        twiml: `<?xml version="1.0" encoding="UTF-8"?>
          <Response>
            <Dial>
              <Conference 
                startConferenceOnEnter="false" 
                endConferenceOnExit="false"
                muted="false"
                beep="false"
                record="record-from-start"
                recordingStatusCallback="${appUrl}/api/twilio/participant-recording-status"
                recordingStatusCallbackMethod="POST">
                ${liveConferenceName}
              </Conference>
            </Dial>
          </Response>`
      });
    
    console.log(`✅ [ON-AIR] Redirected to LIVE conference (unmuted)`);
    
    // Update database
    await prisma.call.update({
      where: { id: callId },
      data: {
        participantState: 'on-air',
        twilioConferenceSid: liveConferenceSid,
        currentConferenceType: 'live',
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

