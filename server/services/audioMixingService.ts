/**
 * Audio Mixing Service
 * Mix voice announcements with intro/outro music stings using FFmpeg
 */

import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type MusicStyle = 'upbeat' | 'professional' | 'smooth' | 'none';

/**
 * Mix voice audio with intro and outro music stings
 */
export async function mixVoiceWithMusic(
  voiceFilePath: string,
  musicStyle: MusicStyle,
  outputPath: string
): Promise<void> {
  if (musicStyle === 'none') {
    // No music - just copy the voice file
    const fs = await import('fs/promises');
    await fs.copyFile(voiceFilePath, outputPath);
    console.log('✅ [MIXING] No music - voice file copied as-is');
    return;
  }

  try {
    console.log(`🎚️ [MIXING] Mixing voice with ${musicStyle} style...`);
    console.log(`   Voice file: ${voiceFilePath}`);
    console.log(`   Output: ${outputPath}`);

    // Define music sting paths based on style
    const musicPaths = {
      upbeat: {
        intro: path.join(__dirname, '../assets/music/intro-upbeat.mp3'),
        outro: path.join(__dirname, '../assets/music/outro-upbeat.mp3')
      },
      professional: {
        intro: path.join(__dirname, '../assets/music/intro-professional.mp3'),
        outro: path.join(__dirname, '../assets/music/outro-professional.mp3')
      },
      smooth: {
        intro: path.join(__dirname, '../assets/music/intro-smooth.mp3'),
        outro: path.join(__dirname, '../assets/music/outro-smooth.mp3')
      }
    };

    const stings = musicPaths[musicStyle];
    
    console.log(`   Intro sting: ${stings.intro}`);
    console.log(`   Outro sting: ${stings.outro}`);

    // Check if music files exist, if not, skip mixing
    const fs = await import('fs/promises');
    try {
      await fs.access(stings.intro);
      await fs.access(stings.outro);
    } catch (accessError) {
      console.warn(`⚠️ [MIXING] Music stings not found for ${musicStyle}, using voice only`);
      await fs.copyFile(voiceFilePath, outputPath);
      return;
    }

    // Use FFmpeg to concatenate: intro + voice + outro
    // Keep music stings at lower volume so voice is prominent
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(stings.intro)
        .input(voiceFilePath)
        .input(stings.outro)
        .complexFilter([
          // Reduce intro volume to 40% (so it's background, not overpowering)
          '[0:a]volume=0.4[intro]',
          // Keep voice at full volume
          '[1:a]volume=1.0[voice]',
          // Reduce outro volume to 40%
          '[2:a]volume=0.4[outro]',
          // Concatenate all three
          '[intro][voice][outro]concat=n=3:v=0:a=1[out]'
        ])
        .outputOptions('-map', '[out]')
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('🎬 [MIXING] FFmpeg command:', commandLine);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`⏳ [MIXING] Progress: ${Math.round(progress.percent)}%`);
          }
        })
        .on('end', () => {
          console.log('✅ [MIXING] Audio mixing complete');
          resolve();
        })
        .on('error', (err) => {
          console.error('❌ [MIXING] FFmpeg error:', err);
          reject(err);
        })
        .run();
    });

  } catch (error) {
    console.error(`❌ [MIXING] Error mixing audio:`, error);
    throw error;
  }
}

/**
 * Get available music styles with metadata
 */
export function getAvailableMusicStyles() {
  return [
    {
      id: 'upbeat',
      name: 'Upbeat',
      description: 'Energetic and exciting - perfect for sales and special offers',
      icon: '⚡'
    },
    {
      id: 'professional',
      name: 'Professional',
      description: 'Clean and corporate - ideal for general announcements',
      icon: '💼'
    },
    {
      id: 'smooth',
      name: 'Smooth',
      description: 'Warm and welcoming - great for guest introductions',
      icon: '✨'
    },
    {
      id: 'none',
      name: 'No Music',
      description: 'Voice only - no intro or outro stings',
      icon: '🎙️'
    }
  ];
}

