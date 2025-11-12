/**
 * Live Room API Routes
 * Manages WebRTC live room participant states
 * 
 * Key Feature: Infinite toggles between on-air and hold!
 * Participants stay in the same room, we just mute/unmute them.
 */

import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * Put caller on air (unmute in live room)
 * POST /api/live-room/:callId/on-air
 */
router.post('/:callId/on-air', async (req: Request, res: Response) => {
  const { callId } = req.params;

  try {
    console.log(`🔊 [LIVE-ROOM] Putting caller on air: ${callId}`);

    // Get call
    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: { episode: true }
    });

    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }

    // Must be approved or on-hold to go on air
    if (call.status !== 'approved' && call.status !== 'on-hold') {
      return res.status(400).json({ 
        error: `Cannot put ${call.status} call on air. Must be approved or on-hold.` 
      });
    }

    // Ensure caller is in live room
    const roomManager = req.app.get('roomManager');
    const mediaBridge = req.app.get('mediaBridge');
    
    if (!mediaBridge || !call.twilioCallSid) {
      return res.status(400).json({ error: 'Media bridge not available' });
    }

    const liveRoomId = `live-${call.episodeId}`;

    // If not already in live room, move them there first
    const streamInfo = mediaBridge.getStreamInfo(call.twilioCallSid);
    if (!streamInfo || streamInfo.roomId !== liveRoomId) {
      console.log(`🔄 [LIVE-ROOM] Moving caller to live room first...`);
      await mediaBridge.moveStreamToRoom(call.twilioCallSid, liveRoomId);
    }

    // Unmute participant in live room
    if (roomManager) {
      try {
        await roomManager.muteParticipant(call.id, false);
        console.log(`✅ [LIVE-ROOM] Unmuted participant in Janus`);
      } catch (error: any) {
        console.warn(`⚠️ [LIVE-ROOM] Could not unmute in Janus: ${error.message}`);
        // Continue anyway - muting might not be implemented yet
      }
    }

    // Update database
    const updatedCall = await prisma.call.update({
      where: { id: callId },
      data: {
        status: 'on-air',
        participantState: 'on-air',
        isMutedInConference: false,
        isOnHold: false,
        onAirAt: call.onAirAt || new Date()
      }
    });

    // Emit socket events
    const io = req.app.get('io');
    if (io) {
      io.to(`episode:${call.episodeId}`).emit('call:on-air', updatedCall);
      io.to(`episode:${call.episodeId}`).emit('call:updated', updatedCall);
      io.to(`episode:${call.episodeId}`).emit('participant:state-changed', {
        callId: call.id,
        status: 'on-air',
        isMutedInConference: false,
        isOnHold: false
      });
    }

    console.log(`✅ [LIVE-ROOM] Caller ${callId} is now ON AIR`);
    res.json(updatedCall);

  } catch (error) {
    console.error('❌ [LIVE-ROOM] On-air error:', error);
    res.status(500).json({ error: 'Failed to put caller on air' });
  }
});

/**
 * Put caller on hold (mute in live room, still hearing show)
 * POST /api/live-room/:callId/on-hold
 */
router.post('/:callId/on-hold', async (req: Request, res: Response) => {
  const { callId } = req.params;

  try {
    console.log(`⏸️ [LIVE-ROOM] Putting caller on hold: ${callId}`);

    // Get call
    const call = await prisma.call.findUnique({
      where: { id: callId }
    });

    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }

    // Must be on-air to go on hold
    if (call.status !== 'on-air') {
      return res.status(400).json({ 
        error: `Cannot put ${call.status} call on hold. Must be on-air.` 
      });
    }

    // Mute participant in live room (stays in room, hearing show)
    const roomManager = req.app.get('roomManager');
    if (roomManager) {
      try {
        await roomManager.muteParticipant(call.id, true);
        console.log(`✅ [LIVE-ROOM] Muted participant in Janus`);
      } catch (error: any) {
        console.warn(`⚠️ [LIVE-ROOM] Could not mute in Janus: ${error.message}`);
      }
    }

    // Update database
    const updatedCall = await prisma.call.update({
      where: { id: callId },
      data: {
        status: 'on-hold',
        participantState: 'on-hold',
        isMutedInConference: true,
        isOnHold: true
      }
    });

    // Emit socket events
    const io = req.app.get('io');
    if (io) {
      io.to(`episode:${call.episodeId}`).emit('call:on-hold', updatedCall);
      io.to(`episode:${call.episodeId}`).emit('call:updated', updatedCall);
      io.to(`episode:${call.episodeId}`).emit('participant:state-changed', {
        callId: call.id,
        status: 'on-hold',
        isMutedInConference: true,
        isOnHold: true
      });
    }

    console.log(`✅ [LIVE-ROOM] Caller ${callId} is now ON HOLD (hearing show, muted)`);
    res.json(updatedCall);

  } catch (error) {
    console.error('❌ [LIVE-ROOM] On-hold error:', error);
    res.status(500).json({ error: 'Failed to put caller on hold' });
  }
});

/**
 * Send caller back to screening
 * POST /api/live-room/:callId/back-to-screening
 */
router.post('/:callId/back-to-screening', async (req: Request, res: Response) => {
  const { callId } = req.params;

  try {
    console.log(`↩️ [LIVE-ROOM] Sending caller back to screening: ${callId}`);

    // Get call
    const call = await prisma.call.findUnique({
      where: { id: callId }
    });

    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }

    // Can send back from approved, on-air, or on-hold
    if (!['approved', 'on-air', 'on-hold'].includes(call.status)) {
      return res.status(400).json({ 
        error: `Cannot send ${call.status} call back to screening` 
      });
    }

    // Move caller back to screening room
    const mediaBridge = req.app.get('mediaBridge');
    if (mediaBridge && call.twilioCallSid) {
      const screeningRoomId = `screening-${call.episodeId}-${call.id}`;
      
      try {
        await mediaBridge.moveStreamToRoom(call.twilioCallSid, screeningRoomId);
        console.log(`✅ [LIVE-ROOM] Moved caller back to screening room: ${screeningRoomId}`);
      } catch (error: any) {
        console.error('❌ [LIVE-ROOM] Failed to move to screening:', error.message);
      }
    }

    // Update database
    const updatedCall = await prisma.call.update({
      where: { id: callId },
      data: {
        status: 'screening',
        participantState: 'screening',
        isMutedInConference: false,
        isOnHold: false
      }
    });

    // Emit socket events
    const io = req.app.get('io');
    if (io) {
      io.to(`episode:${call.episodeId}`).emit('call:back-to-screening', updatedCall);
      io.to(`episode:${call.episodeId}`).emit('call:updated', updatedCall);
    }

    console.log(`✅ [LIVE-ROOM] Caller ${callId} sent back to screening`);
    res.json(updatedCall);

  } catch (error) {
    console.error('❌ [LIVE-ROOM] Back to screening error:', error);
    res.status(500).json({ error: 'Failed to send caller back to screening' });
  }
});

/**
 * Get all participants in live room
 * GET /api/live-room/:episodeId/participants
 */
router.get('/:episodeId/participants', async (req: Request, res: Response) => {
  const { episodeId } = req.params;

  try {
    // Get all calls in live room (approved, on-air, on-hold)
    const participants = await prisma.call.findMany({
      where: {
        episodeId,
        status: {
          in: ['approved', 'on-air', 'on-hold']
        }
      },
      orderBy: {
        approvedAt: 'asc'
      }
    });

    res.json(participants);

  } catch (error) {
    console.error('❌ [LIVE-ROOM] Get participants error:', error);
    res.status(500).json({ error: 'Failed to get participants' });
  }
});

export default router;

