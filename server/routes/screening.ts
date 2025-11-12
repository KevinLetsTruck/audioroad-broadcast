/**
 * Screening Room API Routes
 * Manages WebRTC screening rooms for call screening
 */

import express, { Request, Response } from 'express';
import { prisma } from '../services/database.js';

const router = express.Router();

/**
 * Pick up call (move to screening room)
 * POST /api/screening/:callId/pickup
 */
router.post('/:callId/pickup', async (req: Request, res: Response) => {
  const { callId } = req.params;
  const { screenerId } = req.body;

  try {
    console.log(`📞 [SCREENING] Picking up call: ${callId}`);

    // Get call
    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: { episode: true }
    });

    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }

    if (call.status !== 'queued' && call.status !== 'ringing') {
      return res.status(400).json({ 
        error: `Call cannot be picked up in ${call.status} status` 
      });
    }

    // Update call status to screening
    const updatedCall = await prisma.call.update({
      where: { id: callId },
      data: {
        status: 'screening',
        screenedAt: new Date()
      }
    });

    // Get media bridge and move caller to screening room
    const mediaBridge = req.app.get('mediaBridge');
    if (mediaBridge && call.twilioCallSid) {
      const screeningRoomId = `screening-${call.episodeId}-${call.id}`;
      
      try {
        await mediaBridge.moveStreamToRoom(call.twilioCallSid, screeningRoomId);
        console.log(`✅ [SCREENING] Moved caller to screening room: ${screeningRoomId}`);
      } catch (error: any) {
        console.error('❌ [SCREENING] Failed to move to screening room:', error.message);
        // Continue anyway - caller will be in lobby until next status update
      }
    }

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`episode:${call.episodeId}`).emit('call:screening', updatedCall);
      io.to(`episode:${call.episodeId}`).emit('call:updated', updatedCall);
    }

    console.log(`✅ [SCREENING] Call ${callId} moved to screening`);
    res.json(updatedCall);

  } catch (error) {
    console.error('❌ [SCREENING] Pickup error:', error);
    res.status(500).json({ error: 'Failed to pickup call' });
  }
});

/**
 * Approve call (move to live room)
 * POST /api/screening/:callId/approve
 */
router.post('/:callId/approve', async (req: Request, res: Response) => {
  const { callId } = req.params;

  try {
    console.log(`✅ [SCREENING] Approving call: ${callId}`);

    // Get call
    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: { episode: true }
    });

    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }

    if (call.status !== 'screening') {
      return res.status(400).json({ 
        error: `Call cannot be approved from ${call.status} status` 
      });
    }

    // Update call status to approved (will be on hold in live room)
    const updatedCall = await prisma.call.update({
      where: { id: callId },
      data: {
        status: 'approved',
        approvedAt: new Date(),
        participantState: 'on-hold' // On hold until host puts them on air
      }
    });

    // Get media bridge and move caller to live room (muted)
    const mediaBridge = req.app.get('mediaBridge');
    if (mediaBridge && call.twilioCallSid) {
      const liveRoomId = `live-${call.episodeId}`;
      
      try {
        await mediaBridge.moveStreamToRoom(call.twilioCallSid, liveRoomId);
        console.log(`✅ [SCREENING] Moved caller to live room: ${liveRoomId}`);
      } catch (error: any) {
        console.error('❌ [SCREENING] Failed to move to live room:', error.message);
      }
    }

    // Emit socket events
    const io = req.app.get('io');
    if (io) {
      io.to(`episode:${call.episodeId}`).emit('call:approved', updatedCall);
      io.to(`episode:${call.episodeId}`).emit('call:updated', updatedCall);
    }

    console.log(`✅ [SCREENING] Call ${callId} approved and in live room`);
    res.json(updatedCall);

  } catch (error) {
    console.error('❌ [SCREENING] Approve error:', error);
    res.status(500).json({ error: 'Failed to approve call' });
  }
});

/**
 * Send call back to lobby
 * POST /api/screening/:callId/return-to-lobby
 */
router.post('/:callId/return-to-lobby', async (req: Request, res: Response) => {
  const { callId } = req.params;

  try {
    console.log(`↩️ [SCREENING] Returning call to lobby: ${callId}`);

    // Get call
    const call = await prisma.call.findUnique({
      where: { id: callId }
    });

    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }

    // Update call status back to queued
    const updatedCall = await prisma.call.update({
      where: { id: callId },
      data: {
        status: 'queued',
        screenedAt: null
      }
    });

    // Move caller back to lobby
    const mediaBridge = req.app.get('mediaBridge');
    if (mediaBridge && call.twilioCallSid) {
      try {
        await mediaBridge.moveStreamToRoom(call.twilioCallSid, 'lobby');
        console.log(`✅ [SCREENING] Moved caller back to lobby`);
      } catch (error: any) {
        console.error('❌ [SCREENING] Failed to move to lobby:', error.message);
      }
    }

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`episode:${call.episodeId}`).emit('call:returned-to-lobby', updatedCall);
      io.to(`episode:${call.episodeId}`).emit('call:updated', updatedCall);
    }

    console.log(`✅ [SCREENING] Call ${callId} returned to lobby`);
    res.json(updatedCall);

  } catch (error) {
    console.error('❌ [SCREENING] Return to lobby error:', error);
    res.status(500).json({ error: 'Failed to return call to lobby' });
  }
});

export default router;

