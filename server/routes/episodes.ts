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
 * PATCH /api/episodes/:id/open-lines - Open phone lines (Phase 1: Pre-show)
 */
router.patch('/:id/open-lines', async (req: Request, res: Response) => {
  try {
    const episode = await prisma.episode.findUnique({
      where: { id: req.params.id },
      include: { show: true }
    });

    if (!episode) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    console.log(`📞 [OPEN-LINES] Opening phone lines for episode: ${episode.id}`);
    
    // Close lines on all other episodes
    await prisma.episode.updateMany({
      where: {
        id: { not: req.params.id },
        linesOpen: true
      },
      data: { linesOpen: false }
    });

    // Create Twilio conference if needed
    let conferenceSid = episode.twilioConferenceSid;
    if (!conferenceSid) {
      try {
        const conference = await createEpisodeConference(episode.id);
        conferenceSid = conference.sid || `episode-${episode.id}`;
        console.log(`📞 [CONFERENCE] Created conference: ${conference.friendlyName || conference.sid}`);
      } catch (confError) {
        console.error('⚠️ [CONFERENCE] Failed to create conference:', confError);
      }
    }

    // Open lines - episode stays 'scheduled', not 'live' yet
    const updatedEpisode = await prisma.episode.update({
      where: { id: req.params.id },
      data: {
        linesOpen: true,
        linesOpenedAt: new Date(),
        twilioConferenceSid: conferenceSid,
        conferenceActive: conferenceSid ? true : false
      },
      include: { show: true }
    });

    console.log(`✅ [OPEN-LINES] Phone lines opened - screener can take calls`);

    const io = req.app.get('io');
    io.emit('episode:lines-opened', updatedEpisode);

    res.json(updatedEpisode);
  } catch (error) {
    console.error('Error opening phone lines:', error);
    res.status(500).json({ error: 'Failed to open phone lines' });
  }
});

/**
 * PATCH /api/episodes/:id/start - Start episode (Phase 2: Go live)
 */
router.patch('/:id/start', async (req: Request, res: Response) => {
  try {
    const episode = await prisma.episode.findUnique({
      where: { id: req.params.id },
      include: { show: true }
    });

    if (!episode) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    console.log(`🎙️ [START] Starting episode: ${episode.id}`);

    // Ensure conference exists (may have been created when lines opened)
    let conferenceSid = episode.twilioConferenceSid;
    if (!conferenceSid) {
      try {
        const conference = await createEpisodeConference(episode.id);
        conferenceSid = conference.sid || `episode-${episode.id}`;
        console.log(`📞 [CONFERENCE] Created conference: ${conference.friendlyName || conference.sid}`);
      } catch (confError) {
        console.error('⚠️ [CONFERENCE] Failed to create conference:', confError);
      }
    }

    // Mark as live
    const updatedEpisode = await prisma.episode.update({
      where: { id: req.params.id },
      data: {
        status: 'live',
        actualStart: new Date(),
        conferenceActive: true,
        twilioConferenceSid: conferenceSid
      },
      include: { show: true }
    });

    const io = req.app.get('io');
    io.emit('episode:start', updatedEpisode);

    res.json(updatedEpisode);
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

