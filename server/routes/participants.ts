/**
 * Participant Control Routes
 * 
 * API for managing participant states (on-air, hold, screening)
 */

import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ParticipantService } from '../services/participantService.js';
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
 * GET /api/participants/:episodeId - Get all active participants for an episode
 */
router.get('/:episodeId', async (req: Request, res: Response) => {
  try {
    const { episodeId } = req.params;
    const participants = await ParticipantService.getActiveParticipants(episodeId);
    res.json(participants);
  } catch (error) {
    console.error('Error fetching participants:', error);
    res.status(500).json({ error: 'Failed to fetch participants' });
  }
});

/**
 * PATCH /api/participants/:callId/on-air - Put participant on air
 */
router.patch('/:callId/on-air', async (req: Request, res: Response) => {
  try {
    const { callId } = req.params;

    const mediaBridge = req.app.get('mediaBridge');
    const sipService = req.app.get('sipService');
    
    const { putOnAirSimple } = await import('../services/putOnAirSimple.js');
    await putOnAirSimple(callId, mediaBridge, sipService);

    const callFlow = getCallFlowService(req);
    const result = await callFlow.putOnAir(callId);

    res.json({ success: true, state: 'on-air', ...result });
  } catch (error) {
    console.error('Error putting participant on air:', error);
    res.status(500).json({ error: 'Failed to put participant on air' });
  }
});

/**
 * PATCH /api/participants/:callId/hold - Put participant on hold
 */
router.patch('/:callId/hold', async (req: Request, res: Response) => {
  try {
    const { callId } = req.params;
    await ParticipantService.putOnHold(callId);

    const callFlow = getCallFlowService(req);
    const result = await callFlow.putOnHold(callId);

    res.json({ success: true, state: 'hold', ...result });
  } catch (error) {
    console.error('Error putting participant on hold:', error);
    res.status(500).json({ error: 'Failed to put participant on hold' });
  }
});

/**
 * PATCH /api/participants/:callId/off-hold - Take participant off hold
 * They remain muted but can hear conference audio (for approved callers during live show)
 */
router.patch('/:callId/off-hold', async (req: Request, res: Response) => {
  try {
    const { callId } = req.params;
    
    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: { episode: true }
    });
    
    if (!call || !call.twilioCallSid || !call.twilioConferenceSid) {
      return res.status(404).json({ error: 'Call or conference not found' });
    }
    
    // Take off hold - they can now hear conference audio
    const twilioClient = (await import('../services/twilioService.js')).default;
    
    if (!twilioClient) {
      return res.status(500).json({ error: 'Twilio client not available' });
    }
    
    const conferenceSid = call.episode?.twilioConferenceSid || call.twilioConferenceSid;
    
    await twilioClient
      .conferences(conferenceSid)
      .participants(call.twilioCallSid)
      .update({
        hold: false  // Can now hear conference (host mic, opener, etc.)
        // Keep muted: true (already set when approved)
      });
    
    // Update database
    await prisma.call.update({
      where: { id: callId },
      data: { isOnHold: false }
    });
    
    console.log(`✅ [OFF-HOLD] Participant ${callId} can now hear live show`);
    
    res.json({ success: true, state: 'listening' });
  } catch (error) {
    console.error('Error taking participant off hold:', error);
    res.status(500).json({ error: 'Failed to take participant off hold' });
  }
});

/**
 * PATCH /api/participants/:callId/screening - Move participant to screening
 */
router.patch('/:callId/screening', async (req: Request, res: Response) => {
  try {
    const { callId } = req.params;
    
    // Get call to find episodeId for targeted emit
    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: { caller: true }
    });
    
    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }
    
    await ParticipantService.putInScreening(callId);

    const callFlow = getCallFlowService(req);
    const result = await callFlow.returnToScreening(callId);

    res.json({ success: true, state: 'screening', ...result });
  } catch (error) {
    console.error('Error moving participant to screening:', error);
    res.status(500).json({ error: 'Failed to move participant to screening' });
  }
});

/**
 * PATCH /api/participants/:callId/mute - Mute participant in conference
 */
router.patch('/:callId/mute', async (req: Request, res: Response) => {
  try {
    const { callId } = req.params;
    await ParticipantService.muteParticipant(callId);
    
    // Emit WebSocket event
    const io = req.app.get('io');
    io.emit('participant:mute-changed', { callId, muted: true });
    
    res.json({ success: true, muted: true });
  } catch (error) {
    console.error('Error muting participant:', error);
    res.status(500).json({ error: 'Failed to mute participant' });
  }
});

/**
 * PATCH /api/participants/:callId/unmute - Unmute participant in conference
 */
router.patch('/:callId/unmute', async (req: Request, res: Response) => {
  try {
    const { callId } = req.params;
    await ParticipantService.unmuteParticipant(callId);
    
    // Emit WebSocket event
    const io = req.app.get('io');
    io.emit('participant:mute-changed', { callId, muted: false });
    
    res.json({ success: true, muted: false });
  } catch (error) {
    console.error('Error unmuting participant:', error);
    res.status(500).json({ error: 'Failed to unmute participant' });
  }
});

export default router;

