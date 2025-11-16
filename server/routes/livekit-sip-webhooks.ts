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

// NOTE: Raw body handling is done in server/index.ts by skipping JSON parsing for this route

/**
 * POST /api/livekit-sip/incoming
 * Called by LiveKit when room events happen (participant_joined, etc.)
 * We filter for SIP participants joining the lobby room
 */
router.post('/incoming', async (req: Request, res: Response) => {
  try {
    // TEMPORARY: Skip signature validation to test if webhook works
    // Parse the body as JSON
    const bodyString = req.body.toString();
    const event = JSON.parse(bodyString);
    
    console.log('📞 [LIVEKIT-WEBHOOK] Event from LiveKit:', event.event);
    console.log(`   Room: ${event.room?.name}`);
    console.log(`   Participant: ${event.participant?.identity}`);
    
    // Handle participant_left events (when call ends)
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
    
    // Only handle participant_joined events in lobby room
    if (event.event !== 'participant_joined' || event.room?.name !== 'lobby') {
      return res.sendStatus(200); // Acknowledge but ignore
    }
    
    // CRITICAL: Only process SIP participants (identity starts with "sip_")
    // Screeners/hosts joining lobby will have identities like "screener-123456"
    const participantIdentity = event.participant?.identity || '';
    const isSIPParticipant = participantIdentity.startsWith('sip_');
    
    if (!isSIPParticipant) {
      console.log(`ℹ️ [LIVEKIT-SIP-WEBHOOK] Non-SIP participant joined lobby (${participantIdentity}), ignoring`);
      return res.sendStatus(200);
    }
    
    // Check if this is a SIP participant (they have phone number in metadata)
    const phoneNumber = event.participant?.attributes?.phoneNumber || event.participant?.identity;
    
    console.log('📞 [LIVEKIT-SIP-WEBHOOK] SIP participant joined lobby:');
    console.log(`   Identity: ${participantIdentity}`);
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
    
    // Check if call record already exists for this participant SID
    let call = await prisma.call.findFirst({
      where: {
        twilioCallSid: event.participant?.sid,
        status: { in: ['queued', 'screening', 'approved', 'on-hold', 'on-air'] }
      }
    });
    
    // Also check for very recent calls from same phone number (within last 10 seconds)
    // to prevent duplicates from rapid webhook events
    if (!call) {
      const tenSecondsAgo = new Date(Date.now() - 10000);
      call = await prisma.call.findFirst({
        where: {
          callerId: caller.id,
          episodeId: activeEpisode.id,
          incomingAt: { gte: tenSecondsAgo },
          status: { in: ['queued', 'screening', 'approved', 'on-hold', 'on-air'] }
        },
        orderBy: { incomingAt: 'desc' }
      });
      
      if (call) {
        console.log(`ℹ️ [LIVEKIT-SIP-WEBHOOK] Found recent call from same caller (${call.id}), reusing instead of creating duplicate`);
      }
    }
    
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

