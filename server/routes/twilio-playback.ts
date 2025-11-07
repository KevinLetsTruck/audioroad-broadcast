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

    if (!episode || !episode.twilioConferenceSid) {
      return res.status(404).json({ error: 'Episode or conference not found' });
    }

    const conferenceSid = episode.twilioConferenceSid;
    console.log(`   Conference SID: ${conferenceSid}`);

    // Use Twilio's conference update with play parameter
    // This plays audio to ALL participants in the conference
    try {
      await twilioClient
        .conferences(conferenceSid)
        .update({
          announceUrl: audioUrl,
          announceMethod: 'GET'
        } as any); // 'as any' because announceUrl not in TypeScript types

      console.log(`✅ [TWILIO-PLAY] Audio playing in conference`);
      res.json({ success: true, message: 'Audio playing in conference' });
    } catch (twilioError: any) {
      console.error(`❌ [TWILIO-PLAY] Twilio error:`, twilioError.message);
      res.status(500).json({ error: 'Failed to play audio in conference', details: twilioError.message });
    }

  } catch (error) {
    console.error('❌ [TWILIO-PLAY] Error:', error);
    res.status(500).json({ error: 'Failed to play audio' });
  }
});

export default router;

