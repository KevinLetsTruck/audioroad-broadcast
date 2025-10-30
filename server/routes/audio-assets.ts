import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import { uploadToS3, getAudioMetadata } from '../services/audioService.js';

const router = express.Router();
const prisma = new PrismaClient();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 * 1024 } // 1GB
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { showId, type } = req.query;
    const where: any = { isActive: true };
    if (showId) where.showId = showId as string;
    if (type) where.type = type as string;

    const assets = await prisma.audioAsset.findMany({
      where,
      orderBy: { sortOrder: 'asc' }
    });
    res.json(assets);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch audio assets' });
  }
});

router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { showId, name, type, category, tags, color, hotkey } = req.body;

    const s3Key = `audio-assets/${showId || 'global'}/${Date.now()}-${req.file.originalname}`;
    const fileUrl = await uploadToS3(req.file.buffer, s3Key, req.file.mimetype);

    // Get audio metadata for duration
    const metadata = await getAudioMetadata(fileUrl);
    const duration = Math.floor(metadata.format.duration || 0);

    const asset = await prisma.audioAsset.create({
      data: {
        showId: showId || null,
        name,
        type,
        category,
        tags: tags ? JSON.parse(tags) : null,
        color,
        hotkey,
        fileUrl,
        duration,
        fileSize: req.file.size
      }
    });

    res.status(201).json(asset);
  } catch (error) {
    console.error('Error creating audio asset:', error);
    res.status(500).json({ error: 'Failed to create audio asset' });
  }
});

export default router;

