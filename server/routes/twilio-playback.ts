/**
 * Twilio Conference Playback
 * Play audio files directly in Twilio conference so callers hear them
 */

import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import twilio from 'twilio';

const router = express.Router();
const prisma = new PrismaClient();
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * POST /api/twilio/play-in-conference - Play audio file in Twilio conference
 * Body: { episodeId: string, audioUrl: string }
 */
router.post('/play-in-conference', async (req: Request, res: Response) => {
  try {
    const { episodeId, audioUrl } = req.body;

    if (!episodeId || !audioUrl) {
      return res.status(400).json({ error: 'episodeId and audioUrl required' });
    }

    console.log(`🎵 [TWILIO-PLAY] Playing audio in conference for episode: ${episodeId}`);
    console.log(`   Audio URL: ${audioUrl}`);

    // Get episode to find conference SID
    const episode = await prisma.episode.findUnique({
      where: { id: episodeId }
    });

    if (!episode) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    // CRITICAL: Wait for conference SID if not yet available
    if (!episode.twilioConferenceSid) {
      console.warn(`⚠️ [TWILIO-PLAY] Episode ${episodeId} has no conference SID yet`);
      console.warn('   Waiting for conference to start...');
      
      // Wait and retry (conference starts when host joins)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const updatedEpisode = await prisma.episode.findUnique({
        where: { id: episodeId }
      });
      
      if (!updatedEpisode?.twilioConferenceSid) {
        console.error(`❌ [TWILIO-PLAY] Conference SID still not found after wait`);
        return res.status(404).json({ 
          error: 'Conference not yet started',
          message: 'Conference SID not available. Host may not have joined yet.'
        });
      }
      
      console.log(`✅ [TWILIO-PLAY] Conference SID found: ${updatedEpisode.twilioConferenceSid}`);
      
      const conferenceSid = updatedEpisode.twilioConferenceSid;

      // CRITICAL: Play audio to ALL participants using announceUrl
      // This works even if participants are on hold!
      await twilioClient
        .conferences(conferenceSid)
        .update({
          announceUrl: audioUrl,
          announceMethod: 'GET'
        } as any);

      console.log(`✅ [TWILIO-PLAY] Audio playing in conference`);
      return res.json({ success: true });
    }

    const conferenceSid = episode.twilioConferenceSid;
    console.log(`   Conference SID: ${conferenceSid}`);

    // Play audio to ALL participants
    await twilioClient
      .conferences(conferenceSid)
      .update({
        announceUrl: audioUrl,
        announceMethod: 'GET'
      } as any);

    console.log(`✅ [TWILIO-PLAY] Audio playing in conference`);
    res.json({ success: true });

  } catch (error: any) {
    console.error('❌ [TWILIO-PLAY] Error:', error);
    console.error('   Details:', error.message);
    if (error.code) {
      console.error('   Twilio error code:', error.code);
    }
    res.status(500).json({ 
      error: 'Failed to play audio',
      details: error.message 
    });
  }
});

export default router;

