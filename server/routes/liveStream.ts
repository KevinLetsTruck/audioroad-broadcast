/**
 * Live Stream Endpoint
 * Serves mixer output as HTTP audio stream for approved callers waiting on hold
 */
import express, { Request, Response } from 'express';
import { getDirectMP3Stream } from '../services/streamSocketService.js';

const router = express.Router();

/**
 * GET /api/live-stream - Stream live show audio
 * This is what approved callers listen to while waiting
 */
router.get('/', (req: Request, res: Response) => {
  try {
    console.log('📻 [LIVE-STREAM] Caller connected to live audio stream');
    
    // Get the MP3 stream from mixer
    const stream = getDirectMP3Stream();
    
    if (!stream) {
      console.error('❌ [LIVE-STREAM] No active stream available');
      // Return silence or hold music as fallback
      return res.redirect('/api/twilio/wait-audio');
    }
    
    // Set headers for audio streaming
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    console.log('✅ [LIVE-STREAM] Streaming live audio to caller');
    
    // Pipe the stream to response
    stream.getStream().pipe(res);
    
    // Handle disconnect
    req.on('close', () => {
      console.log('📻 [LIVE-STREAM] Caller disconnected from stream');
    });
    
  } catch (error) {
    console.error('❌ [LIVE-STREAM] Error:', error);
    res.status(500).send('Stream unavailable');
  }
});

export default router;

