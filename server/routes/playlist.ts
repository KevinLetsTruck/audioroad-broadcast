/**
 * Auto DJ Playlist Routes
 * 
 * Manage playlist tracks for Auto DJ
 */

import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import { uploadToS3 } from '../services/audioService.js';

const router = express.Router();
const prisma = new PrismaClient();

// Configure multer for audio uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max
});

/**
 * GET /api/playlist - Get all playlist tracks
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const tracks = await prisma.playlistTrack.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' }
    });

    res.json(tracks);
  } catch (error) {
    console.error('Error fetching playlist:', error);
    res.status(500).json({ error: 'Failed to fetch playlist' });
  }
});

/**
 * POST /api/playlist - Add track to playlist
 */
router.post('/', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    const { title, artist, category } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Upload to S3
    const filename = `autodj/${Date.now()}-${req.file.originalname}`;
    const audioUrl = await uploadToS3(req.file.buffer, filename, req.file.mimetype);

    // Estimate duration (rough calculation)
    const estimatedDuration = Math.round(req.file.size / 4000);

    // Get current max sortOrder
    const maxOrder = await prisma.playlistTrack.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true }
    });

    // Create track
    const track = await prisma.playlistTrack.create({
      data: {
        title,
        artist: artist || null,
        audioUrl,
        duration: estimatedDuration,
        fileSize: req.file.size,
        category: category || null,
        sortOrder: (maxOrder?.sortOrder || 0) + 1
      }
    });

    console.log(`✅ [PLAYLIST] Added track: ${title}`);
    res.json(track);

  } catch (error) {
    console.error('Error adding track:', error);
    res.status(500).json({ error: 'Failed to add track' });
  }
});

/**
 * PATCH /api/playlist/:id/reorder - Update track order
 */
router.patch('/:id/reorder', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newPosition } = req.body;

    await prisma.playlistTrack.update({
      where: { id },
      data: { sortOrder: newPosition }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error reordering track:', error);
    res.status(500).json({ error: 'Failed to reorder track' });
  }
});

/**
 * DELETE /api/playlist/:id - Remove track from playlist
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.playlistTrack.update({
      where: { id },
      data: { isActive: false }
    });

    console.log(`🗑️ [PLAYLIST] Removed track: ${id}`);
    res.json({ success: true });

  } catch (error) {
    console.error('Error removing track:', error);
    res.status(500).json({ error: 'Failed to remove track' });
  }
});

export default router;

