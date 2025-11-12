/**
 * WebRTC API Routes
 * Handles LiveKit token generation and room management
 */

import express, { Request, Response } from 'express';
import LiveKitRoomManager from '../services/livekitRoomManager.js';

const router = express.Router();

/**
 * Generate access token for LiveKit room
 * POST /api/webrtc/token
 */
router.post('/token', async (req: Request, res: Response) => {
  const { roomName, participantName, participantId } = req.body;

  if (!roomName || !participantName || !participantId) {
    return res.status(400).json({ 
      error: 'Missing required fields: roomName, participantName, participantId' 
    });
  }

  try {
    const roomManager = req.app.get('roomManager') as LiveKitRoomManager;

    if (!roomManager) {
      return res.status(503).json({ 
        error: 'LiveKit not configured. Set LIVEKIT_WS_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET' 
      });
    }

    console.log(`🎫 [WEBRTC] Generating token for ${participantId} → ${roomName}`);

    // Ensure room exists
    await roomManager.ensureRoomExists(roomName);

    // Generate token
    const token = await roomManager.generateToken(roomName, participantId, participantName);

    console.log(`✅ [WEBRTC] Token generated for ${participantId}`);

    res.json({ 
      token,
      wsUrl: process.env.LIVEKIT_WS_URL,
      roomName
    });

  } catch (error: any) {
    console.error('❌ [WEBRTC] Token generation error:', error);
    res.status(500).json({ error: 'Failed to generate token', message: error.message });
  }
});

/**
 * List all active rooms
 * GET /api/webrtc/rooms
 */
router.get('/rooms', async (req: Request, res: Response) => {
  try {
    const roomManager = req.app.get('roomManager') as LiveKitRoomManager;

    if (!roomManager) {
      return res.status(503).json({ error: 'LiveKit not configured' });
    }

    const rooms = await roomManager.listRooms();
    res.json(rooms);

  } catch (error: any) {
    console.error('❌ [WEBRTC] List rooms error:', error);
    res.status(500).json({ error: 'Failed to list rooms', message: error.message });
  }
});

/**
 * Get room statistics
 * GET /api/webrtc/rooms/:roomName/stats
 */
router.get('/rooms/:roomName/stats', async (req: Request, res: Response) => {
  const { roomName } = req.params;

  try {
    const roomManager = req.app.get('roomManager') as LiveKitRoomManager;

    if (!roomManager) {
      return res.status(503).json({ error: 'LiveKit not configured' });
    }

    const stats = await roomManager.getRoomStats(roomName);
    res.json(stats || { error: 'Room not found' });

  } catch (error: any) {
    console.error('❌ [WEBRTC] Get stats error:', error);
    res.status(500).json({ error: 'Failed to get stats', message: error.message });
  }
});

/**
 * Forward browser audio to phone caller
 * POST /api/webrtc/forward-to-phone
 */
router.post('/forward-to-phone', async (req: Request, res: Response) => {
  const { roomName, audio, sampleRate } = req.body;

  if (!roomName || !audio) {
    return res.status(400).json({ error: 'Missing roomName or audio' });
  }

  try {
    const mediaBridge = req.app.get('mediaBridge');

    if (!mediaBridge) {
      return res.status(503).json({ error: 'Media bridge not initialized' });
    }

    // Decode base64 audio to Buffer
    const audioBuffer = Buffer.from(audio, 'base64');

    // Find callSid for this room
    const callSid = mediaBridge.getCallSidForRoom(roomName);

    if (!callSid) {
      // No phone call in this room - that's okay, just ignore
      return res.json({ status: 'no-caller' });
    }

    // Forward audio to phone
    mediaBridge.sendAudioToPhone(callSid, audioBuffer);

    res.json({ status: 'ok' });

  } catch (error: any) {
    console.error('❌ [WEBRTC] Forward audio error:', error);
    res.status(500).json({ error: 'Failed to forward audio', message: error.message });
  }
});

/**
 * Health check
 * GET /api/webrtc/health
 */
router.get('/health', (req: Request, res: Response) => {
  const roomManager = req.app.get('roomManager');
  const mediaBridge = req.app.get('mediaBridge');

  res.json({
    status: roomManager && mediaBridge ? 'ok' : 'degraded',
    provider: 'livekit',
    roomManager: roomManager ? 'initialized' : 'missing',
    mediaBridge: mediaBridge ? 'initialized' : 'missing',
    activeStreams: mediaBridge ? mediaBridge.getActiveStreamsCount() : 0,
    connected: roomManager ? roomManager.isConnected() : false
  });
});

export default router;

