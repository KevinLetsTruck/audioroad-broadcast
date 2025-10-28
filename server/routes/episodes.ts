import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createEpisodeConference } from '../services/conferenceService.js';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/episodes - Get all episodes
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { showId, status } = req.query;

    const where: any = {};
    if (showId) where.showId = showId as string;
    if (status) where.status = status as string;

    const episodes = await prisma.episode.findMany({
      where,
      include: {
        show: true,
        _count: {
          select: { calls: true, clips: true }
        }
      },
      orderBy: {
        scheduledStart: 'desc'
      }
    });

    res.json(episodes);
  } catch (error) {
    console.error('Error fetching episodes:', error);
    res.status(500).json({ error: 'Failed to fetch episodes' });
  }
});

/**
 * GET /api/episodes/:id - Get episode details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const episode = await prisma.episode.findUnique({
      where: { id: req.params.id },
      include: {
        show: true,
        calls: {
          include: {
            caller: true
          },
          orderBy: {
            incomingAt: 'asc'
          }
        },
        clips: true,
        chatMessages: {
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });

    if (!episode) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    res.json(episode);
  } catch (error) {
    console.error('Error fetching episode:', error);
    res.status(500).json({ error: 'Failed to fetch episode' });
  }
});

/**
 * POST /api/episodes - Create new episode
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { showId, title, date, scheduledStart, scheduledEnd, description } = req.body;

    // Get next episode number for this show
    const lastEpisode = await prisma.episode.findFirst({
      where: { showId },
      orderBy: { episodeNumber: 'desc' }
    });

    const episodeNumber = (lastEpisode?.episodeNumber || 0) + 1;

    const episode = await prisma.episode.create({
      data: {
        showId,
        episodeNumber,
        title,
        date: new Date(date),
        scheduledStart: new Date(scheduledStart),
        scheduledEnd: new Date(scheduledEnd),
        description,
        status: 'scheduled'
      },
      include: {
        show: true
      }
    });

    res.status(201).json(episode);
  } catch (error) {
    console.error('Error creating episode:', error);
    res.status(500).json({ error: 'Failed to create episode' });
  }
});

/**
 * PATCH /api/episodes/:id - Update episode
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { title, description, notes, tags, status } = req.body;

    const episode = await prisma.episode.update({
      where: { id: req.params.id },
      data: {
        title,
        description,
        notes,
        tags,
        status
      }
    });

    res.json(episode);
  } catch (error) {
    console.error('Error updating episode:', error);
    res.status(500).json({ error: 'Failed to update episode' });
  }
});

/**
 * PATCH /api/episodes/:id/start - Start episode (go live)
 */
router.patch('/:id/start', async (req: Request, res: Response) => {
  try {
    // Update episode status
    const episode = await prisma.episode.update({
      where: { id: req.params.id },
      data: {
        status: 'live',
        actualStart: new Date(),
        conferenceActive: true
      }
    });

    console.log(`🎙️ [EPISODE] Starting episode: ${episode.id}`);

    // Create Twilio conference for this episode
    try {
      const conference = await createEpisodeConference(episode.id);
      console.log(`📞 [CONFERENCE] Created conference: ${conference.friendlyName || conference.sid}`);
      
      // Store conference SID
      await prisma.episode.update({
        where: { id: episode.id },
        data: {
          twilioConferenceSid: conference.sid || `episode-${episode.id}`
        }
      });
    } catch (confError) {
      console.error('⚠️ [CONFERENCE] Failed to create conference (will retry on first call):', confError);
      // Don't fail the whole request if conference creation fails
      // Conference will be created automatically when first call joins
    }

    const io = req.app.get('io');
    io.to(`episode:${episode.id}`).emit('episode:start', episode);

    res.json(episode);
  } catch (error) {
    console.error('Error starting episode:', error);
    res.status(500).json({ error: 'Failed to start episode' });
  }
});

/**
 * PATCH /api/episodes/:id/end - End episode
 */
router.patch('/:id/end', async (req: Request, res: Response) => {
  try {
    const { recordingUrl, transcriptUrl } = req.body;

    const episode = await prisma.episode.findUnique({
      where: { id: req.params.id }
    });

    if (!episode || !episode.actualStart) {
      return res.status(400).json({ error: 'Episode not started' });
    }

    console.log(`🎙️ [EPISODE] Ending episode: ${req.params.id}`);

    // 1. Clean up all active calls FIRST
    console.log(`🧹 [EPISODE] Cleaning up active calls...`);
    const activeCalls = await prisma.call.findMany({
      where: {
        episodeId: req.params.id,
        endedAt: null,
        status: {
          notIn: ['completed', 'rejected', 'missed']
        }
      }
    });

    console.log(`📞 [EPISODE] Found ${activeCalls.length} active calls to end`);

    // End each active Twilio call
    for (const call of activeCalls) {
      if (call.twilioCallSid && call.twilioCallSid.startsWith('CA')) {
        try {
          const { endCall } = await import('../services/twilioService.js');
          await endCall(call.twilioCallSid);
          console.log(`📴 [EPISODE] Ended call: ${call.twilioCallSid}`);
        } catch (twilioError) {
          console.error(`⚠️ [EPISODE] Error ending call ${call.twilioCallSid}:`, twilioError);
        }
      }
    }

    // Mark all as completed
    await prisma.call.updateMany({
      where: {
        episodeId: req.params.id,
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

    console.log(`✅ [EPISODE] All active calls cleaned up`);

    // 2. End the Twilio conference if it exists
    if (episode.twilioConferenceSid && episode.twilioConferenceSid.startsWith('CF')) {
      try {
        const { endConference } = await import('../services/conferenceService.js');
        await endConference(episode.twilioConferenceSid);
        console.log(`📴 [EPISODE] Conference ended: ${episode.twilioConferenceSid}`);
      } catch (confError) {
        console.error(`⚠️ [EPISODE] Error ending conference:`, confError);
      }
    }

    // 3. Update episode status
    const duration = Math.floor((Date.now() - episode.actualStart.getTime()) / (1000 * 60));

    const updatedEpisode = await prisma.episode.update({
      where: { id: req.params.id },
      data: {
        status: 'completed',
        actualEnd: new Date(),
        duration,
        recordingUrl,
        transcriptUrl,
        conferenceActive: false,
        twilioConferenceSid: null
      }
    });

    console.log(`✅ [EPISODE] Episode ended successfully`);

    const io = req.app.get('io');
    io.to(`episode:${updatedEpisode.id}`).emit('episode:end', updatedEpisode);

    res.json(updatedEpisode);
  } catch (error) {
    console.error('Error ending episode:', error);
    res.status(500).json({ error: 'Failed to end episode' });
  }
});

export default router;

