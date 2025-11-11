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
    
    // NOTE: The opener file is currently M4A format (audio/x-m4a)
    // Twilio announceUrl requires MP3 format (audio/mpeg)
    // This is why callers don't hear the opener - Twilio silently rejects M4A
    // ACTION: Convert opener file from M4A to MP3 and re-upload

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

    // CRITICAL: Play to LIVE conference (where host and on-air callers are)
    // NOT screening conference (that's private)
    const { getLiveConferenceName } = await import('../utils/conferenceNames.js');
    const liveConference = getLiveConferenceName(episodeId);
    
    console.log(`   Target conference: ${liveConference} (LIVE show)`);

    // CRITICAL: To play audio to ALL participants, we need to:
    // 1. Get all participants in the LIVE conference
    // 2. Play audio to each participant individually using announceUrl
    
    try {
      // List all participants in LIVE conference
      const participants = await twilioClient
        .conferences(liveConference)
        .participants
        .list();
      
      console.log(`   Found ${participants.length} participants in conference`);
      
      if (participants.length === 0) {
        console.warn(`⚠️ [TWILIO-PLAY] No participants in conference - audio won't play`);
        return res.json({ success: false, message: 'No participants in conference' });
      }
      
      // Play audio to EACH participant individually
      // This is how you play audio to everyone in a Twilio conference
      const playPromises = participants.map(async (participant) => {
        try {
          console.log(`   📢 Playing to participant: ${participant.callSid}`);
          await twilioClient
            .conferences(liveConference)
            .participants(participant.callSid)
            .update({
              announceUrl: audioUrl,
              announceMethod: 'GET'
            } as any);
          console.log(`   ✅ Audio playing to ${participant.callSid}`);
        } catch (err: any) {
          console.error(`   ❌ Failed to play to ${participant.callSid}:`, err.message);
        }
      });
      
      await Promise.all(playPromises);
      
      console.log(`✅ [TWILIO-PLAY] Audio playing to ${participants.length} participant(s)`);
      res.json({ success: true, participantCount: participants.length });
    } catch (listError: any) {
      console.error(`❌ [TWILIO-PLAY] Failed to list participants:`, listError.message);
      return res.status(500).json({ 
        error: 'Failed to list conference participants',
        details: listError.message 
      });
    }

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

