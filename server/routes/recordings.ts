/**
 * Recordings Upload Route
 * 
 * Handles uploading show recordings to S3
 */

import express, { Request, Response } from 'express';
import multer from 'multer';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024 // 500 MB max
  }
});

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  } : undefined
});

/**
 * POST /api/recordings/upload - Upload recording to S3
 */
router.post('/upload', upload.single('recording'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { episodeId, showSlug } = req.body;

    if (!episodeId) {
      return res.status(400).json({ error: 'Episode ID required' });
    }

    const file = req.file;
    const timestamp = Date.now();
    const filename = `recordings/${showSlug || 'show'}/${timestamp}-${file.originalname}`;

    console.log(`📤 Uploading recording to S3: ${filename}`);

    // Upload to S3
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: process.env.S3_BUCKET_NAME || 'audioroad-recordings',
        Key: filename,
        Body: file.buffer,
        ContentType: file.mimetype,
        // Make files publicly accessible (or use signed URLs)
        ACL: 'public-read'
      }
    });

    const result = await upload.done();
    const s3Url = `https://${process.env.S3_BUCKET_NAME || 'audioroad-recordings'}.s3.amazonaws.com/${filename}`;

    console.log(`✅ Recording uploaded: ${s3Url}`);

    // Update episode with recording URL
    await prisma.episode.update({
      where: { id: episodeId },
      data: {
        recordingUrl: s3Url
      }
    });

    res.json({
      success: true,
      url: s3Url,
      filename,
      size: file.size
    });

  } catch (error) {
    console.error('❌ Error uploading recording:', error);
    res.status(500).json({ error: 'Failed to upload recording' });
  }
});

/**
 * GET /api/recordings - Get all recordings
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { showId } = req.query;

    const where: any = {
      recordingUrl: { not: null }
    };

    if (showId) {
      where.showId = showId as string;
    }

    const episodes = await prisma.episode.findMany({
      where,
      include: {
        show: true
      },
      orderBy: {
        date: 'desc'
      }
    });

    res.json(episodes);
  } catch (error) {
    console.error('Error fetching recordings:', error);
    res.status(500).json({ error: 'Failed to fetch recordings' });
  }
});

export default router;

