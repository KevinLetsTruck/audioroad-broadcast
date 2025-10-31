import twilioClient from './twilioService.js';

const client = twilioClient;
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Create conference for an episode
 * Note: Twilio conferences are created dynamically when first participant joins
 * This function returns the conference name that will be used
 */
export async function createEpisodeConference(episodeId: string) {
  const conferenceName = `episode-${episodeId}`;
  
  console.log(`📞 [CONFERENCE] Conference will be created on first join: ${conferenceName}`);
  
  // Twilio conferences are created automatically when first participant joins via TwiML
  // We just return the conference name/SID that will be used
  return {
    sid: conferenceName,
    friendlyName: conferenceName,
    status: 'pending' // Will be 'in-progress' once first participant joins
  };
  
  // Note: Conferences are managed via TwiML <Conference> verb in voice webhooks
  // The actual Twilio conference object is created server-side automatically
}

/**
 * Add caller to conference as "coach" (listen-only)
 * They hear the show but can't speak
 */
export async function addCallerToHoldConference(
  callSid: string,
  episodeId: string
) {
  if (!client) throw new Error('Twilio not configured');
  const conferenceName = `episode-${episodeId}`;

  try {
    const participant = await client
      .conferences(conferenceName)
      .participants
      .create({
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: callSid,
        earlyMedia: true,
        endConferenceOnExit: false,
        beep: false as any,
        // Coach mode: can hear but not speak
        coaching: 'true' as any,
        statusCallback: `${process.env.APP_URL}/api/twilio/participant-status`,
        statusCallbackMethod: 'POST',
        statusCallbackEvent: ['joined', 'left', 'muted', 'unmuted']
      });

    console.log(`Caller ${callSid} added to hold queue (coach mode)`);

    // Update call record
    await prisma.call.update({
      where: { twilioCallSid: callSid },
      data: {
        twilioConferenceSid: conferenceName,
        status: 'queued'
      }
    });

    return participant;
  } catch (error) {
    console.error('Error adding caller to hold conference:', error);
    throw error;
  }
}

/**
 * Promote caller from coach to participant (goes live on-air)
 * Plays tone to indicate they're live
 */
export async function promoteCallerToLive(
  callSid: string,
  episodeId: string
) {
  if (!client) throw new Error('Twilio not configured');
  const conferenceName = `episode-${episodeId}`;

  try {
    // NO TONE - Silent transition to live (removed annoying beep!)
    // await playLiveTone(callSid); // DISABLED - no more annoying tones!

    // Update participant to remove coach mode
    const participant = await client
      .conferences(conferenceName)
      .participants(callSid)
      .update({
        coaching: 'false' as any, // Can now speak
        hold: 'false' as any,
        muted: 'false' as any
      });

    console.log(`Caller ${callSid} promoted to live`);

    // Update call record
    await prisma.call.update({
      where: { twilioCallSid: callSid },
      data: {
        status: 'on-air',
        onAirAt: new Date()
      }
    });

    return participant;
  } catch (error) {
    console.error('Error promoting caller to live:', error);
    throw error;
  }
}

/**
 * Play "you're now live" tone to caller
 * 
 * DISABLED - No more annoying tones!
 * If you want to re-enable, uncomment the call in promoteCallerToLive()
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function playLiveTone(_callSid: string) {
  // DISABLED - Silent transitions only
  return;
  
  /* ORIGINAL CODE (disabled):
  if (!client) return;
  try {
    // Play a simple beep tone (you can replace with custom audio file)
    await client.calls(callSid).update({
      twiml: `
        <Response>
          <Play>https://api.twilio.com/cowbell.mp3</Play>
        </Response>
      `
    });
  } catch (error) {
    console.error('Error playing live tone:', error);
  }
  */
}

/**
 * Remove participant from conference
 */
export async function removeFromConference(
  callSid: string,
  episodeId: string
) {
  if (!client) throw new Error('Twilio not configured');
  const conferenceName = `episode-${episodeId}`;

  try {
    await client
      .conferences(conferenceName)
      .participants(callSid)
      .remove();

    console.log(`Caller ${callSid} removed from conference`);

    await prisma.call.update({
      where: { twilioCallSid: callSid },
      data: {
        status: 'completed',
        endedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error removing from conference:', error);
    throw error;
  }
}

/**
 * Add host to conference
 */
export async function addHostToConference(
  hostCallSid: string,
  episodeId: string
) {
  if (!client) throw new Error('Twilio not configured');
  const conferenceName = `episode-${episodeId}`;

  try {
    const participant = await client
      .conferences(conferenceName)
      .participants
      .create({
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: hostCallSid,
        earlyMedia: true,
        startConferenceOnEnter: 'true' as any,
        endConferenceOnExit: 'true' as any, // Host ending ends conference
        beep: false as any  // DISABLE ALL BEEPS - Twilio types wrong, needs boolean not string
      });

    console.log(`Host added to conference ${conferenceName}`);
    return participant;
  } catch (error) {
    console.error('Error adding host to conference:', error);
    throw error;
  }
}

/**
 * End conference by SID
 */
export async function endConference(conferenceSid: string) {
  if (!client) throw new Error('Twilio not configured');

  try {
    console.log(`🎙️ [CONFERENCE] Ending conference: ${conferenceSid}`);
    
    // Update conference to completed status
    const conference = await client
      .conferences(conferenceSid)
      .update({ status: 'completed' });

    console.log(`✅ [CONFERENCE] Conference ended: ${conferenceSid}`);

    return conference;
  } catch (error: any) {
    // If conference doesn't exist or already ended, that's okay
    if (error.code === 20404) {
      console.log(`⚠️ [CONFERENCE] Conference not found (may have already ended): ${conferenceSid}`);
      return null;
    }
    console.error('❌ [CONFERENCE] Error ending conference:', error);
    throw error;
  }
}

/**
 * End conference (when episode ends)
 */
export async function endEpisodeConference(episodeId: string) {
  if (!client) throw new Error('Twilio not configured');
  const conferenceName = `episode-${episodeId}`;

  try {
    const conference = await client.conferences(conferenceName).fetch();
    
    if (conference.status !== 'completed') {
      await client.conferences(conferenceName).update({
        status: 'completed'
      });

      console.log(`Conference ${conferenceName} ended`);
    }

    // Update all remaining calls
    await prisma.call.updateMany({
      where: {
        episodeId,
        status: { in: ['queued', 'on-air'] }
      },
      data: {
        status: 'completed',
        endedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error ending conference:', error);
    throw error;
  }
}

