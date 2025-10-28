/**
 * Content Creation API Routes
 * Automate social media content generation from show episodes
 */

import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { analyzeEpisodeForContent, generateSocialCaptions } from '../services/contentAnalysisService.js';
import { extractClip } from '../services/audioService.js';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * POST /api/content/analyze/:episodeId - Analyze episode for content opportunities
 */
router.post('/analyze/:episodeId', async (req: Request, res: Response) => {
  try {
    const { episodeId } = req.params;

    console.log(`🔍 [CONTENT] Starting analysis for episode: ${episodeId}`);

    const analyses = await analyzeEpisodeForContent(episodeId);

    // Get top 10 for content creation
    const topCalls = analyses.slice(0, 10);

    console.log(`✅ [CONTENT] Found ${topCalls.length} high-potential clips`);

    res.json({
      success: true,
      analyzed: analyses.length,
      recommended: topCalls.length,
      calls: topCalls.map(a => ({
        callId: a.callId,
        score: a.score,
        contentType: a.contentType,
        socialPotential: a.socialMediaPotential,
        platforms: a.suggestedPlatforms,
        topics: a.keyTopics,
        clipDuration: a.suggestedClipDuration
      }))
    });

  } catch (error) {
    console.error('❌ [CONTENT] Error analyzing episode:', error);
    res.status(500).json({ error: 'Failed to analyze episode' });
  }
});

/**
 * POST /api/content/generate/:episodeId - Generate social content for episode
 * Creates clips with AI captions for top calls
 */
router.post('/generate/:episodeId', async (req: Request, res: Response) => {
  try {
    const { episodeId } = req.params;
    const { limit = 8 } = req.body; // Generate 8 clips by default

    console.log(`🎬 [CONTENT] Generating social content for episode: ${episodeId}`);

    // Step 1: Analyze episode
    console.log('  📊 Step 1: Analyzing calls...');
    const analyses = await analyzeEpisodeForContent(episodeId);
    const topCalls = analyses.filter(a => a.socialMediaPotential !== 'low').slice(0, limit);

    if (topCalls.length === 0) {
      return res.json({
        success: true,
        message: 'No high-potential content found',
        generated: 0
      });
    }

    console.log(`  🎯 Selected ${topCalls.length} calls for content creation`);

    const generatedContent = [];

    // Step 2: Generate content for each call
    for (const analysis of topCalls) {
      try {
        const call = await prisma.call.findUnique({
          where: { id: analysis.callId },
          include: { caller: true }
        });

        if (!call) continue;

        console.log(`\n  🎬 Generating content for: ${call.topic || 'Call'}`);

        // Generate social captions
        console.log('    📝 Generating captions...');
        const captions = await generateSocialCaptions(call, {
          duration: analysis.suggestedClipDuration || 60,
          topic: call.topic || 'Trucking Discussion',
          highlights: analysis.highlights
        });

        // Create clip record in database
        const clip = await prisma.clip.create({
          data: {
            episodeId,
            callId: call.id,
            title: call.topic || 'Highlight from Show',
            description: analysis.highlights.join(' '),
            type: analysis.contentType === 'educational' ? 'health_tip' :
                  analysis.contentType === 'entertaining' ? 'highlight' :
                  analysis.contentType === 'promotional' ? 'promo' : 'highlight',
            duration: analysis.suggestedClipDuration || 60,
            // AI-generated content
            aiCaption: captions.instagram,
            aiHashtags: captions.hashtags,
            aiSuggestions: {
              instagram: captions.instagram,
              facebook: captions.facebook,
              youtube: captions.youtube,
              tiktok: captions.tiktok,
              platforms: analysis.suggestedPlatforms,
              score: analysis.score
            },
            status: 'draft', // Needs review before posting
            createdBy: 'ai-automation'
          }
        });

        console.log(`    ✅ Clip created: ${clip.id}`);

        generatedContent.push({
          clipId: clip.id,
          callId: call.id,
          topic: call.topic,
          score: analysis.score,
          captions,
          platforms: analysis.suggestedPlatforms
        });

      } catch (error) {
        console.error(`    ❌ Error generating content for call ${analysis.callId}:`, error);
        // Continue with next call
      }
    }

    console.log(`\n✅ [CONTENT] Generated ${generatedContent.length} content pieces`);

    res.json({
      success: true,
      generated: generatedContent.length,
      content: generatedContent
    });

  } catch (error) {
    console.error('❌ [CONTENT] Error generating content:', error);
    res.status(500).json({ error: 'Failed to generate content' });
  }
});

/**
 * GET /api/content/clips/:episodeId - Get all clips for an episode
 */
router.get('/clips/:episodeId', async (req: Request, res: Response) => {
  try {
    const { episodeId } = req.params;

    const clips = await prisma.clip.findMany({
      where: { episodeId },
      include: {
        episode: {
          include: { show: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      success: true,
      count: clips.length,
      clips
    });

  } catch (error) {
    console.error('Error fetching clips:', error);
    res.status(500).json({ error: 'Failed to fetch clips' });
  }
});

/**
 * PATCH /api/content/clips/:id/approve - Approve clip for posting
 */
router.patch('/clips/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { platforms } = req.body;

    const clip = await prisma.clip.update({
      where: { id },
      data: {
        status: 'approved',
        platforms: platforms || [],
        approvedBy: req.user?.id || 'admin'
      }
    });

    console.log(`✅ [CONTENT] Clip approved: ${clip.title}`);

    res.json({ success: true, clip });

  } catch (error) {
    console.error('Error approving clip:', error);
    res.status(500).json({ error: 'Failed to approve clip' });
  }
});

/**
 * GET /api/content/pending - Get all pending clips awaiting review
 */
router.get('/pending', async (req: Request, res: Response) => {
  try {
    const pendingClips = await prisma.clip.findMany({
      where: {
        status: 'draft'
      },
      include: {
        episode: {
          include: { show: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      success: true,
      count: pendingClips.length,
      clips: pendingClips
    });

  } catch (error) {
    console.error('Error fetching pending clips:', error);
    res.status(500).json({ error: 'Failed to fetch pending clips' });
  }
});

export default router;

