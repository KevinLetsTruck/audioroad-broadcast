/**
 * Participant Control Routes
 * 
 * API for managing participant states (on-air, hold, screening)
 */

import express, { Request, Response } from 'express';
import { ParticipantService } from '../services/participantService.js';

const router = express.Router();

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
    await ParticipantService.putOnAir(callId);
    
    // Emit WebSocket event
    const io = req.app.get('io');
    io.emit('participant:state-changed', { callId, state: 'on-air' });
    
    res.json({ success: true, state: 'on-air' });
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
    
    // Emit WebSocket event
    const io = req.app.get('io');
    io.emit('participant:state-changed', { callId, state: 'hold' });
    
    res.json({ success: true, state: 'hold' });
  } catch (error) {
    console.error('Error putting participant on hold:', error);
    res.status(500).json({ error: 'Failed to put participant on hold' });
  }
});

/**
 * PATCH /api/participants/:callId/screening - Move participant to screening
 */
router.patch('/:callId/screening', async (req: Request, res: Response) => {
  try {
    const { callId } = req.params;
    await ParticipantService.putInScreening(callId);
    
    // Emit WebSocket event
    const io = req.app.get('io');
    io.emit('participant:state-changed', { callId, state: 'screening' });
    
    res.json({ success: true, state: 'screening' });
  } catch (error) {
    console.error('Error moving participant to screening:', error);
    res.status(500).json({ error: 'Failed to move participant to screening' });
  }
});

export default router;

