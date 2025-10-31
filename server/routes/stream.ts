/**
 * HLS Streaming Routes
 * 
 * Serves HLS playlist and segments to listeners
 * Public endpoints - no authentication required
 */

import express, { Request, Response } from 'express';

const router = express.Router();

// Store reference to HLS server (will be set by streamSocketService)
let hlsServer: any = null;

export function setHLSServer(server: any) {
  hlsServer = server;
  console.log('✅ [STREAM ROUTES] HLS server reference set');
}

/**
 * GET /api/stream/status - Get stream status
 * Shows if stream is live, listener count, etc.
 * MUST BE BEFORE /:segment route!
 */
router.get('/status', (req: Request, res: Response) => {
  try {
    if (!hlsServer) {
      return res.json({
        live: false,
        message: 'Stream offline'
      });
    }

    const status = hlsServer.getStatus();
    
    res.json({
      live: status.streaming,
      currentSegment: status.currentSegment,
      encoder: status.encoder
    });
    
  } catch (error) {
    console.error('Error getting status:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

/**
 * GET /api/stream/live.m3u8 - Get HLS playlist
 * Public endpoint for all listeners
 */
router.get('/live.m3u8', async (req: Request, res: Response) => {
  try {
    if (!hlsServer) {
      return res.status(503).send('Stream not available');
    }

    const playlist = await hlsServer.getPlaylist();
    
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(playlist);
    
  } catch (error) {
    console.error('Error serving playlist:', error);
    res.status(500).send('Error loading stream');
  }
});

/**
 * GET /api/stream/:segment - Get HLS segment file
 * Public endpoint for all listeners
 * MUST BE LAST - catch-all route!
 */
router.get('/:segment', async (req: Request, res: Response) => {
  try {
    if (!hlsServer) {
      return res.status(503).send('Stream not available');
    }

    const { segment } = req.params;
    
    // Validate segment filename (security) - now supports both 3-digit and 5-digit
    if (!/^segment-\d{3,5}\.ts$/.test(segment)) {
      return res.status(400).send('Invalid segment');
    }

    const segmentData = await hlsServer.getSegment(segment);
    
    res.setHeader('Content-Type', 'video/mp2t');
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(segmentData);
    
  } catch (error) {
    console.error('Error serving segment:', error);
    res.status(404).send('Segment not found');
  }
});

export default router;

