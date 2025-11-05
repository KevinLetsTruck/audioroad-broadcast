/**
 * Direct MP3 Stream Service
 * 
 * Receives audio from browser and streams it as MP3 directly to phone callers
 * Bypasses HLS conversion entirely for simplicity and reliability
 */

import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import { spawn, ChildProcess } from 'child_process';

export class DirectMP3Stream extends EventEmitter {
  private ffmpeg: ChildProcess | null = null;
  private inputStream: PassThrough | null = null;
  private outputStreams: Set<PassThrough> = new Set();
  private isActive = false;
  private bytesProcessed = 0;

  /**
   * Start the MP3 streaming service
   */
  start(): void {
    if (this.isActive) {
      console.log('ℹ️ [MP3-STREAM] Already active');
      return;
    }

    console.log('🎵 [MP3-STREAM] Starting direct MP3 streaming...');
    
    this.inputStream = new PassThrough();
    this.isActive = true;
    this.bytesProcessed = 0;

    // Start FFmpeg to convert PCM to MP3
    this.startFFmpeg();

    console.log('✅ [MP3-STREAM] Direct MP3 streaming started');
  }

  /**
   * Start FFmpeg to convert Float32 PCM to MP3
   */
  private startFFmpeg(): void {
    const args = [
      // Input: Float32 PCM from browser
      '-f', 'f32le',
      '-ar', '48000',
      '-ac', '2',
      '-i', 'pipe:0',
      
      // Output: MP3
      '-c:a', 'libmp3lame',
      '-b:a', '128k',
      '-ar', '44100',
      '-ac', '2',
      '-f', 'mp3',
      '-write_xing', '0', // Streaming mode
      
      'pipe:1'
    ];

    console.log('🎬 [MP3-STREAM] Starting FFmpeg:', args.join(' '));

    this.ffmpeg = spawn('ffmpeg', args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Pipe input to FFmpeg
    if (this.inputStream) {
      this.inputStream.pipe(this.ffmpeg.stdin!);
    }

    // Broadcast FFmpeg output to all client streams
    this.ffmpeg.stdout!.on('data', (data: Buffer) => {
      this.bytesProcessed += data.length;
      
      for (const clientStream of this.outputStreams) {
        if (!clientStream.destroyed) {
          clientStream.push(data);
        }
      }
    });

    this.ffmpeg.stderr!.on('data', (data: Buffer) => {
      const message = data.toString();
      if (message.includes('Error') || message.includes('error')) {
        console.error('⚠️ [MP3-STREAM]:', message.trim().substring(0, 200));
      }
    });

    this.ffmpeg.on('error', (error) => {
      console.error('❌ [MP3-STREAM] FFmpeg error:', error);
      this.emit('error', error);
    });

    this.ffmpeg.on('exit', (code) => {
      console.log(`📴 [MP3-STREAM] FFmpeg exited with code ${code}`);
      this.emit('stopped');
    });
  }

  /**
   * Process audio chunk from browser
   */
  processAudio(audioData: Float32Array): void {
    if (!this.isActive || !this.inputStream) {
      return;
    }

    try {
      const buffer = Buffer.from(audioData.buffer);
      this.inputStream.write(buffer);
    } catch (error) {
      console.error('❌ [MP3-STREAM] Error processing audio:', error);
    }
  }

  /**
   * Get a client stream for a phone caller
   */
  getClientStream(): PassThrough {
    const clientStream = new PassThrough();
    this.outputStreams.add(clientStream);

    clientStream.on('close', () => {
      this.outputStreams.delete(clientStream);
    });

    clientStream.on('end', () => {
      this.outputStreams.delete(clientStream);
    });

    console.log(`📡 [MP3-STREAM] Client stream created (total: ${this.outputStreams.size})`);
    return clientStream;
  }

  /**
   * Stop streaming
   */
  stop(): void {
    console.log('📴 [MP3-STREAM] Stopping...');
    
    this.isActive = false;

    if (this.inputStream) {
      this.inputStream.end();
      this.inputStream = null;
    }

    if (this.ffmpeg) {
      this.ffmpeg.kill('SIGTERM');
      this.ffmpeg = null;
    }

    for (const stream of this.outputStreams) {
      stream.end();
    }
    this.outputStreams.clear();

    console.log(`✅ [MP3-STREAM] Stopped (processed ${(this.bytesProcessed / 1024 / 1024).toFixed(2)} MB)`);
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      active: this.isActive,
      clients: this.outputStreams.size,
      bytesProcessed: this.bytesProcessed
    };
  }
}



