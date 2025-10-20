import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import { uploadToS3 } from '../services/audioService';

const router = express.Router();
const prisma = new PrismaClient();

// Configure multer for file uploads (memory storage)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const shows = await prisma.show.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { episodes: true } }
      }
    });
    res.json(shows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch shows' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const show = await prisma.show.findUnique({
      where: { id: req.params.id },
      include: {
        episodes: {
          orderBy: { date: 'desc' },
          take: 20
        }
      }
    });
    res.json(show);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch show' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, slug, hostId, hostName, description, schedule, logoUrl, color } = req.body;
    const show = await prisma.show.create({
      data: { name, slug, hostId, hostName, description, schedule, logoUrl, color }
    });
    res.status(201).json(show);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create show' });
  }
});

// Delete a show
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.show.delete({
      where: { id: req.params.id }
    });
    res.json({ message: 'Show deleted' });
  } catch (error) {
    console.error('Error deleting show:', error);
    res.status(500).json({ error: 'Failed to delete show' });
  }
});

// Seed default shows endpoint
router.post('/seed', async (req: Request, res: Response) => {
  try {
    const defaultShows = [
  {
    name: 'Industry Insights',
    slug: 'industry-insights',
    hostId: 'default-host',
    hostName: 'AudioRoad Host',
    description: 'Deep dive into trucking industry trends, regulations, and business insights',
    schedule: { days: ['monday'], time: '08:00', duration: 180, timezone: 'America/Los_Angeles' },
    color: '#3b82f6'
  },
  {
    name: 'The PowerHour',
    slug: 'the-powerhour',
    hostId: 'default-host',
    hostName: 'AudioRoad Host',
    description: 'High-energy discussion on trucking business and success strategies',
    schedule: { days: ['tuesday'], time: '08:00', duration: 180, timezone: 'America/Los_Angeles' },
    color: '#f59e0b'
  },
  {
    name: 'DestinationHealth',
    slug: 'destinationhealth',
    hostId: 'default-host',
    hostName: 'AudioRoad Host',
    description: 'Health, wellness, and medical topics for professional drivers',
    schedule: { days: ['wednesday'], time: '08:00', duration: 180, timezone: 'America/Los_Angeles' },
    color: '#10b981'
  },
  {
    name: 'Trucking Technology and Efficiency',
    slug: 'trucking-tech',
    hostId: 'default-host',
    hostName: 'AudioRoad Host',
    description: 'Latest technology, tools, and efficiency tips for modern trucking',
    schedule: { days: ['thursday'], time: '08:00', duration: 180, timezone: 'America/Los_Angeles' },
    color: '#8b5cf6'
  },
  {
    name: 'Rolling Toe',
    slug: 'rolling-toe',
    hostId: 'rolling-toe-host',
    hostName: 'Rolling Toe',
    description: 'Evening conversations with Rolling Toe',
    schedule: { days: ['thursday'], time: '10:00', duration: 180, timezone: 'America/Los_Angeles' },
    color: '#ef4444'
  }
    ];

    const created = [];
    for (const showData of defaultShows) {
      const show = await prisma.show.upsert({
        where: { slug: showData.slug },
        update: showData,
        create: showData
      });
      created.push(show);
    }

    res.json({ message: 'Shows seeded successfully', shows: created });
  } catch (error) {
    console.error('Error seeding shows:', error);
    res.status(500).json({ error: 'Failed to seed shows' });
  }
});

/**
 * PATCH /api/shows/:id/opener - Upload show opener audio
 */
router.patch('/:id/opener', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Get show to use slug in filename
    const show = await prisma.show.findUnique({ where: { id } });
    if (!show) {
      return res.status(404).json({ error: 'Show not found' });
    }

    // Upload to S3
    const filename = `show-assets/${show.slug}-opener-${Date.now()}.mp3`;
    const audioUrl = await uploadToS3(req.file.buffer, filename, req.file.mimetype);

    // Update show
    const updatedShow = await prisma.show.update({
      where: { id },
      data: { openerAudioUrl: audioUrl }
    });

    res.json({ success: true, show: updatedShow, audioUrl });
  } catch (error) {
    console.error('Error uploading opener:', error);
    res.status(500).json({ error: 'Failed to upload opener audio' });
  }
});

/**
 * PATCH /api/shows/:id/ad - Upload show ad audio
 */
router.patch('/:id/ad', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Get show to use slug in filename
    const show = await prisma.show.findUnique({ where: { id } });
    if (!show) {
      return res.status(404).json({ error: 'Show not found' });
    }

    // Upload to S3
    const filename = `show-assets/${show.slug}-ad-${Date.now()}.mp3`;
    const audioUrl = await uploadToS3(req.file.buffer, filename, req.file.mimetype);

    // Update show
    const updatedShow = await prisma.show.update({
      where: { id },
      data: { adAudioUrl: audioUrl }
    });

    res.json({ success: true, show: updatedShow, audioUrl });
  } catch (error) {
    console.error('Error uploading ad:', error);
    res.status(500).json({ error: 'Failed to upload ad audio' });
  }
});

/**
 * DELETE /api/shows/:id/opener - Remove opener audio
 */
router.delete('/:id/opener', async (req: Request, res: Response) => {
  try {
    const updatedShow = await prisma.show.update({
      where: { id: req.params.id },
      data: { openerAudioUrl: null }
    });
    res.json({ success: true, show: updatedShow });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove opener' });
  }
});

/**
 * DELETE /api/shows/:id/ad - Remove ad audio
 */
router.delete('/:id/ad', async (req: Request, res: Response) => {
  try {
    const updatedShow = await prisma.show.update({
      where: { id: req.params.id },
      data: { adAudioUrl: null }
    });
    res.json({ success: true, show: updatedShow });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove ad' });
  }
});

export default router;

