import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { emitToEpisode } from '../services/socketService.js';
import { createCallSchema, updateCallStatusSchema, sanitizeString } from '../utils/validation.js';
import twilio from 'twilio';
import { twilioClient } from '../services/twilioService.js';
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
 * GET /api/calls - Get all calls for an episode
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { episodeId, status } = req.query;

    const where: any = {};
    if (episodeId) where.episodeId = episodeId as string;
    if (status) where.status = status as string;

    const calls = await prisma.call.findMany({
      where,
      include: {
        caller: true,
        episode: {
          include: {
            show: true
          }
        },
        session: true
      },
      orderBy: {
        incomingAt: 'desc'
      }
    });

    res.json(calls);
  } catch (error) {
    console.error('Error fetching calls:', error);
    res.status(500).json({ error: 'Failed to fetch calls' });
  }
});

/**
 * GET /api/calls/:id - Get single call details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const call = await prisma.call.findUnique({
      where: { id: req.params.id },
      include: {
        caller: {
          include: {
            calls: {
              orderBy: { incomingAt: 'desc' },
              take: 10
            }
          }
        },
        episode: {
          include: {
            show: true
          }
        },
        session: true
      }
    });

    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }

    res.json(call);
  } catch (error) {
    console.error('Error fetching call:', error);
    res.status(500).json({ error: 'Failed to fetch call' });
  }
});

/**
 * POST /api/calls - Create new call (incoming call)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // Validate input
    const validated = createCallSchema.parse(req.body);
    let { episodeId, topic } = validated;
    const { callerId, twilioCallSid, status } = validated;
    
    // Sanitize text inputs
    if (topic) topic = sanitizeString(topic, 500);
    
    // If episodeId is 'current', find the active live episode
    if (episodeId === 'current') {
      const activeEpisode = await prisma.episode.findFirst({
        where: { status: 'live' },
        orderBy: { scheduledStart: 'desc' }
      });
      
      if (!activeEpisode) {
        return res.status(400).json({ error: 'No live episode found' });
      }
      
      episodeId = activeEpisode.id;
      console.log('📞 Creating call for active episode:', activeEpisode.title);
    }

    const call = await prisma.call.create({
      data: {
        episodeId,
        callerId,
        twilioCallSid,
        topic,
        status: status || 'incoming', // Use provided status or default to 'incoming'
        incomingAt: new Date(),
        queuedAt: status === 'queued' ? new Date() : undefined
      },
      include: {
        caller: true,
        episode: true
      }
    });

    console.log('✅ Call record created:', call.id, 'Status:', call.status);

    try {
      const callFlow = getCallFlowService(req);
      const { call: hydratedCall, session } = await callFlow.registerIncomingCall(call.id);
      res.status(201).json({ call: hydratedCall, session });
    } catch (flowError) {
      console.error('⚠️ Failed to register call session:', flowError);
      res.status(201).json({ call, session: null });
    }
  } catch (error) {
    console.error('Error creating call:', error);
    res.status(500).json({ error: 'Failed to create call' });
  }
});

/**
 * PATCH /api/calls/:id/queue - Move call to queue
 */
router.patch('/:id/queue', async (req: Request, res: Response) => {
  try {
    const callFlow = getCallFlowService(req);
    const { call } = await callFlow.queueCall(req.params.id);
    res.json(call);
  } catch (error) {
    console.error('Error queueing call:', error);
    res.status(500).json({ error: 'Failed to queue call' });
  }
});

/**
 * PATCH /api/calls/:id/screen - Mark call as being screened
 */
router.patch('/:id/screen', async (req: Request, res: Response) => {
  try {
    const { screenerUserId } = req.body;

    const callFlow = getCallFlowService(req);
    const { call } = await callFlow.startScreening(req.params.id, screenerUserId);
    console.log('✅ Call marked as screening:', call.id);
    res.json(call);
  } catch (error) {
    console.error('Error updating call to screening:', error);
    res.status(500).json({ error: 'Failed to update call status' });
  }
});

/**
 * PATCH /api/calls/:id/approve - Approve call for on-air
 */
router.patch('/:id/approve', async (req: Request, res: Response) => {
  try {
    const validated = updateCallStatusSchema.parse(req.body);
    let { screenerNotes, topic } = validated;
    const { priority } = validated;

    if (screenerNotes) screenerNotes = sanitizeString(screenerNotes, 1000);
    if (topic) topic = sanitizeString(topic, 500);

    const callFlow = getCallFlowService(req);
    const { call, queuePosition } = await callFlow.approveCall(req.params.id, {
      screenerNotes,
      topic,
      priority,
    });

    console.log(`✅ Call approved: ${call.id} - Queue position: ${queuePosition}`);
    res.json({ ...call, queuePosition });
  } catch (error) {
    console.error('Error approving call:', error);
    res.status(500).json({ error: 'Failed to approve call' });
  }
});

/**
 * PATCH /api/calls/:id/reject - Reject call
 */
router.patch('/:id/reject', async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;

    const callFlow = getCallFlowService(req);
    const { call } = await callFlow.rejectCall(req.params.id, reason);
    res.json(call);
  } catch (error) {
    console.error('Error rejecting call:', error);
    res.status(500).json({ error: 'Failed to reject call' });
  }
});

/**
 * PATCH /api/calls/:id/onair - Put call on-air
 */
router.patch('/:id/onair', async (req: Request, res: Response) => {
  try {
    const callFlow = getCallFlowService(req);
    const { call } = await callFlow.putOnAir(req.params.id);
    res.json(call);
  } catch (error) {
    console.error('Error putting call on-air:', error);
    res.status(500).json({ error: 'Failed to put call on-air' });
  }
});

/**
 * PATCH /api/calls/:id/complete - Complete call
 */
router.patch('/:id/complete', async (req: Request, res: Response) => {
  try {
    const { recordingUrl, recordingSid, duration, airDuration } = req.body;

    const callFlow = getCallFlowService(req);
    const { call } = await callFlow.completeCall(req.params.id, {
      recordingUrl,
      recordingSid,
      duration,
      airDuration,
    });

    res.json(call);
  } catch (error) {
    console.error('Error completing call:', error);
    res.status(500).json({ error: 'Failed to complete call' });
  }
});

/**
 * POST /api/calls/:id/feature - Mark call as featured
 */
router.post('/:id/feature', async (req: Request, res: Response) => {
  try {
    const call = await prisma.call.update({
      where: { id: req.params.id },
      data: {
        featured: true
      },
      include: {
        caller: true
      }
    });

    // Update caller featured calls count
    await prisma.caller.update({
      where: { id: call.callerId },
      data: {
        featuredCalls: {
          increment: 1
        }
      }
    });

    res.json(call);
  } catch (error) {
    console.error('Error featuring call:', error);
    res.status(500).json({ error: 'Failed to feature call' });
  }
});

/**
 * POST /api/calls/cleanup/:episodeId - Clean up all active calls for an episode
 * Called when END SHOW is clicked
 */
router.post('/cleanup/:episodeId', async (req: Request, res: Response) => {
  try {
    const { episodeId } = req.params;
    console.log(`🧹 [CLEANUP] Starting cleanup for episode: ${episodeId}`);

    // Find all active calls (not completed, not rejected)
    const activeCalls = await prisma.call.findMany({
      where: {
        episodeId,
        endedAt: null,
        status: {
          notIn: ['completed', 'rejected', 'missed']
        }
      }
    });

    console.log(`📞 [CLEANUP] Found ${activeCalls.length} active calls to clean up`);

    // End each call in Twilio
    for (const call of activeCalls) {
      if (call.twilioCallSid && call.twilioCallSid.startsWith('CA')) {
        try {
          const { endCall } = await import('../services/twilioService.js');
          await endCall(call.twilioCallSid);
          console.log(`📴 [CLEANUP] Ended Twilio call: ${call.twilioCallSid}`);
        } catch (twilioError) {
          console.error(`⚠️ [CLEANUP] Error ending call ${call.twilioCallSid}:`, twilioError);
          // Continue anyway
        }
      }
    }

    // Mark all as completed in database
    const result = await prisma.call.updateMany({
      where: {
        episodeId,
        endedAt: null,
        status: {
          notIn: ['completed', 'rejected', 'missed']
        }
      },
      data: {
        status: 'completed',
        endedAt: new Date()
      }
    });

    console.log(`✅ [CLEANUP] Marked ${result.count} calls as completed`);

    // Emit cleanup event to all clients
    const io = req.app.get('io');
    emitToEpisode(io, episodeId, 'episode:cleanup', { episodeId, count: result.count });

    res.json({ 
      success: true, 
      cleanedUp: result.count,
      message: `Cleaned up ${result.count} active calls`
    });
  } catch (error) {
    console.error('❌ [CLEANUP] Error cleaning up calls:', error);
    res.status(500).json({ error: 'Failed to clean up calls' });
  }
});

export default router;

