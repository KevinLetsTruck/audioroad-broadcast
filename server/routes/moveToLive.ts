/**
 * Move approved callers from SCREENING to LIVE conference
 */
import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * POST /api/calls/:id/move-to-live
 * Move a call from SCREENING to LIVE conference
 */
router.post('/:id/move-to-live', async (req: Request, res: Response) => {
  try {
    const call = await prisma.call.findUnique({
      where: { id: req.params.id }
    });
    
    if (!call || !call.twilioCallSid) {
      return res.status(404).json({ error: 'Call not found' });
    }
    
    console.log(`🔄 [MOVE-TO-LIVE] Moving call ${call.id} to LIVE conference`);
    
    const { moveParticipantToLiveConference } = await import('../services/conferenceService.js');
    await moveParticipantToLiveConference(call.twilioCallSid, call.episodeId);
    
    // Update database
    await prisma.call.update({
      where: { id: call.id },
      data: { currentConferenceType: 'live' }
    });
    
    console.log(`✅ [MOVE-TO-LIVE] Success`);
    res.json({ success: true });
  } catch (error: any) {
    console.error('❌ [MOVE-TO-LIVE] Error:', error.message);
    res.status(500).json({ error: 'Failed to move to live conference' });
  }
});

export default router;

