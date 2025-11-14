/**
 * Screening Room API Routes
 * Manages WebRTC screening rooms for call screening
 */

import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import CallFlowService from '../services/callFlowService.js';

const router = express.Router();
const prisma = new PrismaClient();

function getCallFlowService(req: Request): CallFlowService {
  const service = req.app.get('callFlowService') as CallFlowService | undefined;
  if (!service) {
    throw new Error('CallFlowService not initialized');
  }
  return service;
}

/**
 * Pick up call (move to screening room)
 * POST /api/screening/:callId/pickup
 */
router.post('/:callId/pickup', async (req: Request, res: Response) => {
  const { callId } = req.params;
  const { screenerId } = req.body;

  try {
    console.log(`📞 [SCREENING] Picking up call: ${callId}`);

    // Use CallFlowService to handle the transition
    const callFlow = getCallFlowService(req);
    const { call, session } = await callFlow.startScreening(callId, screenerId);

    console.log(`✅ [SCREENING] Call ${callId} moved to screening via CallFlowService`);
    if (session) {
      console.log(`   Session: phase=${session.phase}, room=${session.currentRoom}`);
    }
    
    res.json(call);

  } catch (error: any) {
    console.error('❌ [SCREENING] Pickup error:', error);
    res.status(500).json({ error: 'Failed to pickup call', message: error.message });
  }
});

/**
 * Approve call (move to live room)
 * POST /api/screening/:callId/approve
 */
router.post('/:callId/approve', async (req: Request, res: Response) => {
  const { callId } = req.params;
  const { screenerNotes, topic, priority } = req.body;

  try {
    console.log(`✅ [SCREENING] Approving call: ${callId}`);

    // Use CallFlowService to handle the transition
    const callFlow = getCallFlowService(req);
    const { call, session } = await callFlow.approveCall(callId, {
      screenerNotes,
      topic,
      priority
    });

    console.log(`✅ [SCREENING] Call ${callId} approved via CallFlowService`);
    if (session) {
      console.log(`   Session: phase=${session.phase}, room=${session.currentRoom}`);
    }
    
    res.json(call);

  } catch (error: any) {
    console.error('❌ [SCREENING] Approve error:', error);
    res.status(500).json({ error: 'Failed to approve call', message: error.message });
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

