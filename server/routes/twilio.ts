import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { generateAccessToken, generateTwiML } from '../services/twilioService.js';
import { processRecording } from '../services/audioService.js';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * POST /api/twilio/token - Generate access token for WebRTC
 */
router.post('/token', (req: Request, res: Response) => {
  try {
    const { identity } = req.body;
    
    if (!identity) {
      return res.status(400).json({ error: 'Identity required' });
    }

    const token = generateAccessToken(identity);
    res.json({ token, identity });
  } catch (error) {
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
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📞 VOICE ENDPOINT CALLED');
    console.log('Full request body:', JSON.stringify(req.body, null, 2));
    console.log('Request headers:', JSON.stringify(req.headers, null, 2));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
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
      
      if (callId) {
        const call = await prisma.call.findUnique({
          where: { id: callId },
          include: { episode: true }
        });

        if (!call) {
          return res.status(404).send('Call not found');
        }
        
        conferenceName = `episode-${call.episodeId}`;
      } else if (episodeId) {
        conferenceName = `episode-${episodeId}`;
      }

      console.log(`🎙️ ${role} joining conference:`, conferenceName);

      const twiml = generateTwiML('conference', { 
        conferenceName,
        startConferenceOnEnter: role === 'screener',  // Screener starts, host joins existing
        endConferenceOnExit: false,  // DON'T end conference - keep alive for whole episode!
        muted: false,
        beep: false  // Boolean false
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

    // Create call record if we have caller info (prevent duplicates)
    if (callerId) {
      // Check for duplicates in last 60 seconds (aggressive)
      const recentCutoff = new Date(Date.now() - 60000); // 60 seconds ago
      
      const existingCall = await prisma.call.findFirst({
        where: {
          callerId: callerId,
          episodeId: activeEpisode.id,
          incomingAt: {
            gte: recentCutoff
          }
        }
      });

      if (existingCall) {
        console.log('⚠️ Duplicate call prevented! CallerId:', callerId, 'existing call:', existingCall.id);
      } else {
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
    }

    // Put caller in conference (so screener can join later)
    const conferenceName = `episode-${activeEpisode.id}`;
    const twiml = generateTwiML('conference', { 
      conferenceName,
      startConferenceOnEnter: false,  // Don't start until screener joins
      endConferenceOnExit: false,     // DON'T end conference - keep it alive for episode!
      waitUrl: '/api/twilio/wait-music',
      beep: false,  // Boolean false
      muted: false  // Ensure caller is NOT muted
    });
    
    console.log('📞 Sending caller to conference:', conferenceName);
    res.type('text/xml').send(twiml);

  } catch (error) {
    console.error('❌ Error handling outgoing call:', error);
    res.status(500).send('Error processing call');
  }
});

/**
 * POST /api/twilio/incoming-call - Handle incoming call webhook
 */
router.post('/incoming-call', async (req: Request, res: Response) => {
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

    // Create call record
    await prisma.call.create({
      data: {
        episodeId: activeEpisode.id,
        callerId: caller.id,
        twilioCallSid: CallSid,
        status: 'queued',
        incomingAt: new Date(),
        queuedAt: new Date()
      }
    });

    // Emit socket event
    const io = req.app.get('io');
    io.to(`episode:${activeEpisode.id}`).emit('call:incoming', {
      callerId: caller.id,
      twilioCallSid: CallSid,
      phoneNumber: From
    });

    // Send caller to conference (same as web calls!)
    const conferenceName = `episode-${activeEpisode.id}`;
    console.log('📞 Sending phone caller to conference:', conferenceName);
    
    const twiml = generateTwiML('conference', { 
      conferenceName,
      startConferenceOnEnter: false,  // Don't start until screener joins
      endConferenceOnExit: false,     // DON'T end conference - keep it alive for episode!
      waitUrl: '/api/twilio/wait-music',
      beep: false,
      muted: false  // Caller should NOT be muted
    });
    
    res.type('text/xml').send(twiml);

  } catch (error) {
    console.error('Error handling incoming call:', error);
    res.status(500).send('Error processing call');
  }
});

/**
 * POST /api/twilio/recording-status - Handle recording status callback
 */
router.post('/recording-status', async (req: Request, res: Response) => {
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
 */
router.post('/conference-status', async (req: Request, res: Response) => {
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
 * POST /api/twilio/screener-connect - Connect screener to caller via conference
 */
router.post('/screener-connect', async (req: Request, res: Response) => {
  try {
    const { callId, role } = req.body;
    
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

export default router;

