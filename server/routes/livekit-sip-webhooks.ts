/**
 * LiveKit SIP Webhooks
 * Handles incoming SIP call notifications from LiveKit
 * This makes SIP calls work with our existing UI (Socket.IO notifications)
 */

import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * POST /api/livekit-sip/incoming
 * Called by LiveKit when a SIP call comes in
 * This creates the call record and emits Socket.IO events
 */
router.post('/incoming', async (req: Request, res: Response) => {
  try {
    const { call_id, from_number, to_number, trunk_id } = req.body;
    
    console.log('📞 [LIVEKIT-SIP-WEBHOOK] Incoming SIP call from LiveKit:');
    console.log(`   LiveKit Call ID: ${call_id}`);
    console.log(`   From: ${from_number}`);
    console.log(`   To: ${to_number}`);
    console.log(`   Trunk: ${trunk_id}`);
    
    // Find or create caller
    let caller = await prisma.caller.findFirst({
      where: { phoneNumber: from_number }
    });
    
    if (!caller) {
      caller = await prisma.caller.create({
        data: {
          phoneNumber: from_number,
          name: `Caller ${from_number.slice(-4)}`,
          firstCallDate: new Date(),
          lastCallDate: new Date()
        }
      });
      console.log(`✅ [LIVEKIT-SIP-WEBHOOK] New caller created: ${caller.id}`);
    }
    
    // Find active episode
    const activeEpisode = await prisma.episode.findFirst({
      where: { status: 'live' },
      orderBy: { scheduledStart: 'desc' }
    });
    
    if (!activeEpisode) {
      console.log('⚠️ [LIVEKIT-SIP-WEBHOOK] No active episode - rejecting call');
      
      // Tell LiveKit to reject the call (no active show)
      return res.json({
        action: 'reject',
        message: 'No live show at the moment'
      });
    }
    
    // Create call record
    const call = await prisma.call.create({
      data: {
        episodeId: activeEpisode.id,
        callerId: caller.id,
        twilioCallSid: call_id, // Use LiveKit call ID
        status: 'queued'
      }
    });
    
    console.log(`✅ [LIVEKIT-SIP-WEBHOOK] Call record created: ${call.id}`);
    
    // Emit Socket.IO event to notify screening UI
    const io = req.app.get('io');
    if (io) {
      io.to(`episode:${activeEpisode.id}`).emit('call:incoming', {
        id: call.id,
        callerId: caller.id,
        caller: caller,
        status: 'queued',
        episodeId: activeEpisode.id
      });
      console.log(`📢 [LIVEKIT-SIP-WEBHOOK] Socket.IO event emitted to episode:${activeEpisode.id}`);
    }
    
    // Tell LiveKit to route the call to the lobby room
    // The screener will pick it up from there
    return res.json({
      action: 'accept',
      room_name: 'lobby',
      participant_identity: call.id,
      participant_name: caller.name || `Caller ${from_number.slice(-4)}`
    });
    
  } catch (error: any) {
    console.error('❌ [LIVEKIT-SIP-WEBHOOK] Error:', error);
    
    // Reject the call on error
    return res.status(500).json({
      action: 'reject',
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/livekit-sip/ended
 * Called by LiveKit when a SIP call ends
 */
router.post('/ended', async (req: Request, res: Response) => {
  try {
    const { call_id, duration } = req.body;
    
    console.log(`📴 [LIVEKIT-SIP-WEBHOOK] Call ended: ${call_id}`);
    console.log(`   Duration: ${duration}s`);
    
    // Find call by LiveKit call ID (stored in twilioCallSid)
    const call = await prisma.call.findFirst({
      where: { twilioCallSid: call_id }
    });
    
    if (!call) {
      console.warn(`⚠️ [LIVEKIT-SIP-WEBHOOK] Call not found: ${call_id}`);
      return res.sendStatus(200);
    }
    
    // Update call status
    await prisma.call.update({
      where: { id: call.id },
      data: {
        status: 'completed',
        endedAt: new Date()
      }
    });
    
    // Emit Socket.IO event
    const io = req.app.get('io');
    if (io) {
      io.to(`episode:${call.episodeId}`).emit('call:completed', {
        callId: call.id
      });
    }
    
    console.log(`✅ [LIVEKIT-SIP-WEBHOOK] Call ${call.id} marked as completed`);
    
    res.sendStatus(200);
    
  } catch (error: any) {
    console.error('❌ [LIVEKIT-SIP-WEBHOOK] Error:', error);
    res.sendStatus(500);
  }
});

export default router;

