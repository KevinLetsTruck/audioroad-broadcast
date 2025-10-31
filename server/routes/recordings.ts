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

    // Check if S3 is configured (need ALL 3 variables!)
    const s3Configured = process.env.S3_BUCKET_NAME && 
                        process.env.AWS_ACCESS_KEY_ID && 
                        process.env.AWS_SECRET_ACCESS_KEY;
    
    console.log('🔍 [S3 CHECK]');
    console.log(`   S3_BUCKET_NAME: ${process.env.S3_BUCKET_NAME ? 'SET' : 'MISSING'}`);
    console.log(`   AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID ? 'SET' : 'MISSING'}`);
    console.log(`   AWS_SECRET_ACCESS_KEY: ${process.env.AWS_SECRET_ACCESS_KEY ? 'SET' : 'MISSING'}`);
    console.log(`   AWS_REGION: ${process.env.AWS_REGION || 'not set (will use us-east-1)'}`);
    console.log(`   S3 Configured: ${s3Configured ? 'YES ✓' : 'NO ✗'}`);

    if (!s3Configured) {
      console.log('⚠️ S3 not configured, skipping cloud upload (local only)');
      
      // Get episode details
      const episode = await prisma.episode.findUnique({
        where: { id: episodeId },
        include: { show: true }
      });
      
      // Update episode with a local placeholder
      await prisma.episode.update({
        where: { id: episodeId },
        data: {
          recordingUrl: `local://${filename}` // Placeholder
        }
      });

      // Note: Can't add local files to Auto DJ (need accessible URL)
      // User can manually upload to S3/CDN later if desired
      console.log('ℹ️ [AUTO DJ] Local recording not added to playlist (needs S3 URL)');

      return res.json({
        success: true,
        url: null,
        message: 'S3 not configured, recording saved locally only',
        filename,
        size: file.size,
        addedToPlaylist: false
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

      // Get episode details for playlist entry
      const episode = await prisma.episode.findUnique({
        where: { id: episodeId },
        include: { show: true }
      });

      // Update episode with recording URL
      await prisma.episode.update({
        where: { id: episodeId },
        data: {
          recordingUrl: s3Url
        }
      });

      // AUTOMATICALLY add to Auto DJ playlist for 24/7 rebroadcast!
      if (episode) {
        const trackTitle = episode.show?.name 
          ? `${episode.show.name} - ${new Date(episode.date).toLocaleDateString()}`
          : `Show Recording - ${new Date(episode.date).toLocaleDateString()}`;
        
        // Calculate duration (approximate from episode times)
        const duration = episode.actualEnd && episode.actualStart
          ? Math.floor((new Date(episode.actualEnd).getTime() - new Date(episode.actualStart).getTime()) / 1000)
          : 3600; // Default 1 hour if not available

        const playlistTrack = await prisma.playlistTrack.create({
          data: {
            title: trackTitle,
            artist: 'AudioRoad Network',
            audioUrl: s3Url,
            duration: duration,
            fileSize: file.size,
            category: 'recorded-show',
            tags: [episode.show?.slug || 'show', episode.show?.name || 'unknown'],
            sortOrder: Math.floor(Date.now() / 1000), // Use timestamp for chronological order
            isActive: true
          }
        });

        console.log(`🎵 [AUTO DJ] Added recording to playlist: ${playlistTrack.title}`);
      }

      res.json({
        success: true,
        url: s3Url,
        filename,
        size: file.size,
        addedToPlaylist: !!episode
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

    // First, check total episodes
    const totalEpisodes = await prisma.episode.count();
    const episodesWithRecordings = await prisma.episode.count({
      where: { recordingUrl: { not: null } }
    });
    
    console.log(`📁 [RECORDINGS] Total episodes: ${totalEpisodes}`);
    console.log(`📁 [RECORDINGS] Episodes with recordings: ${episodesWithRecordings}`);

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
    
    // Log sample of what we found
    if (episodes.length > 0) {
      console.log(`   Sample: ${episodes[0].title}, URL: ${episodes[0].recordingUrl?.substring(0, 50)}...`);
    } else {
      console.log(`   No recordings found. Have you ended any shows yet?`);
    }
    
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

