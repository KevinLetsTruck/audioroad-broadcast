/**
 * Text-to-Speech Service using ElevenLabs
 * Converts AI-generated commercial scripts into audio
 */

import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import fs from 'fs/promises';
import path from 'path';

const apiKey = process.env.ELEVENLABS_API_KEY;
const client = apiKey ? new ElevenLabsClient({ apiKey }) : null;

// Popular ElevenLabs voice IDs
// You can change these to voices you prefer from ElevenLabs voice library
const VOICE_IDS = {
  professional_male: '21m00Tcm4TlvDq8ikWAM', // Rachel - clear, professional
  energetic_male: 'pNInz6obpgDQGcFmaJgB', // Adam - energetic announcer
  smooth_female: 'EXAVITQu4vr4xnSDxMaL', // Bella - smooth, friendly
  announcer: 'VR6AewLTigWG4xSOukaG' // Arnold - classic radio announcer
};

/**
 * Convert text to speech using ElevenLabs
 */
export async function generateSpeech(
  text: string,
  options: {
    voiceId?: string;
    stability?: number;
    similarity_boost?: number;
  } = {}
): Promise<Buffer> {
  if (!client) {
    throw new Error('ElevenLabs API key not configured');
  }

  const {
    voiceId = VOICE_IDS.professional_male,
    stability = 0.5,
    similarity_boost = 0.75
  } = options;

  try {
    console.log('🎤 [TTS] Generating speech...');
    console.log('   Text length:', text.length, 'characters');
    console.log('   Voice:', voiceId);

    const audio = await client.textToSpeech.convert(voiceId, {
      text,
      modelId: 'eleven_turbo_v2_5', // Latest turbo model - more natural, faster
      voiceSettings: {
        stability: stability || 0.3, // Lower = more expressive, less robotic
        similarityBoost: similarity_boost || 0.85 // Higher = more like original voice
      }
    });

    // Convert audio stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of audio) {
      chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));

    console.log(`✅ [TTS] Speech generated (${audioBuffer.length} bytes)`);
    return audioBuffer;
  } catch (error) {
    console.error('❌ [TTS] Error generating speech:', error);
    throw error;
  }
}

/**
 * Generate commercial audio from script
 * Saves to temporary file and returns path
 */
export async function generateCommercialAudio(
  script: string,
  productName: string,
  voiceId?: string
): Promise<string> {
  try {
    console.log(`🎬 [COMMERCIAL] Generating audio for: ${productName}`);

    // Generate speech
    const audioBuffer = await generateSpeech(script, {
      voiceId: voiceId || VOICE_IDS.announcer, // Use custom voice or default announcer
      stability: 0.6, // Slightly more stable for clarity
      similarity_boost: 0.8 // High quality
    });

    // Save to temporary file
    const tempDir = '/tmp/commercials';
    await fs.mkdir(tempDir, { recursive: true });

    const filename = `commercial-${productName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.mp3`;
    const filepath = path.join(tempDir, filename);

    await fs.writeFile(filepath, audioBuffer);

    console.log(`✅ [COMMERCIAL] Audio saved: ${filepath}`);
    return filepath;
  } catch (error) {
    console.error(`❌ [COMMERCIAL] Error generating audio for ${productName}:`, error);
    throw error;
  }
}

/**
 * Get available voices from ElevenLabs
 */
export async function getAvailableVoices() {
  if (!client) {
    throw new Error('ElevenLabs API key not configured');
  }

  try {
    const voices = await client.voices.getAll();
    
    // Debug: Log the first voice to see the actual structure
    if (voices.voices && voices.voices.length > 0) {
      console.log('🔍 [DEBUG] First voice structure:', JSON.stringify(voices.voices[0], null, 2));
    }
    
    return voices;
  } catch (error) {
    console.error('❌ [TTS] Error fetching voices:', error);
    throw error;
  }
}

/**
 * Generate speech for multiple commercials in batch
 */
export async function generateBatchCommercials(
  commercials: Array<{ script: string; productName: string }>
): Promise<Array<{ productName: string; filepath: string }>> {
  const results = [];

  for (const commercial of commercials) {
    try {
      const filepath = await generateCommercialAudio(
        commercial.script,
        commercial.productName
      );
      results.push({
        productName: commercial.productName,
        filepath
      });

      // Small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`❌ [COMMERCIAL] Failed to generate for ${commercial.productName}:`, error);
      // Continue with next commercial
    }
  }

  console.log(`✅ [COMMERCIAL] Generated ${results.length}/${commercials.length} commercials`);
  return results;
}

