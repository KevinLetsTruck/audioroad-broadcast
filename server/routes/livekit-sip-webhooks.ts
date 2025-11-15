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
 * Called by LiveKit when room events happen (participant_joined, etc.)
 * We filter for SIP participants joining the lobby room
 */
router.post('/incoming', async (req: Request, res: Response) => {
  try {
    const { event, participant, room } = req.body;
    
    console.log('📞 [LIVEKIT-WEBHOOK] Event from LiveKit:', event);
    console.log(`   Room: ${room?.name}`);
    console.log(`   Participant: ${participant?.identity}`);
    
    // Only handle participant_joined events in lobby room
    if (event !== 'participant_joined' || room?.name !== 'lobby') {
      return res.sendStatus(200); // Acknowledge but ignore
    }
    
    // Check if this is a SIP participant (they have phone number in metadata)
    const phoneNumber = participant?.attributes?.phoneNumber || participant?.identity;
    
    console.log('📞 [LIVEKIT-SIP-WEBHOOK] SIP participant joined lobby:');
    console.log(`   Identity: ${participant.identity}`);
    console.log(`   Phone: ${phoneNumber}`);
    
    // Extract phone number (might be in different formats)
    // SIP participants from Twilio usually have caller ID in identity or metadata
    const callerPhoneNumber = phoneNumber || `+${participant.identity}`;
    
    // Find or create caller
    let caller = await prisma.caller.findFirst({
      where: { phoneNumber: callerPhoneNumber }
    });
    
    if (!caller) {
      caller = await prisma.caller.create({
        data: {
          phoneNumber: callerPhoneNumber,
          name: `Caller ${callerPhoneNumber.slice(-4)}`,
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
      console.log('⚠️ [LIVEKIT-SIP-WEBHOOK] No active episode');
      return res.sendStatus(200); // Acknowledge but don't create call
    }
    
    // Check if call record already exists for this participant
    let call = await prisma.call.findFirst({
      where: {
        twilioCallSid: participant.sid,
        status: { in: ['queued', 'screening', 'approved', 'on-hold', 'on-air'] }
      }
    });
    
    if (!call) {
      // Create new call record
      call = await prisma.call.create({
        data: {
          episodeId: activeEpisode.id,
          callerId: caller.id,
          twilioCallSid: participant.sid, // Use LiveKit participant SID
          status: 'queued'
        }
      });
      console.log(`✅ [LIVEKIT-SIP-WEBHOOK] Call record created: ${call.id}`);
    } else {
      console.log(`ℹ️ [LIVEKIT-SIP-WEBHOOK] Call already exists: ${call.id}`);
    }
    
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
    
    // Acknowledge the webhook
    return res.sendStatus(200);
    
  } catch (error: any) {
    console.error('❌ [LIVEKIT-SIP-WEBHOOK] Error:', error);
    return res.sendStatus(500);
  }
});

/**
 * Handle participant_left events (when call ends)
 */
router.post('/participant-left', async (req: Request, res: Response) => {
  try {
    const { participant, room } = req.body;
    
    console.log(`📴 [LIVEKIT-SIP-WEBHOOK] Participant left`);
    console.log(`   Participant: ${participant?.identity}`);
    console.log(`   Room: ${room?.name}`);
    
    // Find call by LiveKit participant SID
    const call = await prisma.call.findFirst({
      where: { twilioCallSid: participant?.sid }
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

