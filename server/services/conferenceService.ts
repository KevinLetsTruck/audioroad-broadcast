import twilioClient from './twilioService.js';

const client = twilioClient;
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Create conference for an episode
 */
export async function createEpisodeConference(episodeId: string) {
  if (!client) throw new Error('Twilio not configured');
  const conferenceName = `episode-${episodeId}`;
  
  try {
    // Simplified for MVP
    return {
      sid: `CF${Date.now()}`,
      friendlyName: conferenceName
    } as any;
    
    /* Original code - enable when Twilio fully configured:
    const conference = await client.conferences.create({
      friendlyName: conferenceName,
      statusCallback: `${process.env.APP_URL}/api/twilio/conference-status`,
      statusCallbackMethod: 'POST',
      statusCallbackEvent: ['start', 'end', 'join', 'leave', 'mute', 'hold'],
      record: 'record-from-start',
      recordingStatusCallback: `${process.env.APP_URL}/api/twilio/recording-status`,
      recordingChannels: 'dual',
      trim: 'trim-silence',
    });

    console.log('Conference created:', conferenceName);
    return conference;
    */
  } catch (error) {
    console.error('Error creating conference:', error);
    throw error;
  }
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
        beep: 'false' as any,
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
    // First, play "you're now live" tone
    await playLiveTone(callSid);

    // Wait for tone to finish (2 seconds)
    await new Promise(resolve => setTimeout(resolve, 2000));

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
 */
async function playLiveTone(callSid: string) {
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
        startConferenceOnEnter: true,
        endConferenceOnExit: true, // Host ending ends conference
        beep: false
      });

    console.log(`Host added to conference ${conferenceName}`);
    return participant;
  } catch (error) {
    console.error('Error adding host to conference:', error);
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

