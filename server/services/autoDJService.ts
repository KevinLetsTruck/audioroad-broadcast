/**
 * Auto DJ Service
 * 
 * Plays music/content automatically when no live broadcast is active
 * Integrates with HLS streaming server
 */

import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { PassThrough } from 'stream';
import axios from 'axios';

const prisma = new PrismaClient();

export class AutoDJService extends EventEmitter {
  private isPlaying = false;
  private currentTrack: any = null;
  private ffmpeg: ChildProcess | null = null;
  private outputStream: PassThrough | null = null;
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

    if (this.outputStream) {
      this.outputStream.end();
      this.outputStream = null;
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
    return new Promise(async (resolve, reject) => {
      try {
        console.log(`📥 [AUTO DJ] Downloading: ${track.audioUrl}`);
        
        // Download audio file
        const response = await axios.get(track.audioUrl, {
          responseType: 'stream'
        });

        console.log(`🎬 [AUTO DJ] Playing track with FFmpeg...`);

        // FFmpeg to decode and output PCM
        const ffmpeg = spawn('ffmpeg', [
          '-i', 'pipe:0',           // Input from stream
          '-f', 'f32le',            // Output as Float32 PCM
          '-ar', '48000',           // Sample rate to match HLS server
          '-ac', '2',               // Stereo
          'pipe:1'                  // Output to stdout
        ]);

        // Pipe download to FFmpeg
        response.data.pipe(ffmpeg.stdin);

        // Create output stream for HLS server
        this.outputStream = new PassThrough();
        ffmpeg.stdout.pipe(this.outputStream);

        // Emit stream for HLS server to consume
        this.emit('audio-chunk', this.outputStream);

        ffmpeg.on('exit', (code) => {
          console.log(`✅ [AUTO DJ] Track finished (${track.title})`);
          if (this.outputStream) {
            this.outputStream.end();
            this.outputStream = null;
          }
          resolve();
        });

        ffmpeg.on('error', (error) => {
          console.error('❌ [AUTO DJ] FFmpeg error:', error);
          reject(error);
        });

        this.ffmpeg = ffmpeg;

      } catch (error) {
        console.error('❌ [AUTO DJ] Error setting up playback:', error);
        reject(error);
      }
    });
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

