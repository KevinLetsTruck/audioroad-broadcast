/**
 * LiveKit SIP Webhooks
 * Handles incoming SIP call notifications from LiveKit
 * This makes SIP calls work with our existing UI (Socket.IO notifications)
 */

import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { WebhookReceiver } from 'livekit-server-sdk';

const router = express.Router();
const prisma = new PrismaClient();

// Initialize webhook receiver with LiveKit credentials
const webhookReceiver = new WebhookReceiver(
  process.env.LIVEKIT_API_KEY!,
  process.env.LIVEKIT_API_SECRET!
);

// CRITICAL: Use express.raw() middleware for this route to get raw body
// LiveKit needs the raw body to validate the signature
router.use(express.raw({ type: 'application/webhook+json' }));

/**
 * POST /api/livekit-sip/incoming
 * Called by LiveKit when room events happen (participant_joined, etc.)
 * We filter for SIP participants joining the lobby room
 */
router.post('/incoming', async (req: Request, res: Response) => {
  try {
    // Validate and decode the webhook
    const authHeader = req.get('Authorization');
    if (!authHeader) {
      console.error('❌ [LIVEKIT-WEBHOOK] No authorization header');
      return res.sendStatus(401);
    }
    
    // Receive and validate the webhook event
    const event = await webhookReceiver.receive(req.body, authHeader);
    
    console.log('📞 [LIVEKIT-WEBHOOK] Event from LiveKit:', event.event);
    console.log(`   Room: ${event.room?.name}`);
    console.log(`   Participant: ${event.participant?.identity}`);
    
    // Only handle participant_joined events in lobby room
    if (event.event !== 'participant_joined' || event.room?.name !== 'lobby') {
      return res.sendStatus(200); // Acknowledge but ignore
    }
    
    // Check if this is a SIP participant (they have phone number in metadata)
    const phoneNumber = event.participant?.attributes?.phoneNumber || event.participant?.identity;
    
    console.log('📞 [LIVEKIT-SIP-WEBHOOK] SIP participant joined lobby:');
    console.log(`   Identity: ${event.participant?.identity}`);
    console.log(`   Phone: ${phoneNumber}`);
    
    // Extract phone number (might be in different formats)
    // SIP participants from Twilio usually have caller ID in identity or metadata
    const callerPhoneNumber = phoneNumber || `+${event.participant?.identity}`;
    
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
    
    // Find active or scheduled episode (screeners can take calls before show goes live)
    const activeEpisode = await prisma.episode.findFirst({
      where: { 
        status: { 
          in: ['scheduled', 'live'] // Accept both scheduled and live episodes
        } 
      },
      orderBy: { scheduledStart: 'desc' }
    });
    
    if (!activeEpisode) {
      console.log('⚠️ [LIVEKIT-SIP-WEBHOOK] No active episode');
      return res.sendStatus(200); // Acknowledge but don't create call
    }
    
    // Check if call record already exists for this participant
    let call = await prisma.call.findFirst({
      where: {
        twilioCallSid: event.participant?.sid,
        status: { in: ['queued', 'screening', 'approved', 'on-hold', 'on-air'] }
      }
    });
    
    if (!call) {
      // Create new call record
      call = await prisma.call.create({
        data: {
          episodeId: activeEpisode.id,
          callerId: caller.id,
          twilioCallSid: event.participant?.sid || '', // Use LiveKit participant SID
          status: 'queued'
        }
      });
      console.log(`✅ [LIVEKIT-SIP-WEBHOOK] Call record created: ${call.id}`);
    } else {
      console.log(`ℹ️ [LIVEKIT-SIP-WEBHOOK] Call already exists: ${call.id}`);
    }
    
    // Handle participant_left events too (same endpoint)
    if (event.event === 'participant_left' && event.room?.name === 'lobby') {
      const leftCall = await prisma.call.findFirst({
        where: { twilioCallSid: event.participant?.sid }
      });
      
      if (leftCall) {
        await prisma.call.update({
          where: { id: leftCall.id },
          data: { status: 'completed', endedAt: new Date() }
        });
        
        const io = req.app.get('io');
        if (io) {
          io.to(`episode:${leftCall.episodeId}`).emit('call:completed', { callId: leftCall.id });
        }
        
        console.log(`✅ [LIVEKIT-SIP-WEBHOOK] Call ${leftCall.id} ended`);
      }
      
      return res.sendStatus(200);
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
    console.error('Error stack:', error.stack);
    return res.sendStatus(500);
  }
});

export default router;

