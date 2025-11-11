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
 * Add caller to conference (muted, no coaching mode to avoid beeps)
 * They join muted - screener/host will unmute when ready
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
        // Use silent audio URL as workaround - beep:false doesn't always work
        beep: 'http://twimlets.com/echo?Twiml=%3CResponse%3E%3C%2FResponse%3E' as any,
        // NO COACHING MODE - it causes beeps when changed!
        // Use regular mute instead for silent transitions
        muted: true,
        statusCallback: `${process.env.APP_URL}/api/twilio/participant-status`,
        statusCallbackMethod: 'POST',
        statusCallbackEvent: ['joined', 'left', 'muted', 'unmuted']
      });

    console.log(`Caller ${callSid} added to conference (muted, no coaching mode)`);

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
 * Promote caller to live (unmute only, no coaching mode changes to avoid beeps)
 * Silent transition - no state changes that trigger tones
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

    // Update participant - just unmute (NO coaching mode changes = NO beeps!)
    const participant = await client
      .conferences(conferenceName)
      .participants(callSid)
      .update({
        muted: false,
        hold: false
      });

    console.log(`Caller ${callSid} promoted to live (unmuted silently)`);

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
  
  try {
    // CRITICAL: Must use actual conference SID from episode, not friendly name
    const episode = await prisma.episode.findUnique({
      where: { id: episodeId }
    });
    
    if (!episode?.twilioConferenceSid) {
      console.warn(`⚠️ [CONFERENCE] Episode ${episodeId} has no conference SID - participant may have already left`);
      // Just update database
      await prisma.call.update({
        where: { twilioCallSid: callSid },
        data: {
          status: 'completed',
          endedAt: new Date()
        }
      });
      return;
    }
    
    const conferenceSid = episode.twilioConferenceSid;
    console.log(`📴 [CONFERENCE] Removing participant ${callSid} from conference ${conferenceSid}`);

    await client
      .conferences(conferenceSid)
      .participants(callSid)
      .remove();

    console.log(`✅ [CONFERENCE] Caller ${callSid} removed from conference`);

    await prisma.call.update({
      where: { twilioCallSid: callSid },
      data: {
        status: 'completed',
        endedAt: new Date()
      }
    });
  } catch (error: any) {
    console.error('❌ [CONFERENCE] Error removing from conference:', error);
    console.error(`   Error code: ${error.code}, Status: ${error.status}`);
    // Don't throw - participant may have already left
    // Just update database
    try {
      await prisma.call.update({
        where: { twilioCallSid: callSid },
        data: {
          status: 'completed',
          endedAt: new Date()
        }
      });
    } catch (dbError) {
      console.error('❌ [CONFERENCE] Failed to update database:', dbError);
    }
  }
}

/**
 * Move participant from SCREENING conference to LIVE conference
 * This happens when a call is approved - moves from private screening to live show
 */
export async function moveParticipantToLiveConference(
  callSid: string,
  episodeId: string
): Promise<void> {
  if (!client) throw new Error('Twilio not configured');
  
  try {
    const { getScreeningConferenceName, getLiveConferenceName } = await import('../utils/conferenceNames.js');
    const screeningConference = getScreeningConferenceName(episodeId);
    const liveConference = getLiveConferenceName(episodeId);
    
    console.log(`🔄 [CONFERENCE] Moving participant ${callSid}`);
    console.log(`   From: ${screeningConference} (screening)`);
    console.log(`   To: ${liveConference} (live show)`);
    
    // Step 1: Get the actual conference SIDs (not friendly names)
    let screeningConferenceSid = screeningConference;
    let liveConferenceSid = liveConference;
    
    try {
      // Fetch episode to get actual SIDs if available
      const episode = await prisma.episode.findUnique({
        where: { id: episodeId }
      });
      
      if (episode?.twilioConferenceSid) {
        // For now, we'll use friendly names and Twilio will resolve them
        // In future, we can store separate SIDs in database
        console.log(`   Using friendly names (Twilio will resolve)`);
      }
    } catch (e) {
      // Continue with friendly names
    }
    
    // Step 2: Remove from screening conference
    try {
      await client
        .conferences(screeningConference)
        .participants(callSid)
        .remove();
      console.log(`✅ [CONFERENCE] Removed from screening conference`);
    } catch (removeError: any) {
      // They might have already left or conference doesn't exist
      console.warn(`⚠️ [CONFERENCE] Could not remove from screening (may have already left):`, removeError.message);
    }
    
    // Step 3: Add to live conference (on hold with music)
    const appUrl = process.env.APP_URL || 'https://audioroad-broadcast-production.up.railway.app';
    
    try {
      await client
        .conferences(liveConference)
        .participants
        .create({
          from: process.env.TWILIO_PHONE_NUMBER!,
          to: callSid,
          earlyMedia: true,
          startConferenceOnEnter: false, // Don't start - host already in conference
          endConferenceOnExit: false,
          muted: true, // Join muted
          hold: false // NOT on hold - hear live conference audio!
          // No beep parameter - silent join
        } as any);
      
      console.log(`✅ [CONFERENCE] Added to live conference (can hear show)`);
    } catch (addError: any) {
      console.error(`❌ [CONFERENCE] Failed to add to live conference:`, addError.message);
      throw addError;
    }
    
    console.log(`✅ [CONFERENCE] Participant moved successfully`);
  } catch (error) {
    console.error('❌ [CONFERENCE] Error moving participant:', error);
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
        // Use silent audio URL as workaround - beep:false doesn't always work
        beep: 'http://twimlets.com/echo?Twiml=%3CResponse%3E%3C%2FResponse%3E' as any
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

