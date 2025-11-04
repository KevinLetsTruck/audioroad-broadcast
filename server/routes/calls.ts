import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { emitToEpisode } from '../services/socketService.js';
import { createCallSchema, updateCallStatusSchema, sanitizeString } from '../utils/validation.js';
import twilio from 'twilio';
import { twilioClient } from '../services/twilioService.js';

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
 * PATCH /api/calls/:id/screen - Mark call as being screened
 */
router.patch('/:id/screen', async (req: Request, res: Response) => {
  try {
    const { screenerUserId } = req.body;

    const call = await prisma.call.update({
      where: { id: req.params.id },
      data: {
        status: 'screening',
        screenedAt: new Date(),
        screenerUserId: screenerUserId || undefined
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
    // Validate input
    const validated = updateCallStatusSchema.parse(req.body);
    let { screenerNotes, topic } = validated;
    const { priority } = validated;
    
    // Sanitize text inputs
    if (screenerNotes) screenerNotes = sanitizeString(screenerNotes, 1000);
    if (topic) topic = sanitizeString(topic, 500);

    // Get existing call to preserve conference info
    const existingCall = await prisma.call.findUnique({
      where: { id: req.params.id },
      include: { episode: true }
    });

    if (!existingCall) {
      return res.status(404).json({ error: 'Call not found' });
    }

    // Calculate queue position: count approved calls not yet on-air, ordered by approvedAt
    const approvedCalls = await prisma.call.findMany({
      where: {
        episodeId: existingCall.episodeId,
        status: 'approved',
        endedAt: null,
        onAirAt: null // Not yet on-air
      },
      orderBy: { approvedAt: 'asc' }
    });

    // Count on-air calls
    const onAirCalls = await prisma.call.count({
      where: {
        episodeId: existingCall.episodeId,
        status: 'on-air',
        endedAt: null
      }
    });

    // Queue position = approved count + 1 (this call) - on-air count
    const queuePosition = approvedCalls.length + 1 - onAirCalls;
    const finalPosition = Math.max(1, queuePosition); // Ensure at least 1

    console.log(`📊 Queue position calculated: ${finalPosition} (approved: ${approvedCalls.length + 1}, on-air: ${onAirCalls})`);

    // Update call to approved status
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
        // Preserve existing conference SID or set it if missing
        twilioConferenceSid: existingCall.twilioConferenceSid || `episode-${existingCall.episodeId}`,
        // Keep muted in conference
        isMutedInConference: true,
        isOnHold: true // They are on hold with Radio.co stream
      },
      include: {
        caller: true,
        episode: true
      }
    });

    // Put caller on hold so they hear the live show while waiting for host
    // This is the ONLY place we use hold state - just for the queue
    if (call.twilioCallSid && call.twilioConferenceSid && twilioClient) {
      try {
        const appUrl = process.env.APP_URL || 'https://audioroad-broadcast-production.up.railway.app';
        const conferenceSid = call.episode?.twilioConferenceSid || call.twilioConferenceSid;
        
        await twilioClient
          .conferences(conferenceSid)
          .participants(call.twilioCallSid)
          .update({
            muted: true,
            hold: true, // On hold so they hear waitUrl (live show)
            holdUrl: `${appUrl}/api/twilio/wait-audio`,
            holdMethod: 'POST',
            announceUrl: `${appUrl}/api/twilio/queue-announcement?position=${finalPosition}`,
            announceMethod: 'POST'
          } as any);
        
        console.log(`✅ [APPROVE] Participant on hold hearing live show (position ${finalPosition})`);
      } catch (error) {
        console.error('⚠️ [APPROVE] Failed to put on hold:', error);
      }
    }

    const io = req.app.get('io');
    emitToEpisode(io, call.episodeId, 'call:approved', call);

    console.log(`✅ Call approved: ${call.id} - Participant in HOLD state (conference: ${call.twilioConferenceSid}, queue position: ${finalPosition})`);

    res.json({ ...call, queuePosition: finalPosition });
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

    // Remove participant from conference (if in one)
    if (call.twilioConferenceSid && call.twilioCallSid) {
      try {
        const { removeFromConference } = await import('../services/conferenceService.js');
        await removeFromConference(call.twilioCallSid, call.episodeId);
        console.log('📴 Removed participant from conference:', call.twilioCallSid);
      } catch (confError) {
        console.error('⚠️ Error removing from conference:', confError);
        // Fallback: try to end the call directly
        try {
          const { endCall } = await import('../services/twilioService.js');
          await endCall(call.twilioCallSid);
          console.log('📴 Ended Twilio call directly:', call.twilioCallSid);
        } catch (twilioError) {
          console.error('⚠️ Error ending Twilio call:', twilioError);
        }
      }
    } else if (call.twilioCallSid && call.twilioCallSid.startsWith('CA')) {
      // Not in conference, end call directly
      try {
        const { endCall } = await import('../services/twilioService.js');
        await endCall(call.twilioCallSid);
        console.log('📴 Ended Twilio call via host:', call.twilioCallSid);
      } catch (twilioError) {
        console.error('⚠️ Error ending Twilio call:', twilioError);
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

