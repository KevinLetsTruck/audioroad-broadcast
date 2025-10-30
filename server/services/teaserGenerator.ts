/**
 * Teaser Clip Generator
 * 
 * Automatically creates 30-minute teaser clips from full episodes
 * Runs after each show ends
 */

import { spawn } from 'child_process';
import { PrismaClient } from '@prisma/client';
import path from 'path';

const prisma = new PrismaClient();

/**
 * Generate 30-minute teaser clip from full episode recording
 */
export async function generateTeaser(episodeId: string): Promise<string> {
  console.log('✂️ [TEASER] Generating 30-minute teaser for episode:', episodeId);

  try {
    const episode = await prisma.episode.findUnique({
      where: { id: episodeId },
      include: { show: true }
    });

    if (!episode || !episode.recordingUrl) {
      throw new Error('Episode or recording not found');
    }

    // Only generate if episode is longer than 30 minutes
    if (episode.duration && episode.duration <= 30) {
      console.log('ℹ️ [TEASER] Episode is already 30 min or less, skipping teaser');
      return episode.recordingUrl;
    }

    console.log('🎬 [TEASER] Extracting first 30 minutes...');

    const inputUrl = episode.recordingUrl;
    const outputFilename = `teaser-${episode.show?.slug || 'show'}-${Date.now()}.mp3`;
    const outputPath = path.join('/tmp', outputFilename);

    // Generate teaser with FFmpeg
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', inputUrl,           // Input from S3 URL
        '-ss', '0',               // Start at beginning
        '-t', '1800',             // 30 minutes (1800 seconds)
        '-c:a', 'copy',           // Copy audio codec (fast, no re-encoding)
        '-y',                     // Overwrite if exists
        outputPath
      ]);

      ffmpeg.stderr.on('data', (data) => {
        const message = data.toString();
        if (message.includes('time=')) {
          // Log progress
          process.stdout.write('.');
        }
      });

      ffmpeg.on('exit', (code) => {
        if (code === 0) {
          console.log('\n✅ [TEASER] Clip extracted');
          resolve();
        } else {
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      });

      ffmpeg.on('error', reject);
    });

    // TODO: Upload to S3
    // For now, return the temp path (in production, this would be S3 URL)
    const teaserUrl = `/tmp/${outputFilename}`;
    
    console.log('📁 [TEASER] Teaser generated:', teaserUrl);

    // Update episode with teaser URL
    await prisma.episode.update({
      where: { id: episodeId },
      data: { 
        // teaserUrl field doesn't exist yet - would need migration
        notes: episode.notes 
          ? `${episode.notes}\n\nTeaser: ${teaserUrl}`
          : `Teaser: ${teaserUrl}`
      }
    });

    console.log('✅ [TEASER] Teaser generation complete!');
    return teaserUrl;

  } catch (error) {
    console.error('❌ [TEASER] Error generating teaser:', error);
    throw error;
  }
}

/**
 * Auto-generate teaser when episode ends
 * Called from episode end handler
 */
export async function autoGenerateTeaser(episodeId: string): Promise<void> {
  try {
    // Wait a bit for recording to finish uploading
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log('🎬 [TEASER] Auto-generating teaser for episode:', episodeId);
    await generateTeaser(episodeId);
    
  } catch (error) {
    console.error('❌ [TEASER] Auto-generation failed:', error);
    // Don't throw - teaser generation shouldn't break episode ending
  }
}

