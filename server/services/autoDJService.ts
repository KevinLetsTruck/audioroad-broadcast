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
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

const prisma = new PrismaClient();

export class AutoDJService extends EventEmitter {
  private isPlaying = false;
  private currentTrack: any = null;
  private ffmpeg: ChildProcess | null = null;
  private playlistPosition = 0;
  private instanceId: string;
  
  // Pause/Resume support
  private pausedAt: number = 0; // Seconds into track when paused
  private startTime: number = 0; // When current track started playing
  private tempFilePath: string | null = null; // Current temp file
  
  // Static counter to detect multiple instances
  private static instanceCounter = 0;
  
  constructor() {
    super();
    AutoDJService.instanceCounter++;
    this.instanceId = `AutoDJ-${AutoDJService.instanceCounter}`;
    console.log(`🆕 [AUTO DJ] Creating instance #${AutoDJService.instanceCounter} (ID: ${this.instanceId})`);
    
    if (AutoDJService.instanceCounter > 1) {
      console.warn(`⚠️ [AUTO DJ] WARNING: Multiple Auto DJ instances! This causes audio overlap/distortion!`);
      console.warn(`   Instance count: ${AutoDJService.instanceCounter}`);
    }
  }

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
  /**
   * Pause Auto DJ (saves position for resume)
   */
  async pause(): Promise<void> {
    console.log(`⏸️ [AUTO DJ ${this.instanceId}] Pausing Auto DJ...`);
    
    this.isPlaying = false;

    // Calculate how far into the track we are
    if (this.startTime > 0) {
      const elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
      this.pausedAt += elapsedSeconds;
      console.log(`   Paused at: ${Math.floor(this.pausedAt / 60)}:${String(Math.floor(this.pausedAt % 60)).padStart(2, '0')}`);
    }

    // Kill FFmpeg but keep track and temp file
    if (this.ffmpeg) {
      console.log(`   Killing FFmpeg process...`);
      this.ffmpeg.kill('SIGKILL');
      this.ffmpeg = null;
      console.log('   ✓ FFmpeg killed');
    }

    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log(`✅ [AUTO DJ ${this.instanceId}] Paused - will resume from ${Math.floor(this.pausedAt / 60)}m ${Math.floor(this.pausedAt % 60)}s`);
  }
  
  /**
   * Stop Auto DJ completely (clears position and temp file)
   */
  async stop(): Promise<void> {
    console.log(`📴 [AUTO DJ ${this.instanceId}] Stopping Auto DJ...`);
    
    this.isPlaying = false;
    this.currentTrack = null;
    this.pausedAt = 0; // Reset position
    this.startTime = 0;

    // Kill FFmpeg
    if (this.ffmpeg) {
      console.log(`   Killing FFmpeg process (PID: ${this.ffmpeg.pid})...`);
      this.ffmpeg.kill('SIGKILL');
      this.ffmpeg = null;
      console.log('   ✓ FFmpeg killed');
    }
    
    // Clean up temp file
    if (this.tempFilePath) {
      try {
        await unlink(this.tempFilePath);
        console.log(`   ✓ Temp file deleted`);
      } catch (e) {
        // File might already be deleted
      }
      this.tempFilePath = null;
    }

    await new Promise(resolve => setTimeout(resolve, 500));
    
    AutoDJService.instanceCounter--;
    console.log(`✅ [AUTO DJ ${this.instanceId}] Stopped - Instance count: ${AutoDJService.instanceCounter}`);
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
      
      // Play next track when current finishes (ONLY if still supposed to be playing)
      // Don't auto-restart if we were paused!
      if (this.isPlaying && !this.pausedAt) {
        this.playNextTrack();
      } else if (this.pausedAt > 0) {
        console.log(`⏸️ [AUTO DJ] Track interrupted (paused at ${this.pausedAt}s) - not auto-restarting`);
      }

    } catch (error) {
      console.error('❌ [AUTO DJ] Error playing track:', error);
      
      // Only retry if we're actually supposed to be playing (not paused!)
      if (this.isPlaying && !this.pausedAt) {
        console.log('   Retrying next track in 5 seconds...');
        setTimeout(() => {
          if (this.isPlaying && !this.pausedAt) {
            this.playlistPosition++;
            this.playNextTrack();
          }
        }, 5000);
      } else {
        console.log('   ⏸️ Not retrying - Auto DJ is paused');
      }
    }
  }

  /**
   * Play a single track
   */
  private async playTrack(track: any): Promise<void> {
    try {
      console.log(`📥 [AUTO DJ] Downloading: ${track.title}`);
      console.log(`   URL: ${track.audioUrl}`);
      console.log(`   Expected duration: ${track.duration} seconds (${Math.floor(track.duration / 60)} minutes)`);
      
      // Check if we're resuming this track (already downloaded)
      const isResuming = this.tempFilePath && this.pausedAt > 0;
      
      if (isResuming) {
        console.log(`   ⏩ Resuming from ${Math.floor(this.pausedAt / 60)}:${String(Math.floor(this.pausedAt % 60)).padStart(2, '0')} (temp file exists)`);
      } else {
        // Download to TEMP FILE (much more reliable than memory buffer!)
        this.tempFilePath = path.join('/tmp', `autodj-${Date.now()}.m4a`);
        console.log(`   Downloading to temp file: ${this.tempFilePath}`);
      
        const response = await axios.get(track.audioUrl, {
          responseType: 'arraybuffer',
          timeout: 120000, // 2 minute timeout
          maxContentLength: 500 * 1024 * 1024,
          maxBodyLength: 500 * 1024 * 1024
        });
        
        // Save to temp file
        await writeFile(this.tempFilePath, Buffer.from(response.data));
        const fileSizeMB = (response.data.byteLength / 1024 / 1024).toFixed(1);
        console.log(`   ✓ Downloaded ${fileSizeMB} MB to temp file`);
        this.pausedAt = 0; // Starting from beginning
      }
      
      return new Promise((resolve, reject) => {
        try {
          console.log(`🎬 [AUTO DJ] Playing from temp file with FFmpeg...`);
          let chunkCount = 0;
          let errorOutput = '';

          // FFmpeg reads directly from TEMP FILE at correct speed
          const ffmpegArgs = [
            '-readrate', '1',         // Read input at native frame rate (prevents rushing!)
          ];
          
          // If resuming, seek to saved position
          if (this.pausedAt > 0) {
            ffmpegArgs.push('-ss', this.pausedAt.toString());
            console.log(`   ⏩ Seeking to ${this.pausedAt} seconds`);
          }
          
          ffmpegArgs.push(
            '-i', this.tempFilePath!,  // Input from temp file  
            '-f', 'f32le',             // Output as Float32 PCM
            '-ar', '48000',            // Sample rate to match HLS server
            '-ac', '2',                // Stereo
            '-vn',                     // No video
            '-loglevel', 'warning',    // Less verbose
            'pipe:1'                   // Output to stdout
          );
          
          const ffmpeg = spawn('ffmpeg', ffmpegArgs);
          
          // Track when this playback started
          this.startTime = Date.now();

          console.log(`   ✓ FFmpeg reading from file`);

          // Read FFmpeg output and emit as Float32Array chunks for HLS server
          let lastLogTime = Date.now();
          
          ffmpeg.stdout.on('data', (chunk: Buffer) => {
            // CRITICAL: Only emit if still playing (prevents buffered chunks after pause)
            if (!this.isPlaying) {
              return; // Stop emitting immediately when paused
            }
            
            chunkCount++;
            
            // Convert Buffer to Float32Array
            const float32Data = new Float32Array(
              chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength)
            );
            
            // Emit for HLS server to consume
            this.emit('audio-chunk', float32Data);
            
            // Log progress every 30 seconds (not every 100 chunks - too verbose!)
            const now = Date.now();
            if (now - lastLogTime > 30000) {
              console.log(`  🎵 [AUTO DJ] Playing ${track.title}... (${chunkCount} chunks)`);
              lastLogTime = now;
            }
          });

          // Capture FFmpeg errors
          ffmpeg.stderr.on('data', (data: Buffer) => {
            errorOutput += data.toString();
          });

          ffmpeg.on('exit', async (code) => {
            // Only clean up temp file if track fully finished (not paused)
            // If paused, we keep the file for resume
            if (code === 0 && this.tempFilePath) {
              // Track finished successfully - clean up
              try {
                await unlink(this.tempFilePath);
                console.log(`   ✓ Temp file deleted`);
                this.tempFilePath = null;
                this.pausedAt = 0; // Reset position for next track
              } catch (unlinkError) {
                console.warn(`   ⚠️ Could not delete temp file`);
              }
            }
            
            if (code !== 0 && code !== null) {
              // Code can be null when killed via SIGKILL (pause/stop)
              console.error(`❌ [AUTO DJ] FFmpeg exited with code ${code}`);
              console.error(`   Error output: ${errorOutput}`);
              console.error(`   Chunks processed: ${chunkCount}`);
              reject(new Error(`FFmpeg exit code ${code}`));
            } else if (code === 0) {
              console.log(`✅ [AUTO DJ] Track finished (${track.title})`);
              console.log(`   Total chunks: ${chunkCount}, Exit code: ${code}`);
              resolve();
            } else {
              // code === null (killed by SIGKILL during pause/stop)
              console.log(`⏸️ [AUTO DJ] Track playback stopped (paused or killed)`);
              console.log(`   Chunks processed: ${chunkCount}`);
              resolve(); // Resolve anyway to prevent hanging
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

