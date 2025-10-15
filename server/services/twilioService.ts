import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const apiKey = process.env.TWILIO_API_KEY;
const apiSecret = process.env.TWILIO_API_SECRET;
const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

// Initialize Twilio client only if credentials are configured
const client = (accountSid && authToken && accountSid !== 'not_configured') 
  ? twilio(accountSid, authToken)
  : null;

/**
 * Generate Twilio access token for WebRTC connection
 */
export function generateAccessToken(identity: string, roomName?: string): string {
  if (!accountSid || !apiKey || !apiSecret) {
    throw new Error('Twilio credentials not configured');
  }

  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const token = new AccessToken(
    accountSid,
    apiKey,
    apiSecret,
    { 
      identity,
      ttl: 14400 // 4 hours
    }
  );

  const voiceGrant = new VoiceGrant({
    incomingAllow: true,
    outgoingApplicationSid: twimlAppSid,
  });

  token.addGrant(voiceGrant);

  return token.toJwt();
}

/**
 * Create a conference for the episode
 */
export async function createConference(conferenceName: string, options: any = {}) {
  if (!client) throw new Error('Twilio not configured');
  
  try {
    const conference = await client.conferences(conferenceName).fetch().catch(() => null);
    if (conference) return conference;
    
    // Create new conference (simplified for MVP)
    return {
      sid: `CF${Date.now()}`,
      friendlyName: conferenceName
    } as any;
    
    /* Actual Twilio conference creation - enable when ready:
    const conference = await client.conferences.create({
      friendlyName: conferenceName,
      statusCallback: `${process.env.APP_URL}/api/twilio/conference-status`,
      statusCallbackMethod: 'POST',
      statusCallbackEvent: ['start', 'end', 'join', 'leave'],
      record: 'record-from-start',
      recordingStatusCallback: `${process.env.APP_URL}/api/twilio/recording-status`,
      recordingChannels: 'dual',
      ...options
    });
    return conference;
    */
  } catch (error) {
    console.error('Error creating conference:', error);
    throw error;
  }
}

/**
 * Add a participant to a conference
 */
export async function addParticipantToConference(
  conferenceSid: string,
  phoneNumber: string,
  options: any = {}
) {
  try {
    const participant = await client
      .conferences(conferenceSid)
      .participants
      .create({
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: phoneNumber,
        earlyMedia: true,
        endConferenceOnExit: false,
        ...options
      });

    return participant;
  } catch (error) {
    console.error('Error adding participant to conference:', error);
    throw error;
  }
}

/**
 * Update participant in conference (mute, hold, etc.)
 */
export async function updateParticipant(
  conferenceSid: string,
  callSid: string,
  updates: { muted?: boolean; hold?: boolean; announceUrl?: string }
) {
  try {
    const participant = await client
      .conferences(conferenceSid)
      .participants(callSid)
      .update(updates);

    return participant;
  } catch (error) {
    console.error('Error updating participant:', error);
    throw error;
  }
}

/**
 * Remove participant from conference
 */
export async function removeParticipant(conferenceSid: string, callSid: string) {
  try {
    await client
      .conferences(conferenceSid)
      .participants(callSid)
      .remove();

    return { success: true };
  } catch (error) {
    console.error('Error removing participant:', error);
    throw error;
  }
}

/**
 * Get call details
 */
export async function getCallDetails(callSid: string) {
  try {
    const call = await client.calls(callSid).fetch();
    return call;
  } catch (error) {
    console.error('Error fetching call details:', error);
    throw error;
  }
}

/**
 * End a call
 */
export async function endCall(callSid: string) {
  try {
    const call = await client.calls(callSid).update({ status: 'completed' });
    return call;
  } catch (error) {
    console.error('Error ending call:', error);
    throw error;
  }
}

/**
 * Get recording details
 */
export async function getRecording(recordingSid: string) {
  try {
    const recording = await client.recordings(recordingSid).fetch();
    return recording;
  } catch (error) {
    console.error('Error fetching recording:', error);
    throw error;
  }
}

/**
 * Download recording
 */
export async function downloadRecording(recordingSid: string): Promise<Buffer> {
  try {
    // Get recording media URL
    const recording = await getRecording(recordingSid);
    const mediaUrl = `https://api.twilio.com${recording.uri.replace('.json', '.mp3')}`;
    
    // Download the recording
    const response = await fetch(mediaUrl, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64')
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to download recording: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('Error downloading recording:', error);
    throw error;
  }
}

/**
 * Generate TwiML for incoming calls
 */
export function generateTwiML(action: 'queue' | 'conference' | 'voicemail', options: any = {}) {
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  switch (action) {
    case 'queue':
      twiml.say('Thank you for calling AudioRoad Network. Please hold while we connect you with a call screener.');
      twiml.enqueue({
        waitUrl: '/api/twilio/wait-music',
        action: '/api/twilio/queue-result'
      }, options.queueName || 'default-queue');
      break;

    case 'conference':
      twiml.say('Connecting you now.');
      twiml.dial().conference({
        startConferenceOnEnter: false,
        endConferenceOnExit: false,
        ...options
      }, options.conferenceName);
      break;

    case 'voicemail':
      twiml.say('Please leave a message after the tone.');
      twiml.record({
        action: '/api/twilio/voicemail-complete',
        maxLength: 120,
        transcribe: true,
        transcribeCallback: '/api/twilio/voicemail-transcription'
      });
      break;

    default:
      twiml.say('Thank you for calling. Goodbye.');
  }

  return twiml.toString();
}

/**
 * Send SMS notification
 */
export async function sendSMS(to: string, message: string) {
  try {
    const sms = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to
    });

    return sms;
  } catch (error) {
    console.error('Error sending SMS:', error);
    throw error;
  }
}

export default client;

