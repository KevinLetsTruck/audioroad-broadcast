/**
 * Direct MP3 Stream Routes
 * Serves MP3 audio directly to phone callers
 */

import express, { Request, Response } from 'express';
import { getDirectMP3Stream } from '../services/streamSocketService.js';

const router = express.Router();

/**
 * GET /api/mp3-stream - Direct MP3 stream for phone callers
 * Simple, reliable, infinite streaming
 */
router.get('/', (req: Request, res: Response) => {
  console.log('📡 [MP3-STREAM-ROUTE] Stream request received');
  
  try {
    const mp3Stream = getDirectMP3Stream();
    
    if (!mp3Stream) {
      console.log('⚠️ [MP3-STREAM-ROUTE] Stream not available (no active broadcast)');
      return res.status(503).send('Stream not available');
    }

    const status = mp3Stream.getStatus();
    if (!status.active) {
      console.log('⚠️ [MP3-STREAM-ROUTE] Stream not active');
      return res.status(503).send('Stream not active');
    }

    console.log(`📡 [MP3-STREAM-ROUTE] Serving stream to client (current clients: ${status.clients})`);

    // Set headers for MP3 streaming
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Connection', 'keep-alive');

    // Get client stream
    const clientStream = mp3Stream.getClientStream();
    
    // Pipe to response
    clientStream.pipe(res);

    // Handle client disconnect
    res.on('close', () => {
      console.log('📴 [MP3-STREAM-ROUTE] Client disconnected');
      clientStream.destroy();
    });

    // Handle errors
    clientStream.on('error', (error) => {
      console.error('❌ [MP3-STREAM-ROUTE] Stream error:', error);
      if (!res.headersSent) {
        res.status(500).send('Stream error');
      }
      clientStream.destroy();
    });

  } catch (error) {
    console.error('❌ [MP3-STREAM-ROUTE] Error serving stream:', error);
    if (!res.headersSent) {
      res.status(500).send('Error serving stream');
    }
  }
});

export default router;



