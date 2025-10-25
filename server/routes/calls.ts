import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { generateCallerSummary } from '../services/aiService.js';
import { emitToEpisode } from '../services/socketService.js';

const router = express.Router();
const prisma = new PrismaClient();

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
        }
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
        }
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
    let { episodeId, callerId, twilioCallSid, topic, status } = req.body;
    
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
        caller: true
      }
    });

    console.log('✅ Call record created:', call.id, 'Status:', call.status);

    // Emit socket event
    const io = req.app.get('io');
    emitToEpisode(io, episodeId, 'call:incoming', call);
    console.log('📡 WebSocket event emitted to episode:', episodeId);

    res.status(201).json(call);
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
    const call = await prisma.call.update({
      where: { id: req.params.id },
      data: {
        status: 'queued',
        queuedAt: new Date()
      },
      include: {
        caller: true
      }
    });

    const io = req.app.get('io');
    emitToEpisode(io, call.episodeId, 'call:queued', call);

    res.json(call);
  } catch (error) {
    console.error('Error queueing call:', error);
    res.status(500).json({ error: 'Failed to queue call' });
  }
});

/**
 * PATCH /api/calls/:id/screen - Move call to screening
 */
router.patch('/:id/screen', async (req: Request, res: Response) => {
  try {
    const { screenerUserId } = req.body;

    const call = await prisma.call.update({
      where: { id: req.params.id },
      data: {
        status: 'screening',
        screenedAt: new Date(),
        screenerUserId
      },
      include: {
        caller: true
      }
    });

    const io = req.app.get('io');
    emitToEpisode(io, call.episodeId, 'call:screening', call);

    res.json(call);
  } catch (error) {
    console.error('Error screening call:', error);
    res.status(500).json({ error: 'Failed to screen call' });
  }
});

/**
 * PATCH /api/calls/:id/screen - Mark call as being screened
 */
router.patch('/:id/screen', async (req: Request, res: Response) => {
  try {
    const call = await prisma.call.update({
      where: { id: req.params.id },
      data: {
        status: 'screening',
        screenedAt: new Date()
      },
      include: {
        caller: true
      }
    });

    const io = req.app.get('io');
    emitToEpisode(io, call.episodeId, 'call:screening', call);

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
    const { screenerNotes, topic, priority } = req.body;

    // Update call to approved status and set conference info
    const call = await prisma.call.update({
      where: { id: req.params.id },
      data: {
        status: 'approved',
        approvedAt: new Date(),
        screenerNotes,
        topic,
        priority: priority || 'normal',
        // Set participant state to HOLD (muted, can hear show)
        participantState: 'hold',
        // Set conference SID (episode-based conference)
        twilioConferenceSid: `episode-${req.body.episodeId || 'unknown'}`,
        // Initially muted in conference
        isMutedInConference: true,
        isOnHold: false
      },
      include: {
        caller: true,
        episode: true
      }
    });

    // If we have episode info, use proper conference name
    if (call.episode) {
      await prisma.call.update({
        where: { id: req.params.id },
        data: {
          twilioConferenceSid: `episode-${call.episode.id}`
        }
      });
    }

    const io = req.app.get('io');
    emitToEpisode(io, call.episodeId, 'call:approved', call);

    console.log(`✅ Call approved: ${call.id} - Participant state set to HOLD`);

    res.json(call);
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

    // Get call first to access twilioCallSid
    const existingCall = await prisma.call.findUnique({
      where: { id: req.params.id }
    });

    if (!existingCall) {
      return res.status(404).json({ error: 'Call not found' });
    }

    // End the Twilio call to hang up the caller
    if (existingCall.twilioCallSid && existingCall.twilioCallSid.startsWith('CA')) {
      try {
        const { endCall } = await import('../services/twilioService.js');
        await endCall(existingCall.twilioCallSid);
        console.log('📴 Ended Twilio call:', existingCall.twilioCallSid);
      } catch (twilioError) {
        console.error('⚠️ Error ending Twilio call:', twilioError);
        // Continue anyway
      }
    }

    const call = await prisma.call.update({
      where: { id: req.params.id },
      data: {
        status: 'rejected',
        endedAt: new Date(),
        screenerNotes: reason
      },
      include: {
        caller: true
      }
    });

    const io = req.app.get('io');
    emitToEpisode(io, call.episodeId, 'call:rejected', call);

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
    const call = await prisma.call.update({
      where: { id: req.params.id },
      data: {
        status: 'on-air',
        onAirAt: new Date()
      },
      include: {
        caller: true
      }
    });

    const io = req.app.get('io');
    emitToEpisode(io, call.episodeId, 'call:onair', call);

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

    const call = await prisma.call.findUnique({
      where: { id: req.params.id }
    });

    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }

    // End the Twilio call to hang up the caller
    if (call.twilioCallSid && call.twilioCallSid.startsWith('CA')) {
      try {
        const { endCall } = await import('../services/twilioService.js');
        await endCall(call.twilioCallSid);
        console.log('📴 Ended Twilio call via host:', call.twilioCallSid);
      } catch (twilioError) {
        console.error('⚠️ Error ending Twilio call:', twilioError);
        // Continue anyway
      }
    }

    // Calculate durations
    const queueDuration = call.queuedAt && call.onAirAt 
      ? Math.floor((call.onAirAt.getTime() - call.queuedAt.getTime()) / 1000)
      : null;

    const calculatedAirDuration = call.onAirAt
      ? Math.floor((Date.now() - call.onAirAt.getTime()) / 1000)
      : null;

    const updatedCall = await prisma.call.update({
      where: { id: req.params.id },
      data: {
        status: 'completed',
        endedAt: new Date(),
        recordingUrl,
        recordingSid,
        airDuration: airDuration || calculatedAirDuration || duration,
        queueDuration,
        totalDuration: duration
      },
      include: {
        caller: true
      }
    });

    // Update caller stats
    await prisma.caller.update({
      where: { id: updatedCall.callerId },
      data: {
        lastCallDate: new Date(),
        totalCalls: {
          increment: 1
        }
      }
    });

    const io = req.app.get('io');
    emitToEpisode(io, updatedCall.episodeId, 'call:completed', updatedCall);

    res.json(updatedCall);
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

export default router;

