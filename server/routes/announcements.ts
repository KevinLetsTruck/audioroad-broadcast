/**
 * Announcements API Routes
 * Generate AI-enhanced audio announcements for screeners
 */

import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { enhanceAnnouncementScript, generateAnnouncementTitle, AnnouncementCategory } from '../services/announcementService.js';
import { generateCommercialAudio } from '../services/textToSpeechService.js';
import { mixVoiceWithMusic, MusicStyle } from '../services/audioMixingService.js';
import { uploadToS3 } from '../services/audioService.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const prisma = new PrismaClient();

/**
 * POST /api/announcements/enhance - Enhance announcement text with AI
 * Body: { text: string, category: string }
 */
router.post('/enhance', async (req: Request, res: Response) => {
  try {
    const { text, category } = req.body;

    if (!text || !category) {
      return res.status(400).json({ error: 'Text and category required' });
    }

    console.log(`🎬 [ANNOUNCEMENTS] Enhancing script...`);
    console.log(`   Category: ${category}`);
    console.log(`   Original: "${text}"`);

    const enhancedScript = await enhanceAnnouncementScript({
      text,
      category: category as AnnouncementCategory
    });

    console.log(`✅ [ANNOUNCEMENTS] Script enhanced`);

    res.json({
      success: true,
      original: text,
      enhanced: enhancedScript
    });
  } catch (error) {
    console.error('❌ [ANNOUNCEMENTS] Error enhancing script:', error);
    res.status(500).json({ error: 'Failed to enhance script' });
  }
});

/**
 * POST /api/announcements/generate - Generate complete announcement with voice + music
 * Body: { text: string, category: string, voiceId: string, musicStyle: string }
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { text, category, voiceId, musicStyle } = req.body;

    if (!text || !category) {
      return res.status(400).json({ error: 'Text and category required' });
    }

    // FORCE voice-only - no music in announcements
    const finalMusicStyle = 'none';

    console.log(`\n🎬 [ANNOUNCEMENTS] Starting announcement generation...`);
    console.log(`   Category: ${category}`);
    console.log(`   Voice ID: ${voiceId || 'default'}`);
    console.log(`   Music Style: ${finalMusicStyle} (forced - announcements are voice-only)`);

    // Step 1: Enhance script with AI
    console.log('📝 Step 1: Enhancing script with AI...');
    const enhancedScript = await enhanceAnnouncementScript({
      text,
      category: category as AnnouncementCategory
    });
    console.log(`✅ Enhanced script (${enhancedScript.length} chars)`);

    // Step 2: Generate voice audio with ElevenLabs
    console.log('🎤 Step 2: Generating voice audio...');
    const title = generateAnnouncementTitle(text, category);
    const voiceFilePath = await generateCommercialAudio(
      enhancedScript,
      `announcement-${Date.now()}`,
      voiceId
    );
    console.log(`✅ Voice audio generated: ${voiceFilePath}`);

    // Step 3: Mix with music stings (if requested)
    let finalAudioPath = voiceFilePath;
    
    // FORCE voice-only - no music mixing
    if (false && finalMusicStyle && finalMusicStyle !== 'none') {
      console.log(`🎚️ Step 3: Mixing with ${finalMusicStyle} music...`);
      const mixedPath = path.join(path.dirname(voiceFilePath), `mixed-${path.basename(voiceFilePath)}`);
      
      try {
        await mixVoiceWithMusic(
          voiceFilePath,
          musicStyle as MusicStyle,
          mixedPath
        );
        finalAudioPath = mixedPath;
        console.log(`✅ Audio mixed with music`);
      } catch (mixError) {
        console.warn(`⚠️ Music mixing failed, using voice only:`, mixError);
        // Continue with voice-only version
      }
    } else {
      console.log('ℹ️ Step 3: Skipping music (voice only)');
    }

    // Step 4: Upload to S3
    console.log('☁️  Step 4: Uploading to S3...');
    const audioBuffer = await fs.readFile(finalAudioPath);
    const s3Key = `announcements/${Date.now()}-announcement.mp3`;
    const s3Url = await uploadToS3(audioBuffer, s3Key);
    console.log(`✅ Uploaded to S3: ${s3Key}`);

    // Step 5: Get audio duration (estimate from file size)
    const stats = await fs.stat(finalAudioPath);
    const estimatedDuration = Math.round(stats.size / 4000); // Rough estimate: 4KB/sec

    // Step 6: Save as AudioAsset (showId=null for global)
    console.log('💾 Step 5: Saving to database...');
    const audioAsset = await prisma.audioAsset.create({
      data: {
        showId: null, // NULL = available to all shows globally
        name: title,
        type: 'announcement',
        fileUrl: s3Url,
        duration: estimatedDuration,
        fileSize: stats.size,
        category: category,
        tags: [
          'ai-generated',
          'screener-announcement',
          category,
          'voice-only', // Always voice-only
          new Date().toISOString().split('T')[0] // Date tag for "today's announcements"
        ],
        color: '#8b5cf6', // Purple for announcements
        isActive: true
      }
    });

    // Clean up temp files
    try {
      await fs.unlink(voiceFilePath);
      if (finalAudioPath !== voiceFilePath) {
        await fs.unlink(finalAudioPath);
      }
    } catch (cleanupError) {
      console.warn('⚠️ Error cleaning up temp files:', cleanupError);
    }

    console.log(`✅ [ANNOUNCEMENTS] Generated announcement: ${audioAsset.id}`);
    console.log(`   Title: ${title}`);
    console.log(`   Duration: ~${estimatedDuration} seconds`);
    console.log(`   URL: ${s3Url}\n`);

    res.json({
      success: true,
      script: enhancedScript,
      audioUrl: s3Url,
      duration: estimatedDuration,
      audioAssetId: audioAsset.id,
      title: title
    });

  } catch (error) {
    console.error('❌ [ANNOUNCEMENTS] Error generating announcement:', error);
    res.status(500).json({ 
      error: 'Failed to generate announcement',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/announcements/today - Get announcements created today
 */
router.get('/today', async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const startOfDay = new Date(today);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    
    const announcements = await prisma.audioAsset.findMany({
      where: {
        type: 'announcement',
        isActive: true,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`📋 [ANNOUNCEMENTS] Found ${announcements.length} announcements for today`);

    res.json({
      success: true,
      count: announcements.length,
      announcements
    });
  } catch (error) {
    console.error('❌ [ANNOUNCEMENTS] Error fetching today\'s announcements:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

/**
 * GET /api/announcements - Get all active announcements
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const announcements = await prisma.audioAsset.findMany({
      where: {
        type: 'announcement',
        isActive: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`📋 [ANNOUNCEMENTS] Found ${announcements.length} total announcements`);

    res.json({
      success: true,
      count: announcements.length,
      announcements
    });
  } catch (error) {
    console.error('❌ [ANNOUNCEMENTS] Error fetching announcements:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

/**
 * DELETE /api/announcements/:id - Delete an announcement
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.audioAsset.update({
      where: { id },
      data: { isActive: false }
    });

    console.log(`🗑️ [ANNOUNCEMENTS] Deactivated announcement: ${id}`);

    res.json({ success: true });
  } catch (error) {
    console.error('❌ [ANNOUNCEMENTS] Error deleting announcement:', error);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

export default router;

