/**
 * Twilio SIP Routes
 * Handles incoming calls and generates TwiML to route them through SIP to LiveKit
 * 
 * This replaces the Media Streams approach (which was one-way only)
 * with SIP integration (full bidirectional audio!)
 */

import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import twilio from 'twilio';

const router = express.Router();
const prisma = new PrismaClient();
const VoiceResponse = twilio.twiml.VoiceResponse;

/**
 * POST /api/twilio-sip/incoming-call
 * Handle incoming phone calls from Twilio
 * 
 * Generates TwiML that connects the call via SIP to LiveKit
 */
router.post('/incoming-call', async (req: Request, res: Response) => {
  try {
    const { CallSid, From, To, CallStatus } = req.body;
    
    console.log('📞 [TWILIO-SIP] Incoming call:');
    console.log(`   CallSid: ${CallSid}`);
    console.log(`   From: ${From}`);
    console.log(`   To: ${To}`);
    console.log(`   Status: ${CallStatus}`);
    
    // Find or create caller
    let caller = await prisma.caller.findFirst({
      where: { phoneNumber: From }
    });
    
    if (!caller) {
      caller = await prisma.caller.create({
        data: {
          phoneNumber: From,
          name: `Caller ${From.slice(-4)}` // Use last 4 digits as default name
        }
      });
      console.log(`✅ [TWILIO-SIP] New caller created: ${caller.id}`);
    }
    
    // Find active episode to route call to
    const activeEpisode = await prisma.episode.findFirst({
      where: {
        status: 'live'
      },
      orderBy: {
        scheduledStart: 'desc'
      }
    });
    
    if (!activeEpisode) {
      // No active episode - play message and hang up
      const response = new VoiceResponse();
      response.say({
        voice: 'Polly.Joanna'
      }, 'Sorry, there are no live shows at the moment. Please call back later.');
      response.hangup();
      
      res.type('text/xml');
      res.send(response.toString());
      return;
    }
    
    // Create call record
    const call = await prisma.call.create({
      data: {
        episodeId: activeEpisode.id,
        callerId: caller.id,
        twilioCallSid: CallSid,
        status: 'queued'
      }
    });
    
    console.log(`✅ [TWILIO-SIP] Call record created: ${call.id}`);
    
    // Get SIP call flow manager
    const sipCallFlowManager = req.app.get('sipCallFlowManager');
    
    if (sipCallFlowManager) {
      // Route to LiveKit via SIP
      await sipCallFlowManager.handleIncomingCall(
        CallSid,
        call.id,
        activeEpisode.id,
        caller.name || `Caller ${From.slice(-4)}`,
        From
      );
    }
    
    // Generate TwiML to connect via SIP to LiveKit
    const response = new VoiceResponse();
    
    // Welcome message
    response.say({
      voice: 'Polly.Joanna'
    }, `Welcome to ${activeEpisode.title}. Please hold while we connect you to a screener.`);
    
    // Connect to LiveKit SIP service
    // The SIP URI format is: sip:roomName@your-livekit-sip-service.railway.app
    const sipUri = `sip:lobby@${process.env.LIVEKIT_SIP_DOMAIN}`;
    
    const dial = response.dial({
      answerOnBridge: true,
      callerId: To // Use show's phone number as caller ID
    });
    
    dial.sip({
      uri: sipUri,
      username: call.id, // Use call ID as SIP username for tracking
      password: process.env.LIVEKIT_SIP_PASSWORD || ''
    });
    
    // If SIP connection fails
    response.say({
      voice: 'Polly.Joanna'
    }, 'Sorry, we are experiencing technical difficulties. Please try again later.');
    response.hangup();
    
    console.log(`✅ [TWILIO-SIP] TwiML generated for call ${CallSid}`);
    console.log(`   Routing to SIP: ${sipUri}`);
    
    res.type('text/xml');
    res.send(response.toString());
    
  } catch (error: any) {
    console.error('❌ [TWILIO-SIP] Error handling incoming call:', error);
    
    // Send error TwiML
    const response = new VoiceResponse();
    response.say({
      voice: 'Polly.Joanna'
    }, 'Sorry, an error occurred. Please try again later.');
    response.hangup();
    
    res.type('text/xml');
    res.send(response.toString());
  }
});

/**
 * POST /api/twilio-sip/call-status
 * Handle call status updates from Twilio
 */
router.post('/call-status', async (req: Request, res: Response) => {
  try {
    const { CallSid, CallStatus, CallDuration } = req.body;
    
    console.log(`📊 [TWILIO-SIP] Call status update:`);
    console.log(`   CallSid: ${CallSid}`);
    console.log(`   Status: ${CallStatus}`);
    console.log(`   Duration: ${CallDuration}`);
    
    // Find call in database
    const call = await prisma.call.findFirst({
      where: { twilioCallSid: CallSid }
    });
    
    if (!call) {
      console.warn(`⚠️ [TWILIO-SIP] Call not found: ${CallSid}`);
      res.sendStatus(200);
      return;
    }
    
    // Update call based on status
    if (CallStatus === 'completed') {
      await prisma.call.update({
        where: { id: call.id },
        data: {
          status: 'completed',
          duration: parseInt(CallDuration || '0'),
          endedAt: new Date()
        }
      });
      
      console.log(`✅ [TWILIO-SIP] Call ${call.id} marked as completed`);
      
      // Notify call flow manager
      const sipCallFlowManager = req.app.get('sipCallFlowManager');
      if (sipCallFlowManager) {
        await sipCallFlowManager.endCall(call.id);
      }
    }
    
    res.sendStatus(200);
    
  } catch (error: any) {
    console.error('❌ [TWILIO-SIP] Error handling call status:', error);
    res.sendStatus(500);
  }
});

/**
 * POST /api/twilio-sip/move-to-screening
 * Move a caller to screening room
 */
router.post('/move-to-screening', async (req: Request, res: Response) => {
  try {
    const { callId, screenerId } = req.body;
    
    console.log(`🎯 [TWILIO-SIP] Moving call ${callId} to screening`);
    
    const sipCallFlowManager = req.app.get('sipCallFlowManager');
    
    if (!sipCallFlowManager) {
      return res.status(503).json({ error: 'SIP service not available' });
    }
    
    const roomName = await sipCallFlowManager.moveToScreening(callId, screenerId);
    
    res.json({
      success: true,
      roomName,
      message: 'Call moved to screening'
    });
    
  } catch (error: any) {
    console.error('❌ [TWILIO-SIP] Error moving to screening:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/twilio-sip/move-to-hold
 * Move a caller to hold (they hear the live show!)
 */
router.post('/move-to-hold', async (req: Request, res: Response) => {
  try {
    const { callId } = req.body;
    
    console.log(`⏸️ [TWILIO-SIP] Moving call ${callId} to hold`);
    
    const sipCallFlowManager = req.app.get('sipCallFlowManager');
    
    if (!sipCallFlowManager) {
      return res.status(503).json({ error: 'SIP service not available' });
    }
    
    const roomName = await sipCallFlowManager.moveToHold(callId);
    
    res.json({
      success: true,
      roomName,
      message: 'Call on hold - caller will hear live show'
    });
    
  } catch (error: any) {
    console.error('❌ [TWILIO-SIP] Error moving to hold:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/twilio-sip/move-to-live
 * Move a caller to live (on-air!)
 */
router.post('/move-to-live', async (req: Request, res: Response) => {
  try {
    const { callId } = req.body;
    
    console.log(`📡 [TWILIO-SIP] Moving call ${callId} ON AIR`);
    
    const sipCallFlowManager = req.app.get('sipCallFlowManager');
    
    if (!sipCallFlowManager) {
      return res.status(503).json({ error: 'SIP service not available' });
    }
    
    const roomName = await sipCallFlowManager.moveToLive(callId);
    
    res.json({
      success: true,
      roomName,
      message: 'Call is now LIVE on air!'
    });
    
  } catch (error: any) {
    console.error('❌ [TWILIO-SIP] Error moving to live:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/twilio-sip/end-call
 * End a call
 */
router.post('/end-call', async (req: Request, res: Response) => {
  try {
    const { callId } = req.body;
    
    console.log(`📴 [TWILIO-SIP] Ending call ${callId}`);
    
    const sipCallFlowManager = req.app.get('sipCallFlowManager');
    
    if (!sipCallFlowManager) {
      return res.status(503).json({ error: 'SIP service not available' });
    }
    
    await sipCallFlowManager.endCall(callId);
    
    res.json({
      success: true,
      message: 'Call ended'
    });
    
  } catch (error: any) {
    console.error('❌ [TWILIO-SIP] Error ending call:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

