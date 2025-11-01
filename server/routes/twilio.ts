import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { generateAccessToken, generateTwiML } from '../services/twilioService.js';
import { processRecording } from '../services/audioService.js';
import { verifyTwilioWebhook } from '../middleware/twilioWebhookAuth.js';
import { z } from 'zod';
import { HLSToMP3Converter } from '../services/hlsToMp3Converter.js';
import { generateWelcomeMessage, generateQueueMessage } from '../services/aiMessageService.js';
import { generateSpeech } from '../services/textToSpeechService.js';
import twilio from 'twilio';

const router = express.Router();
const prisma = new PrismaClient();

// Singleton converter instance for live show audio
// Multiple callers can share the same MP3 stream via PassThrough streams
let mp3Converter: HLSToMP3Converter | null = null;
let converterActive = false;
let activeStreamClients = 0;

// Validation schemas
const tokenRequestSchema = z.object({
  identity: z.string().min(1).max(100)
});


/**
 * POST /api/twilio/token - Generate access token for WebRTC
 */
router.post('/token', (req: Request, res: Response) => {
  try {
    // Validate input
    const validated = tokenRequestSchema.parse(req.body);
    const { identity } = validated;

    const token = generateAccessToken(identity);
    res.json({ token, identity });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.issues });
    }
    console.error('Error generating token:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate token';
    res.status(500).json({ error: errorMessage });
  }
});

/**
 * POST /api/twilio/voice - Handle outgoing web calls (TwiML App Voice URL)
 */
router.post('/voice', async (req: Request, res: Response) => {
  try {
    console.log('📞 VOICE ENDPOINT CALLED');
    
    const { callerId, CallSid, role, callId, episodeId } = req.body;
    
    console.log('📞 Extracted params:');
    console.log('  - callerId:', callerId);
    console.log('  - CallSid:', CallSid);
    console.log('  - role:', role);
    console.log('  - callId:', callId);
    console.log('  - episodeId:', episodeId);

    // If this is a screener or host connecting, route to conference join
    if ((role === 'screener' || role === 'host') && (callId || episodeId)) {
      let conferenceName = '';
      let episode = null;
      
      if (callId) {
        const call = await prisma.call.findUnique({
          where: { id: callId },
          include: { episode: true }
        });

        if (!call) {
          return res.status(404).send('Call not found');
        }
        
        conferenceName = `episode-${call.episodeId}`;
        episode = call.episode;
      } else if (episodeId) {
        conferenceName = `episode-${episodeId}`;
        episode = await prisma.episode.findUnique({ where: { id: episodeId } });
      }

      // Screener always starts conference, host joins active one
      const startConference = role === 'screener' ? true : (episode?.conferenceActive || false);
      
      console.log(`🎙️ ${role} joining conference:`, conferenceName);

      // 🎧 Host joins UNMUTED so callers can hear them
      // Host mic goes to Twilio (for callers) AND mixer (for broadcast stream)
      // No feedback because host hears callers through Twilio, not themselves
      const twiml = generateTwiML('conference', { 
        conferenceName,
        startConferenceOnEnter: startConference,
        endConferenceOnExit: false,  // DON'T end conference - keep alive for whole episode!
        muted: false  // Host unmuted so callers can hear them
      });

      return res.type('text/xml').send(twiml);
    }

    // Find active episode
    const activeEpisode = await prisma.episode.findFirst({
      where: { status: 'live' },
      orderBy: { scheduledStart: 'desc' }
    });

    if (!activeEpisode) {
      console.log('⚠️  No live episode - sending to voicemail');
      const twiml = generateTwiML('voicemail');
      return res.type('text/xml').send(twiml);
    }

    // Create call record if we have caller info
    if (callerId) {
      console.log('📝 [VOICE] Creating call record for callerId:', callerId);
      
      // First, mark any previous incomplete calls from this caller as completed
      // This handles the case where a caller refreshed or had a network issue
      const previousCalls = await prisma.call.findMany({
        where: {
          callerId: callerId,
          episodeId: activeEpisode.id,
          endedAt: null,
          status: {
            notIn: ['completed', 'rejected']
          }
        }
      });

      if (previousCalls.length > 0) {
        console.log(`🧹 [VOICE] Found ${previousCalls.length} incomplete calls from this caller, marking as completed`);
        await prisma.call.updateMany({
          where: {
            callerId: callerId,
            episodeId: activeEpisode.id,
            endedAt: null,
            status: {
              notIn: ['completed', 'rejected']
            }
          },
          data: {
            status: 'completed',
            endedAt: new Date()
          }
        });
      }
      
      const call = await prisma.call.create({
        data: {
          episodeId: activeEpisode.id,
          callerId: callerId,
          twilioCallSid: CallSid || `web-${Date.now()}`,
          status: 'queued',
          incomingAt: new Date(),
          queuedAt: new Date()
        }
      });

      console.log('✅ Call record created:', call.id, 'CallSid:', CallSid, 'CallerId:', callerId);

      // Notify screening room via WebSocket
      const io = req.app.get('io');
      if (io) {
        console.log('📡 [VOICE] Emitting call:incoming to episode:', activeEpisode.id);
        console.log('📡 [VOICE] Call details:', { callId: call.id, callerId: callerId, status: call.status });
        
        io.to(`episode:${activeEpisode.id}`).emit('call:incoming', {
          callId: call.id,
          callerId: callerId,
          twilioCallSid: CallSid || call.twilioCallSid
        });
        
        console.log('✅ [VOICE] WebSocket event emitted');
      } else {
        console.warn('⚠️ [VOICE] No Socket.IO instance available!');
      }
    }

    // Update call record with conference info if we created one
    if (callerId) {
      const call = await prisma.call.findFirst({
        where: {
          callerId: callerId,
          episodeId: activeEpisode.id,
          status: 'queued'
        },
        orderBy: { incomingAt: 'desc' }
      });
      
      if (call) {
        await prisma.call.update({
          where: { id: call.id },
          data: {
            twilioConferenceSid: `episode-${activeEpisode.id}`,
            participantState: 'screening', // Will be picked up by screener
            isMutedInConference: true // Starts muted
          }
        });
        console.log('✅ Updated call record with conference info:', call.id);
      }
    }
    
    console.log('📞 Redirecting web caller to welcome message for episode:', activeEpisode.id);
    
    // Redirect to welcome message endpoint which will play message and connect to conference
    const appUrl = process.env.APP_URL || 'https://audioroad-broadcast-production.up.railway.app';
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Redirect method="POST">${appUrl}/api/twilio/welcome-message</Redirect>
      </Response>`;
    
    res.type('text/xml').send(twiml);

  } catch (error) {
    console.error('❌ Error handling outgoing call:', error);
    res.status(500).send('Error processing call');
  }
});

/**
 * POST /api/twilio/incoming-call - Handle incoming call webhook
 * Protected by Twilio signature verification
 */
router.post('/incoming-call', verifyTwilioWebhook, async (req: Request, res: Response) => {
  try {
    const { From, CallSid } = req.body;
    
    console.log('Incoming call from:', From, 'SID:', CallSid);

    // Find or create caller
    let caller = await prisma.caller.findUnique({
      where: { phoneNumber: From }
    });

    if (!caller) {
      caller = await prisma.caller.create({
        data: {
          phoneNumber: From,
          firstCallDate: new Date(),
          lastCallDate: new Date(),
          totalCalls: 0
        }
      });
    }

    // Find active episode (for now, just get the most recent live episode)
    const activeEpisode = await prisma.episode.findFirst({
      where: { status: 'live' },
      orderBy: { scheduledStart: 'desc' }
    });

    if (!activeEpisode) {
      const twiml = generateTwiML('voicemail');
      res.type('text/xml').send(twiml);
      return;
    }

    // Create call record first
    const call = await prisma.call.create({
      data: {
        episodeId: activeEpisode.id,
        callerId: caller.id,
        twilioCallSid: CallSid,
        status: 'queued',
        incomingAt: new Date(),
        queuedAt: new Date(),
        twilioConferenceSid: `episode-${activeEpisode.id}`,
        participantState: 'screening', // Will be picked up by screener
        isMutedInConference: true // Starts muted
      }
    });

    // Emit socket event
    const io = req.app.get('io');
    io.to(`episode:${activeEpisode.id}`).emit('call:incoming', {
      callId: call.id,
      callerId: caller.id,
      twilioCallSid: CallSid,
      phoneNumber: From
    });

    console.log('📞 Redirecting phone caller to welcome message for episode:', activeEpisode.id);
    
    // Redirect to welcome message endpoint which will play message and connect to conference
    const appUrl = process.env.APP_URL || 'https://audioroad-broadcast-production.up.railway.app';
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Redirect method="POST">${appUrl}/api/twilio/welcome-message</Redirect>
      </Response>`;
    
    res.type('text/xml').send(twiml);

  } catch (error) {
    console.error('Error handling incoming call:', error);
    res.status(500).send('Error processing call');
  }
});

/**
 * POST /api/twilio/recording-status - Handle recording status callback
 * Protected by Twilio signature verification
 */
router.post('/recording-status', verifyTwilioWebhook, async (req: Request, res: Response) => {
  try {
    const { RecordingSid, CallSid, RecordingStatus } = req.body;

    console.log('Recording status:', RecordingStatus, 'for call:', CallSid);

    if (RecordingStatus === 'completed') {
      // Find call by Twilio SID
      const call = await prisma.call.findUnique({
        where: { twilioCallSid: CallSid }
      });

      if (call) {
        // Process and upload recording
        const recordingUrl = await processRecording(RecordingSid, call.episodeId, call.id);

        // Update call with recording URL
        await prisma.call.update({
          where: { id: call.id },
          data: {
            recordingUrl,
            recordingSid: RecordingSid
          }
        });

        console.log('Recording processed and saved:', recordingUrl);
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Error handling recording status:', error);
    res.sendStatus(500);
  }
});

/**
 * POST /api/twilio/conference-status - Handle conference status callback
 * Protected by Twilio signature verification
 */
router.post('/conference-status', verifyTwilioWebhook, async (req: Request, res: Response) => {
  try {
    const { ConferenceSid, StatusCallbackEvent, CallSid, FriendlyName } = req.body;
    console.log('📞 [CONFERENCE] Event:', StatusCallbackEvent, 'Conference:', FriendlyName, 'SID:', ConferenceSid, 'CallSid:', CallSid);

    // When conference starts, store the SID in episode
    if (StatusCallbackEvent === 'conference-start' && ConferenceSid && FriendlyName) {
      const episodeId = FriendlyName.replace('episode-', '');
      console.log('🎙️ [CONFERENCE] Conference started for episode:', episodeId);
      
      try {
        await prisma.episode.update({
          where: { id: episodeId },
          data: {
            twilioConferenceSid: ConferenceSid,
            conferenceActive: true
          }
        });
        console.log('✅ [CONFERENCE] Episode updated with conference SID');
      } catch (error) {
        console.error('❌ [CONFERENCE] Failed to update episode:', error);
      }
    }

    // When conference ends, mark it inactive
    if (StatusCallbackEvent === 'conference-end' && ConferenceSid) {
      console.log('📴 [CONFERENCE] Conference ended:', ConferenceSid);
      
      try {
        const episode = await prisma.episode.findFirst({
          where: { twilioConferenceSid: ConferenceSid }
        });
        
        if (episode) {
          await prisma.episode.update({
            where: { id: episode.id },
            data: { conferenceActive: false }
          });
          console.log('✅ [CONFERENCE] Episode marked conference inactive');
        }
      } catch (error) {
        console.error('❌ [CONFERENCE] Failed to update episode:', error);
      }
    }

    // When a participant joins, store the conference SID on their call
    if (StatusCallbackEvent === 'participant-join' && CallSid && ConferenceSid) {
      const call = await prisma.call.findFirst({
        where: { twilioCallSid: CallSid }
      });

      if (call && !call.twilioConferenceSid) {
        console.log(`🎙️ [CONFERENCE] Participant joined, storing conference SID: ${call.id}`);
        
        await prisma.call.update({
          where: { id: call.id },
          data: {
            twilioConferenceSid: ConferenceSid
          }
        });
        
        console.log('✅ [CONFERENCE] Call updated with conference SID');
      }
    }

    // When a participant leaves, check if it's a caller we should mark as completed
    if (StatusCallbackEvent === 'participant-leave' && CallSid) {
      const call = await prisma.call.findFirst({
        where: { twilioCallSid: CallSid }
      });

      if (call && call.status !== 'completed') {
        // Caller hung up (any state except already completed)
        console.log(`📴 Marking call as completed: ${call.id} (was ${call.status})`);
        
        await prisma.call.update({
          where: { id: call.id },
          data: {
            status: 'completed',
            endedAt: new Date()
          }
        });

        const io = req.app.get('io');
        // Emit both events to ensure all pages get notified
        io.to(`episode:${call.episodeId}`).emit('call:completed', { callId: call.id });
        io.to(`episode:${call.episodeId}`).emit('call:hungup', { callId: call.id });
        
        console.log('✅ Call marked completed (caller hung up):', call.id);
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Error handling conference status:', error);
    res.sendStatus(500);
  }
});

/**
 * POST /api/twilio/wait-music - Provide hold music for queue (NO BEEPS!)
 */
router.post('/wait-music', (req: Request, res: Response) => {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Play loop="20">http://com.twilio.sounds.music.s3.amazonaws.com/MARKOVICHAMP-Borghestral.mp3</Play>
    </Response>`;
  
  res.type('text/xml').send(twiml);
});

/**
 * POST /api/twilio/wait-audio - Smart wait audio (live show or hold music)
 * Used as waitUrl for conference - plays live show if available, otherwise hold music
 */
router.post('/wait-audio', async (req: Request, res: Response) => {
  try {
    console.log('🎵 [WAIT-AUDIO] Request received');
    
    // Check if stream is live on the main broadcast server
    const appUrl = process.env.APP_URL || 'https://audioroad-broadcast-production.up.railway.app';
    
    let isLive = false;
    try {
      const statusResponse = await fetch(`${appUrl}/api/stream/status`, { 
        signal: AbortSignal.timeout(2000) // 2 second timeout
      });
      const status = await statusResponse.json() as { live?: boolean };
      isLive = status.live || false;
      console.log(`   Stream status: ${isLive ? 'LIVE ✅' : 'OFFLINE ❌'}`);
    } catch (statusError) {
      console.warn('⚠️ [WAIT-AUDIO] Could not check stream status (assuming offline)');
      isLive = false;
    }

    // If stream is offline, return hold music
    if (!isLive) {
      console.log('📻 [WAIT-AUDIO] Returning hold music (stream offline)');
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Play loop="20">http://com.twilio.sounds.music.s3.amazonaws.com/MARKOVICHAMP-Borghestral.mp3</Play>
        </Response>`;
      return res.type('text/xml').send(twiml);
    }

    // Stream is live - try to serve converted MP3
    console.log('🎙️ [WAIT-AUDIO] Stream is LIVE, attempting MP3 conversion...');
    
    const streamUrl = `${appUrl}/api/twilio/live-show-audio-stream`;
    
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Play>${streamUrl}</Play>
      </Response>`;
    
    res.type('text/xml').send(twiml);
    
  } catch (error) {
    console.error('❌ [WAIT-AUDIO] Error:', error);
    // Fallback to hold music
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Play loop="20">http://com.twilio.sounds.music.s3.amazonaws.com/MARKOVICHAMP-Borghestral.mp3</Play>
      </Response>`;
    res.type('text/xml').send(twiml);
  }
});

/**
 * GET /api/twilio/welcome-audio - Generate and serve AI welcome message audio
 * Falls back to TwiML Say if AI generation fails
 */
router.get('/welcome-audio', async (req: Request, res: Response) => {
  try {
    const { showName } = req.query;
    const showNameStr = (showName as string) || 'AudioRoad Network';
    
    // Generate AI message
    console.log('🤖 [WELCOME-AUDIO] Generating AI welcome message...');
    let message: string;
    try {
      message = await generateWelcomeMessage(showNameStr);
      console.log(`   Message: "${message}"`);
    } catch (aiError) {
      console.warn('⚠️ [WELCOME-AUDIO] AI generation failed, using fallback:', aiError);
      message = `Welcome to the AudioRoad Network. ${showNameStr} is currently on the air. The call screener will be right with you.`;
    }
    
    // Convert to speech using ElevenLabs
    console.log('🎤 [WELCOME-AUDIO] Converting to speech...');
    let audioBuffer: Buffer;
    try {
      audioBuffer = await generateSpeech(message, {
        voiceId: 'EXAVITQu4vr4xnSDxMaL', // Bella - smooth, friendly voice
        stability: 0.3, // Lower = more natural, less robotic
        similarity_boost: 0.85
      });
      
      // Set headers for MP3 streaming
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      
      res.send(audioBuffer);
    } catch (ttsError) {
      console.error('❌ [WELCOME-AUDIO] ElevenLabs TTS failed:', ttsError);
      // Return empty response - Twilio will skip and continue
      // The welcome-message endpoint will handle fallback
      res.status(204).send();
    }
  } catch (error) {
    console.error('❌ [WELCOME-AUDIO] Critical error:', error);
    // Return empty response - Twilio will skip and continue
    res.status(204).send();
  }
});

/**
 * POST /api/twilio/welcome-message - Welcome message with show name and redirect to conference
 */
router.post('/welcome-message', async (req: Request, res: Response) => {
  try {
    const { CallSid } = req.body;
    
    if (!CallSid) {
      return res.status(400).send('Call SID required');
    }

    // Find call by Twilio CallSid to get episode
    const call = await prisma.call.findFirst({
      where: { twilioCallSid: CallSid },
      include: { 
        episode: {
          include: { show: true }
        }
      },
      orderBy: { incomingAt: 'desc' }
    });

    let episode;
    let showName;
    let conferenceName;
    let liveStreamUrl;
    
    if (!call || !call.episode) {
      // Fallback: try to find active episode
      const activeEpisode = await prisma.episode.findFirst({
        where: { status: 'live' },
        include: { show: true },
        orderBy: { scheduledStart: 'desc' }
      });
      
      if (!activeEpisode) {
        return res.status(404).send('No active episode found');
      }
      
      episode = activeEpisode;
      showName = activeEpisode.show.name || 'AudioRoad Network';
      conferenceName = `episode-${activeEpisode.id}`;
    } else {
      episode = call.episode;
      showName = episode.show.name || 'AudioRoad Network';
      conferenceName = `episode-${episode.id}`;
    }

    const appUrl = process.env.APP_URL || 'https://audioroad-broadcast-production.up.railway.app';
    
    // For now, use hold music as waitUrl (reliable)
    // TODO: Switch to live show audio once HLS conversion is working
    const waitMusicUrl = 'http://com.twilio.sounds.music.s3.amazonaws.com/MARKOVICHAMP-Borghestral.mp3';
    
    // Generate TwiML with AI audio URL
    const welcomeAudioUrl = `${appUrl}/api/twilio/welcome-audio?showName=${encodeURIComponent(showName)}`;
    
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();
    
    // Play AI-generated welcome message
    twiml.play({}, welcomeAudioUrl);
    
    // Connect to conference with wait audio (live show or hold music)
    // IMPORTANT: startConferenceOnEnter should be FALSE for callers
    // so they hear waitUrl music until screener joins
    const waitAudioUrl = `${appUrl}/api/twilio/wait-audio`;
    
    const dial = twiml.dial();
    const conferenceOptions: any = {
      startConferenceOnEnter: false, // Caller waits with music until screener joins
      endConferenceOnExit: false,
      beep: 'http://twimlets.com/echo?Twiml=%3CResponse%3E%3C%2FResponse%3E',
      maxParticipants: 40,
      waitUrl: waitAudioUrl,
      waitMethod: 'POST',
      muted: true, // Caller starts muted
      statusCallback: `${appUrl}/api/twilio/conference-status`,
      statusCallbackEvent: ['start', 'end', 'join', 'leave'],
      statusCallbackMethod: 'POST'
    };
    
    dial.conference(conferenceOptions, conferenceName);

    res.type('text/xml').send(twiml.toString());
  } catch (error) {
    console.error('❌ [WELCOME-MESSAGE] Error generating welcome message:', error);
    // Return valid TwiML even on error - connect directly to conference
    try {
      const appUrl = process.env.APP_URL || 'https://audioroad-broadcast-production.up.railway.app';
      const VoiceResponse = twilio.twiml.VoiceResponse;
      const twiml = new VoiceResponse();
      
      // Say error message
      twiml.say({
        voice: 'alice',
        language: 'en-US'
      }, 'Welcome to the AudioRoad Network. The call screener will be right with you.');
      
      // Still try to connect to conference
      const dial = twiml.dial();
      dial.conference({
        startConferenceOnEnter: true,
        endConferenceOnExit: false,
        waitUrl: `${appUrl}/api/twilio/live-show-audio`,
        muted: false
      }, 'episode-fallback');
      
      res.type('text/xml').send(twiml.toString());
    } catch (fallbackError) {
      console.error('❌ [WELCOME-MESSAGE] Fallback also failed:', fallbackError);
      // Last resort: return minimal valid TwiML
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say voice="alice" language="en-US">Welcome to AudioRoad Network. Please hold.</Say>
          <Dial>
            <Conference>episode-fallback</Conference>
          </Dial>
        </Response>`;
      res.type('text/xml').send(twiml);
    }
  }
});

/**
 * GET /api/twilio/queue-audio - Generate and serve AI queue message audio
 */
router.get('/queue-audio', async (req: Request, res: Response) => {
  try {
    const { position } = req.query;
    const positionNum = position ? parseInt(position as string) : 1;
    
    // Generate AI message
    console.log('🤖 [QUEUE-AUDIO] Generating AI queue message...');
    const message = await generateQueueMessage(positionNum);
    console.log(`   Message: "${message}"`);
    
    // Convert to speech using ElevenLabs
    console.log('🎤 [QUEUE-AUDIO] Converting to speech...');
    const audioBuffer = await generateSpeech(message, {
      voiceId: 'EXAVITQu4vr4xnSDxMaL', // Bella - smooth, friendly voice
      stability: 0.3, // Lower = more natural, less robotic
      similarity_boost: 0.85
    });
    
    // Set headers for MP3 streaming
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    
    res.send(audioBuffer);
  } catch (error) {
    console.error('❌ [QUEUE-AUDIO] Error:', error);
    // Fallback: return empty response (Twilio will skip)
    res.status(500).send('Error generating audio');
  }
});

/**
 * POST /api/twilio/queue-message - Queue position message after screening approval
 * Called by Twilio when announceUrl is triggered for a participant
 * After playing message, redirects back to conference waitUrl to continue live show audio
 */
router.post('/queue-message', async (req: Request, res: Response) => {
  try {
    // Twilio sends CallSid in request body when using announceUrl
    const CallSid = req.body.CallSid || req.query.CallSid;
    const callId = req.query.callId as string;
    const position = req.query.position as string;
    
    // Find call by CallSid (from Twilio) or callId (from query param)
    let call = null;
    
    if (CallSid) {
      call = await prisma.call.findFirst({
        where: { twilioCallSid: CallSid as string },
        include: { episode: true },
        orderBy: { incomingAt: 'desc' }
      });
    } else if (callId) {
      call = await prisma.call.findUnique({
        where: { id: callId },
        include: { episode: true }
      });
    }

    if (!call) {
      // Fallback: use hold music
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Play loop="20">http://com.twilio.sounds.music.s3.amazonaws.com/MARKOVICHAMP-Borghestral.mp3</Play>
        </Response>`;
      return res.type('text/xml').send(twiml);
    }

    // Calculate queue position if not provided
    let queuePosition = position ? parseInt(position) : 1;
    
    if (!position) {
      // Recalculate position
      const approvedCalls = await prisma.call.findMany({
        where: {
          episodeId: call.episodeId,
          status: 'approved',
          endedAt: null,
          onAirAt: null
        },
        orderBy: { approvedAt: 'asc' }
      });
      
      const onAirCalls = await prisma.call.count({
        where: {
          episodeId: call.episodeId,
          status: 'on-air',
          endedAt: null
        }
      });
      
      queuePosition = Math.max(1, approvedCalls.length - onAirCalls);
    }

    const appUrl = process.env.APP_URL || 'https://audioroad-broadcast-production.up.railway.app';
    
    // Generate TwiML with AI audio URL
    const queueAudioUrl = `${appUrl}/api/twilio/queue-audio?position=${queuePosition}`;
    
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();
    
    // Play AI-generated queue message
    twiml.play({}, queueAudioUrl);
    
    // After message, play hold music in a loop
    // This ensures caller hears music after the queue announcement
    twiml.play({ loop: 20 }, 'http://com.twilio.sounds.music.s3.amazonaws.com/MARKOVICHAMP-Borghestral.mp3');

    res.type('text/xml').send(twiml.toString());
  } catch (error) {
    console.error('Error generating queue message:', error);
    // Fallback to hold music
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Play loop="20">http://com.twilio.sounds.music.s3.amazonaws.com/MARKOVICHAMP-Borghestral.mp3</Play>
      </Response>`;
    res.type('text/xml').send(twiml);
  }
});

/**
 * POST /api/twilio/live-show-audio - Stream live show audio as MP3 for Twilio
 * Converts HLS stream to MP3 format that Twilio can consume
 * ALWAYS tries to stream live audio - optimistic approach
 */
router.post('/live-show-audio', async (req: Request, res: Response) => {
  try {
    const { episodeId } = req.query;
    
    console.log('🎵 [LIVE-AUDIO] Request received for episode:', episodeId);
    
    // Get HLS stream URL - use internal URL or external streaming server
    const appUrl = process.env.APP_URL || 'https://audioroad-broadcast-production.up.railway.app';
    const streamServerUrl = process.env.STREAM_SERVER_URL || 'https://audioroad-streaming-server-production.up.railway.app';
    const hlsPlaylistUrl = `${appUrl}/api/stream/live.m3u8`;
    
    // OPTIMISTIC: Always try to stream live audio
    // The converter will handle failures gracefully
    console.log('🎵 [LIVE-AUDIO] Attempting to stream live show...');

    // Initialize converter if not already running
    if (!mp3Converter || !converterActive) {
      console.log('🎵 [LIVE-AUDIO] Creating new HLS to MP3 converter...');
      
      mp3Converter = new HLSToMP3Converter({
        hlsPlaylistUrl,
        bitrate: 128,
        sampleRate: 44100,
        channels: 2
      });

      // Start converter (this creates the underlying FFmpeg process)
      mp3Converter.start(); // First client stream, but converter is shared
      converterActive = true;

      mp3Converter.on('error', (error) => {
        console.error('❌ [LIVE-AUDIO] Converter error:', error);
        converterActive = false;
        mp3Converter = null;
      });

      mp3Converter.on('stopped', () => {
        console.log('📴 [LIVE-AUDIO] Converter stopped');
        converterActive = false;
        mp3Converter = null;
      });
    } else {
      console.log('🎵 [LIVE-AUDIO] Reusing existing converter');
    }

    // For Twilio, we need to return TwiML that references the MP3 stream URL
    // Twilio doesn't support direct streaming, so we'll use a redirect to a GET endpoint
    const mp3StreamUrl = `${appUrl}/api/twilio/live-show-audio-stream`;
    
    console.log('✅ [LIVE-AUDIO] Returning TwiML with stream URL:', mp3StreamUrl);
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Play loop="0">${mp3StreamUrl}</Play>
      </Response>`;
    
    res.type('text/xml').send(twiml);
  } catch (error) {
    console.error('❌ [LIVE-AUDIO] Error streaming live show audio:', error);
    // Fallback to hold music
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Play loop="20">http://com.twilio.sounds.music.s3.amazonaws.com/MARKOVICHAMP-Borghestral.mp3</Play>
      </Response>`;
    res.type('text/xml').send(twiml);
  }
});

/**
 * GET /api/twilio/live-show-audio-stream - Stream MP3 audio directly
 * This endpoint streams MP3 data from the HLS converter
 * Multiple callers can access this same stream (Twilio handles buffering)
 */
router.get('/live-show-audio-stream', (req: Request, res: Response) => {
  console.log('📡 [LIVE-AUDIO-STREAM] Stream request received');
  
  try {
    // Ensure converter is running
    if (!mp3Converter || !converterActive) {
      // Try to start converter
      const appUrl = process.env.APP_URL || 'https://audioroad-broadcast-production.up.railway.app';
      const hlsPlaylistUrl = `${appUrl}/api/stream/live.m3u8`;
      
      console.log('🎵 [LIVE-AUDIO-STREAM] Converter not running, starting...');
      
      mp3Converter = new HLSToMP3Converter({
        hlsPlaylistUrl,
        bitrate: 128,
        sampleRate: 44100,
        channels: 2
      });

      // Start converter (first client stream)
      mp3Converter.start();
      converterActive = true;
      activeStreamClients = 0;

      mp3Converter.on('error', (error) => {
        console.error('❌ [LIVE-AUDIO-STREAM] Converter error:', error);
        converterActive = false;
      });

      mp3Converter.on('stopped', () => {
        console.log('📴 [LIVE-AUDIO-STREAM] Converter stopped');
        converterActive = false;
      });

      // Wait a moment for converter to start, then serve
      setTimeout(() => {
        if (!mp3Converter || !converterActive) {
          console.log('⚠️ [LIVE-AUDIO-STREAM] Converter failed to start, sending 503');
          if (!res.headersSent) {
            return res.status(503).send('Stream not available');
          }
        } else {
          serveStream(res);
        }
      }, 1500);
      
      return;
    }

    console.log('✅ [LIVE-AUDIO-STREAM] Converter active, serving stream');
    serveStream(res);

  } catch (error) {
    console.error('❌ [LIVE-AUDIO-STREAM] Error serving MP3 stream:', error);
    if (!res.headersSent) {
      res.status(500).send('Error serving stream');
    }
  }
});

/**
 * Helper function to serve the MP3 stream to a client
 */
function serveStream(res: Response): void {
  if (!mp3Converter || !converterActive) {
    res.status(503).send('Stream not available');
    return;
  }

  activeStreamClients++;
  console.log(`📡 [LIVE-AUDIO-STREAM] Client connected (total: ${activeStreamClients})`);

  // Set headers for MP3 streaming
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Connection', 'keep-alive');

  // Get a client stream from the shared converter
  const clientStream = mp3Converter.start();
  
  // Pipe client stream to response
  clientStream.pipe(res);

  // Handle client disconnect
  res.on('close', () => {
    activeStreamClients--;
    console.log(`📴 [LIVE-AUDIO-STREAM] Client disconnected (remaining: ${activeStreamClients})`);
    clientStream.destroy();
  });

  // Handle errors
  clientStream.on('error', (error) => {
    console.error('❌ [LIVE-AUDIO-STREAM] Stream error:', error);
    if (!res.headersSent) {
      res.status(500).send('Stream error');
    }
    clientStream.destroy();
  });
}

/**
 * POST /api/twilio/screener-connect - Connect screener to caller via conference
 */
router.post('/screener-connect', async (req: Request, res: Response) => {
  try {
    const { callId } = req.body;
    
    console.log('🎙️ Screener connecting to call:', callId);

    // Find the call
    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: { episode: true }
    });

    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }

    // Conference name based on episode
    const conferenceName = `episode-${call.episodeId}`;
    
    console.log('📞 Connecting to conference:', conferenceName);

    // Return TwiML to join the conference
    const twiml = generateTwiML('conference', { 
      conferenceName,
      startConferenceOnEnter: true,  // Screener starts the conference
      endConferenceOnExit: false,
      muted: false
    });

    res.type('text/xml').send(twiml);
  } catch (error) {
    console.error('Error connecting screener:', error);
    res.status(500).json({ error: 'Failed to connect screener' });
  }
});

/**
 * POST /api/twilio/sms - Handle incoming SMS messages (Team messages)
 */
router.post('/sms', async (req: Request, res: Response) => {
  const { From, Body, MessageSid } = req.body;
  
  try {
    console.log(`📱 SMS received from ${From}: ${Body}`);
    
    // Get active episode
    const activeEpisode = await prisma.episode.findFirst({
      where: { status: 'live' },
      orderBy: { actualStart: 'desc' }
    });
    
    if (!activeEpisode) {
      // No show live, send auto-reply
      console.log('⚠️ No live show - sending auto-reply');
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Message>No show currently broadcasting. Check schedule at audioroad.com</Message>
        </Response>`;
      return res.type('text/xml').send(twiml);
    }
    
    // Create chat message from SMS
    const chatMessage = await prisma.chatMessage.create({
      data: {
        episodeId: activeEpisode.id,
        senderId: From,
        senderName: `Team (${From.slice(-4)})`, // Show last 4 digits
        senderRole: 'producer',
        messageType: 'sms',
        message: Body,
        twilioSid: MessageSid
      }
    });
    
    console.log('✅ Chat message created from SMS:', chatMessage.id);
    
    // Broadcast via WebSocket so host sees it immediately
    const io = req.app.get('io');
    if (io) {
      io.to(`episode:${activeEpisode.id}`).emit('chat:message', chatMessage);
      console.log('📡 SMS message broadcast via WebSocket');
    }
    
    // Send confirmation reply
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Message>Message received! Host will see it on-air. 🎙️</Message>
      </Response>`;
    res.type('text/xml').send(twiml);
    
  } catch (error) {
    console.error('❌ Error handling SMS:', error);
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
      <Response></Response>`;
    res.type('text/xml').send(twiml);
  }
});

export default router;

