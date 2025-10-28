import express, { Request, Response } from 'express';
import { getAvailableVoices } from '../services/textToSpeechService.js';

const router = express.Router();

/**
 * GET /api/voices - Get all available ElevenLabs voices
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    console.log('🎙️ [VOICES] Fetching available voices...');
    const voices = await getAvailableVoices();
    
    // Transform the response to include only necessary info
    const formattedVoices = voices.voices.map((voice: any, index: number) => {
      const voiceData = {
        voiceId: voice.voice_id,
        name: voice.name,
        category: voice.category,
        description: voice.description || '',
        previewUrl: voice.preview_url || null,
        labels: voice.labels || {}
      };
      
      // Log first few voices for debugging
      if (index < 3) {
        console.log(`  Voice "${voiceData.name}" → ID: ${voiceData.voiceId}`);
      }
      
      return voiceData;
    });
    
    console.log(`✅ [VOICES] Found ${formattedVoices.length} voices`);
    res.json({ voices: formattedVoices });
  } catch (error) {
    console.error('❌ [VOICES] Error fetching voices:', error);
    res.status(500).json({ error: 'Failed to fetch voices' });
  }
});

export default router;

