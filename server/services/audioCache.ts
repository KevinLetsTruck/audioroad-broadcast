/**
 * Audio Cache Service
 * 
 * Maintains a rolling buffer of recent audio as MP3
 * Allows instant serving of chunks without waiting for HLS conversion
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

class AudioCacheService extends EventEmitter {
  private ffmpeg: ChildProcess | null = null;
  private audioBuffer: Buffer[] = [];
  private maxBufferSize = 60 * 128 * 1024 / 8; // 60 seconds of 128kbps MP3
  private isRunning = false;

  /**
   * Start caching audio from HLS stream
   */
  start(hlsUrl: string): void {
    if (this.isRunning) {
      console.log('⚠️ [AUDIO-CACHE] Already running');
      return;
    }

    this.isRunning = true;
    this.audioBuffer = [];

    console.log('🎵 [AUDIO-CACHE] Starting continuous MP3 caching...');
    console.log(`   Source: ${hlsUrl}`);

    const args = [
      '-loglevel', 'error',
      '-live_start_index', '-1',
      '-i', hlsUrl,
      
      // Reconnect on errors
      '-reconnect', '1',
      '-reconnect_at_eof', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '2',
      
      // Fast processing
      '-fflags', '+genpts',
      
      // MP3 output
      '-c:a', 'libmp3lame',
      '-b:a', '128k',
      '-ar', '44100',
      '-ac', '2',
      '-f', 'mp3',
      
      'pipe:1'
    ];

    this.ffmpeg = spawn('ffmpeg', args);

    // Buffer audio data
    this.ffmpeg.stdout?.on('data', (chunk: Buffer) => {
      this.audioBuffer.push(chunk);
      
      // Keep buffer size limited (rolling window)
      const totalSize = this.audioBuffer.reduce((sum, buf) => sum + buf.length, 0);
      if (totalSize > this.maxBufferSize) {
        // Remove old chunks
        while (totalSize > this.maxBufferSize && this.audioBuffer.length > 0) {
          const removed = this.audioBuffer.shift();
          if (removed) {
            const newTotal = totalSize - removed.length;
          }
        }
      }
    });

    this.ffmpeg.stderr?.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) {
        console.error('📊 [AUDIO-CACHE FFmpeg]:', msg);
      }
    });

    this.ffmpeg.on('exit', (code) => {
      console.log(`📴 [AUDIO-CACHE] FFmpeg exited (code: ${code})`);
      this.isRunning = false;
      // Auto-restart after 2 seconds
      setTimeout(() => this.start(hlsUrl), 2000);
    });

    this.ffmpeg.on('error', (error) => {
      console.error('❌ [AUDIO-CACHE] FFmpeg error:', error);
      this.isRunning = false;
    });

    console.log('✅ [AUDIO-CACHE] Caching started');
  }

  /**
   * Get last N seconds of cached audio
   */
  getChunk(durationSeconds: number): Buffer {
    const targetSize = durationSeconds * 128 * 1024 / 8; // bytes for N seconds at 128kbps
    const totalSize = this.audioBuffer.reduce((sum, buf) => sum + buf.length, 0);
    
    if (totalSize === 0) {
      return Buffer.alloc(0);
    }

    // Take last N seconds worth of audio
    const chunks: Buffer[] = [];
    let size = 0;
    
    for (let i = this.audioBuffer.length - 1; i >= 0 && size < targetSize; i--) {
      chunks.unshift(this.audioBuffer[i]);
      size += this.audioBuffer[i].length;
    }

    return Buffer.concat(chunks);
  }

  /**
   * Stop caching
   */
  stop(): void {
    if (this.ffmpeg) {
      this.ffmpeg.kill('SIGTERM');
      this.ffmpeg = null;
    }
    this.isRunning = false;
    this.audioBuffer = [];
  }

  get caching(): boolean {
    return this.isRunning;
  }

  get bufferSize(): number {
    return this.audioBuffer.reduce((sum, buf) => sum + buf.length, 0);
  }
}

// Singleton instance
export const audioCache = new AudioCacheService();

