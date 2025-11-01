/**
 * HLS to MP3 Chunk Service
 * 
 * Converts HLS stream to SHORT MP3 chunks for Twilio <Play>
 * Each chunk is 10 seconds - Twilio can buffer and play it
 * Redirect loop requests next chunk continuously
 */

import { spawn } from 'child_process';
import { PassThrough } from 'stream';

export interface ChunkConfig {
  hlsUrl: string;
  durationSeconds: number;
}

/**
 * Convert HLS to a single 10-second MP3 chunk
 * Returns a readable stream of MP3 data
 */
export async function generateMp3Chunk(config: ChunkConfig): Promise<PassThrough> {
  const output = new PassThrough();

  console.log('🎵 [MP3-CHUNK] Generating 10-second MP3 chunk...');
  console.log(`   Source: ${config.hlsUrl}`);
  
  const args = [
    '-loglevel', 'error',
    
    // Input
    '-i', config.hlsUrl,
    
    // Limit to duration
    '-t', config.durationSeconds.toString(),
    
    // Reconnect flags
    '-reconnect', '1',
    '-reconnect_at_eof', '1',
    '-reconnect_streamed', '1',
    
    // MP3 output
    '-c:a', 'libmp3lame',
    '-b:a', '128k',
    '-ar', '44100',
    '-ac', '2',
    '-f', 'mp3',
    
    'pipe:1'
  ];

  const ffmpeg = spawn('ffmpeg', args);

  // Pipe FFmpeg output to PassThrough stream
  ffmpeg.stdout.pipe(output);

  // Log errors
  ffmpeg.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) {
      console.error('❌ [MP3-CHUNK FFmpeg]:', msg);
    }
  });

  ffmpeg.on('exit', (code) => {
    console.log(`✅ [MP3-CHUNK] Generated (exit code: ${code})`);
    output.end();
  });

  ffmpeg.on('error', (error) => {
    console.error('❌ [MP3-CHUNK] FFmpeg error:', error);
    output.end();
  });

  return output;
}

