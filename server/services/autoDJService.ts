/**
 * Auto DJ Service
 * 
 * Plays music/content automatically when no live broadcast is active
 * Integrates with HLS streaming server
 */

import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import axios from 'axios';

const prisma = new PrismaClient();

export class AutoDJService extends EventEmitter {
  private isPlaying = false;
  private currentTrack: any = null;
  private ffmpeg: ChildProcess | null = null;
  private playlistPosition = 0;

  /**
   * Start Auto DJ
   */
  async start(): Promise<void> {
    if (this.isPlaying) {
      console.log('⚠️ [AUTO DJ] Already playing');
      return;
    }

    console.log('🎵 [AUTO DJ] Starting Auto DJ...');
    
    this.isPlaying = true;
    this.playNextTrack();
  }

  /**
   * Stop Auto DJ
   */
  async stop(): Promise<void> {
    console.log('📴 [AUTO DJ] Stopping Auto DJ...');
    
    this.isPlaying = false;
    this.currentTrack = null;

    if (this.ffmpeg) {
      this.ffmpeg.kill('SIGTERM');
      this.ffmpeg = null;
    }

    console.log('✅ [AUTO DJ] Auto DJ stopped');
  }

  /**
   * Play next track in playlist
   */
  private async playNextTrack(): Promise<void> {
    if (!this.isPlaying) return;

    try {
      // Get active tracks ordered by sortOrder
      const tracks = await prisma.playlistTrack.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' }
      });

      if (tracks.length === 0) {
        console.log('⚠️ [AUTO DJ] No tracks in playlist, pausing...');
        this.isPlaying = false;
        return;
      }

      // Get next track (loop playlist)
      this.playlistPosition = this.playlistPosition % tracks.length;
      const track = tracks[this.playlistPosition];
      this.currentTrack = track;
      
      console.log(`🎵 [AUTO DJ] Now playing: ${track.title} ${track.artist ? `by ${track.artist}` : ''}`);
      
      // Play track
      await this.playTrack(track);
      
      // Update stats
      await prisma.playlistTrack.update({
        where: { id: track.id },
        data: {
          playCount: { increment: 1 },
          lastPlayed: new Date()
        }
      });

      // Move to next track
      this.playlistPosition++;
      
      // Play next track when current finishes
      if (this.isPlaying) {
        this.playNextTrack();
      }

    } catch (error) {
      console.error('❌ [AUTO DJ] Error playing track:', error);
      
      // Try next track after a delay
      setTimeout(() => {
        if (this.isPlaying) {
          this.playlistPosition++;
          this.playNextTrack();
        }
      }, 5000);
    }
  }

  /**
   * Play a single track
   */
  private async playTrack(track: any): Promise<void> {
    try {
      console.log(`📥 [AUTO DJ] Downloading: ${track.title}`);
      console.log(`   URL: ${track.audioUrl}`);
      console.log(`   Expected duration: ${track.duration} seconds`);
      
      // Download audio file
      const response = await axios.get(track.audioUrl, {
        responseType: 'stream',
        timeout: 30000 // 30 second timeout
      });
      
      return new Promise((resolve, reject) => {
        try {
          console.log(`🎬 [AUTO DJ] Starting FFmpeg for track playback...`);
          let chunkCount = 0;
          let errorOutput = '';

          // FFmpeg to decode and output PCM
          const ffmpeg = spawn('ffmpeg', [
            '-i', 'pipe:0',           // Input from stream
            '-f', 'f32le',            // Output as Float32 PCM
            '-ar', '48000',           // Sample rate to match HLS server
            '-ac', '2',               // Stereo
            '-loglevel', 'warning',   // Show warnings/errors
            'pipe:1'                  // Output to stdout
          ]);

          // Pipe download to FFmpeg
          response.data.pipe(ffmpeg.stdin);

          // Read FFmpeg output and emit as Float32Array chunks for HLS server
          ffmpeg.stdout.on('data', (chunk: Buffer) => {
            chunkCount++;
            
            // Convert Buffer to Float32Array
            const float32Data = new Float32Array(
              chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength)
            );
            
            // Emit for HLS server to consume
            this.emit('audio-chunk', float32Data);
            
            // Log progress every 100 chunks (~2 seconds)
            if (chunkCount % 100 === 0) {
              console.log(`  🎵 [AUTO DJ] Playing... (${chunkCount} chunks processed)`);
            }
          });

          // Capture FFmpeg errors
          ffmpeg.stderr.on('data', (data: Buffer) => {
            errorOutput += data.toString();
          });

          ffmpeg.on('exit', (code) => {
            if (code !== 0) {
              console.error(`❌ [AUTO DJ] FFmpeg exited with code ${code}`);
              console.error(`   Error output: ${errorOutput}`);
              console.error(`   Chunks processed: ${chunkCount}`);
              reject(new Error(`FFmpeg exit code ${code}`));
            } else {
              console.log(`✅ [AUTO DJ] Track finished (${track.title})`);
              console.log(`   Total chunks: ${chunkCount}, Exit code: ${code}`);
              resolve();
            }
          });

          ffmpeg.on('error', (error) => {
            console.error('❌ [AUTO DJ] FFmpeg spawn error:', error);
            reject(error);
          });

          this.ffmpeg = ffmpeg;
        } catch (error) {
          console.error('❌ [AUTO DJ] Error setting up playback:', error);
          reject(error);
        }
      });
    } catch (error: any) {
      console.error('❌ [AUTO DJ] Error downloading track:', error.message);
      console.error('   URL:', track.audioUrl);
      throw error;
    }
  }

  /**
   * Get current track info
   */
  getCurrentTrack() {
    return this.currentTrack;
  }

  /**
   * Get Auto DJ status
   */
  getStatus() {
    return {
      playing: this.isPlaying,
      currentTrack: this.currentTrack,
      position: this.playlistPosition
    };
  }
}

