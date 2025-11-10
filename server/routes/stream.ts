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

// Track streaming state independently
let isStreamingActive = false;
let lastAudioReceived = 0;

export function setHLSServer(server: any) {
  hlsServer = server;
  console.log('✅ [STREAM ROUTES] HLS server reference set');
}

// Called by streamSocketService when stream starts/stops
export function setStreamingActive(active: boolean) {
  isStreamingActive = active;
  if (active) {
    lastAudioReceived = Date.now();
  }
  console.log(`📡 [STREAM ROUTES] Streaming state: ${active ? 'LIVE' : 'OFFLINE'}`);
}

// Called by streamSocketService when audio is received
export function updateLastAudioReceived() {
  lastAudioReceived = Date.now();
  isStreamingActive = true;
}

/**
 * GET /api/stream/status - Get stream status
 * Shows if stream is live, listener count, etc.
 * MUST BE BEFORE /:segment route!
 */
router.get('/status', (req: Request, res: Response) => {
  try {
    // Check if we've received audio in last 10 seconds
    const timeSinceLastAudio = Date.now() - lastAudioReceived;
    const isLive = isStreamingActive && timeSinceLastAudio < 10000;
    
    // Also check HLS server if available
    let hlsStatus = null;
    if (hlsServer) {
      try {
        hlsStatus = hlsServer.getStatus();
      } catch (e) {
        // HLS server might not be running
      }
    }
    
    res.json({
      live: isLive,
      message: isLive ? 'Stream live' : 'Stream offline',
      lastAudioReceived: lastAudioReceived > 0 ? new Date(lastAudioReceived).toISOString() : null,
      timeSinceLastAudio: lastAudioReceived > 0 ? `${(timeSinceLastAudio / 1000).toFixed(1)}s ago` : null,
      hlsServer: hlsStatus ? {
        streaming: hlsStatus.streaming,
        currentSegment: hlsStatus.currentSegment,
        encoder: hlsStatus.encoder
      } : null
    });
    
  } catch (error) {
    console.error('Error getting status:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

/**
 * POST /api/stream/pause-autodj - Pause AutoDJ on streaming server
 * Called when show starts to prevent background music
 */
router.post('/pause-autodj', async (req: Request, res: Response) => {
  try {
    const { getStreamingServerSocket } = await import('../services/streamSocketService.js');
    const streamingSocket = getStreamingServerSocket();
    
    if (streamingSocket && streamingSocket.connected) {
      streamingSocket.emit('live-start');
      console.log('✅ [STREAM] AutoDJ pause signal sent to streaming server');
      return res.json({ success: true });
    } else {
      console.warn('⚠️ [STREAM] Streaming server Socket.IO not connected');
      return res.json({ 
        success: false, 
        error: 'Streaming server not connected',
        message: 'AutoDJ may continue playing. Check streaming server connection.'
      });
    }
  } catch (error: any) {
    console.error('❌ [STREAM] Error pausing AutoDJ:', error);
    res.status(500).json({ 
      error: 'Failed to pause AutoDJ',
      details: error.message 
    });
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

