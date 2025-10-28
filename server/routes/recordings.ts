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
 * POST /api/recordings/upload - Upload recording to S3 (optional)
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

    // Check if S3 is configured
    const s3Configured = process.env.S3_BUCKET_NAME && 
                        (process.env.AWS_ACCESS_KEY_ID || process.env.AWS_REGION);

    if (!s3Configured) {
      console.log('⚠️ S3 not configured, skipping upload');
      // Still update episode with a placeholder
      await prisma.episode.update({
        where: { id: episodeId },
        data: {
          recordingUrl: `local://${filename}` // Placeholder
        }
      });

      return res.json({
        success: true,
        url: null,
        message: 'S3 not configured, recording not uploaded',
        filename,
        size: file.size
      });
    }

    console.log(`📤 Uploading recording to S3: ${filename}`);

    try {
      // Upload to S3
      const uploadTask = new Upload({
        client: s3Client,
        params: {
          Bucket: process.env.S3_BUCKET_NAME,
          Key: filename,
          Body: file.buffer,
          ContentType: file.mimetype,
          ACL: 'public-read'
        }
      });

      await uploadTask.done();
      const s3Url = `https://${process.env.S3_BUCKET_NAME}.s3.amazonaws.com/${filename}`;

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
    } catch (s3Error) {
      console.error('❌ S3 upload failed:', s3Error);
      // Still save a placeholder
      await prisma.episode.update({
        where: { id: episodeId },
        data: {
          recordingUrl: `error://${filename}`
        }
      });
      
      res.json({
        success: false,
        error: 'S3 upload failed',
        filename,
        size: file.size
      });
    }

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
        show: true,
        _count: {
          select: { calls: true }
        }
      },
      orderBy: {
        date: 'desc'
      }
    });

    console.log(`📁 [RECORDINGS] Fetched ${episodes.length} recordings`);
    res.json(episodes);
  } catch (error) {
    console.error('Error fetching recordings:', error);
    res.status(500).json({ error: 'Failed to fetch recordings' });
  }
});

/**
 * DELETE /api/recordings/:episodeId - Delete recording reference
 */
router.delete('/:episodeId', async (req: Request, res: Response) => {
  try {
    const { episodeId } = req.params;

    console.log(`🗑️ [RECORDINGS] Removing recording from episode: ${episodeId}`);

    // Just remove the recording URL, don't delete the episode
    await prisma.episode.update({
      where: { id: episodeId },
      data: {
        recordingUrl: null
      }
    });

    console.log(`✅ [RECORDINGS] Recording reference removed`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting recording:', error);
    res.status(500).json({ error: 'Failed to delete recording' });
  }
});

/**
 * PATCH /api/recordings/:episodeId/notes - Update episode notes
 */
router.patch('/:episodeId/notes', async (req: Request, res: Response) => {
  try {
    const { episodeId } = req.params;
    const { notes } = req.body;

    await prisma.episode.update({
      where: { id: episodeId },
      data: { notes }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating notes:', error);
    res.status(500).json({ error: 'Failed to update notes' });
  }
});

export default router;

