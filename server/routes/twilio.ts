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

    // Return TwiML to queue the call
    const twiml = generateTwiML('queue', { queueName: `episode-${activeEpisode.id}` });
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
    const { ConferenceSid, StatusCallbackEvent } = req.body;
    console.log('Conference event:', StatusCallbackEvent, 'for:', ConferenceSid);
    res.sendStatus(200);
  } catch (error) {
    console.error('Error handling conference status:', error);
    res.sendStatus(500);
  }
});

/**
 * POST /api/twilio/wait-music - Provide hold music for queue
 */
router.post('/wait-music', (req: Request, res: Response) => {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Say>Thank you for calling AudioRoad Network. Please hold while we connect you.</Say>
      <Play loop="10">https://api.twilio.com/cowbell.mp3</Play>
    </Response>`;
  
  res.type('text/xml').send(twiml);
});

export default router;

