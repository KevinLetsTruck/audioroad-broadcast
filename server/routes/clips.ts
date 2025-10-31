import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { episodeId, status, type } = req.query;
    const where: any = {};
    if (episodeId) where.episodeId = episodeId as string;
    if (status) where.status = status as string;
    if (type) where.type = type as string;

    const clips = await prisma.clip.findMany({
      where,
      include: { episode: { include: { show: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(clips);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch clips' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { episodeId, callId, title, description, type, startTime, endTime } = req.body;
    
    const episode = await prisma.episode.findUnique({ where: { id: episodeId } });
    if (!episode || !episode.recordingUrl) {
      return res.status(400).json({ error: 'Episode recording not available' });
    }

    const duration = endTime - startTime;
    const clipFilename = `${episode.id}-${Date.now()}.mp3`;
    const audioUrl = await extractClip(episode.recordingUrl, startTime, duration, clipFilename);

    const clip = await prisma.clip.create({
      data: {
        episodeId,
        callId: callId || null,
        title,
        description,
        type,
        startTime,
        endTime,
        duration,
        audioUrl,
        status: 'draft'
      }
    });

    res.status(201).json(clip);
  } catch (error) {
    console.error('Error creating clip:', error);
    res.status(500).json({ error: 'Failed to create clip' });
  }
});

export default router;

