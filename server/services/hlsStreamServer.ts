/**
 * HLS Live Streaming Server
 * 
 * Generates HLS segments from live audio for web/mobile playback
 * Replaces Radio.co with our own streaming infrastructure
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { PassThrough } from 'stream';
import fs from 'fs/promises';
import path from 'path';

export interface HLSConfig {
  segmentDuration: number;  // Seconds per segment (10-15 recommended)
  playlistSize: number;     // Number of segments to keep in playlist
  bitrate: number;          // Audio bitrate (128 or 256)
}

interface HLSSegment {
  filename: string;
  duration: number;
  sequence: number;
  data: Buffer;
  timestamp: Date;
}

export class HLSStreamServer extends EventEmitter {
  private config: HLSConfig;
  private ffmpeg: ChildProcess | null = null;
  private inputStream: PassThrough | null = null;
  private isStreaming = false;
  private segments: HLSSegment[] = [];
  private currentSequence = 0;
  private streamPath: string;
  private sampleRate = 48000;
  private channels = 2;

  constructor(config: HLSConfig) {
    super();
    this.config = config;
    this.streamPath = '/tmp/hls-stream';
  }

  /**
   * Start HLS streaming
   */
  async start(): Promise<void> {
    console.log('🎙️ [HLS] Starting HLS streaming server...');
    console.log('   Segment duration:', this.config.segmentDuration, 'seconds');
    console.log('   Playlist size:', this.config.playlistSize, 'segments');
    console.log('   Bitrate:', this.config.bitrate, 'kbps');

    try {
      // Create temp directory for HLS segments
      await fs.mkdir(this.streamPath, { recursive: true });

      // Start FFmpeg HLS encoder
      await this.startFFmpegHLS();

      this.isStreaming = true;
      this.emit('started');
      
      console.log('✅ [HLS] HLS streaming server started');
    } catch (error) {
      console.error('❌ [HLS] Failed to start:', error);
      throw error;
    }
  }

  /**
   * Start FFmpeg to generate HLS segments
   */
  private async startFFmpegHLS(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('🎬 [HLS] Starting FFmpeg HLS encoder...');

      // Create passthrough stream for PCM input
      this.inputStream = new PassThrough();

      // FFmpeg command to create HLS stream
      const args = [
        // Input: PCM audio from browser
        '-f', 'f32le',
        '-ar', this.sampleRate.toString(),
        '-ac', this.channels.toString(),
        '-channel_layout', 'stereo',
        '-i', 'pipe:0',
        
        // Audio encoding
        '-c:a', 'aac',  // AAC is better for HLS than MP3
        '-b:a', `${this.config.bitrate}k`,
        '-ar', '48000',
        '-ac', '2',
        
        // HLS output
        '-f', 'hls',
        '-hls_time', this.config.segmentDuration.toString(),
        '-hls_list_size', this.config.playlistSize.toString(),
        '-hls_flags', 'delete_segments+temp_file',
        '-hls_segment_type', 'mpegts',
        '-hls_segment_filename', path.join(this.streamPath, 'segment-%03d.ts'),
        '-method', 'PUT',
        path.join(this.streamPath, 'playlist.m3u8')
      ];

      console.log('🎬 [HLS] FFmpeg HLS args:', args.join(' '));

      // Spawn FFmpeg
      this.ffmpeg = spawn('ffmpeg', args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Pipe input to FFmpeg
      this.inputStream.pipe(this.ffmpeg.stdin!);

      // Monitor FFmpeg output
      this.ffmpeg.stdout!.on('data', (data: Buffer) => {
        // FFmpeg might output useful info
        const message = data.toString();
        if (message.trim()) {
          console.log('📊 [HLS FFmpeg stdout]:', message.trim().substring(0, 100));
        }
      });

      // Monitor FFmpeg errors/info
      this.ffmpeg.stderr!.on('data', (data: Buffer) => {
        const message = data.toString();
        
        // Log segment creation
        if (message.includes('Opening') && message.includes('.ts')) {
          const match = message.match(/segment-(\d+)\.ts/);
          if (match) {
            const segNum = parseInt(match[1]);
            console.log(`📦 [HLS] Created segment ${segNum}`);
            this.currentSequence = segNum;
            this.emit('segment-created', segNum);
          }
        }
        
        // Log important info
        if (message.includes('Stream') || message.includes('Output')) {
          console.log('📊 [HLS]:', message.trim().substring(0, 200));
        }
        
        // Log errors
        if (message.includes('Error') || message.includes('error')) {
          console.error('⚠️ [HLS ERROR]:', message);
        }
      });

      this.ffmpeg.on('error', (error) => {
        console.error('❌ [HLS] FFmpeg error:', error);
        this.emit('error', error);
        reject(error);
      });

      this.ffmpeg.on('exit', (code) => {
        console.log(`📴 [HLS] FFmpeg exited with code ${code}`);
        this.isStreaming = false;
        this.emit('stopped');
      });

      // FFmpeg ready after a moment
      setTimeout(() => {
        console.log('✅ [HLS] FFmpeg HLS encoder started');
        resolve();
      }, 1000);
    });
  }

  /**
   * Process audio chunk from browser
   */
  processAudioChunk(audioData: Float32Array): void {
    if (!this.isStreaming || !this.inputStream) {
      return;
    }

    try {
      // Convert Float32Array to Buffer
      const buffer = Buffer.from(audioData.buffer);
      
      // Send to FFmpeg for HLS segmentation
      this.inputStream.write(buffer);
    } catch (error) {
      console.error('❌ [HLS] Error processing audio:', error);
      this.emit('error', error);
    }
  }

  /**
   * Get current HLS playlist
   */
  async getPlaylist(): Promise<string> {
    try {
      const playlistPath = path.join(this.streamPath, 'playlist.m3u8');
      const playlist = await fs.readFile(playlistPath, 'utf-8');
      return playlist;
    } catch (error) {
      console.error('❌ [HLS] Error reading playlist:', error);
      throw error;
    }
  }

  /**
   * Get HLS segment
   */
  async getSegment(filename: string): Promise<Buffer> {
    try {
      const segmentPath = path.join(this.streamPath, filename);
      const segment = await fs.readFile(segmentPath);
      return segment;
    } catch (error) {
      console.error('❌ [HLS] Error reading segment:', error);
      throw error;
    }
  }

  /**
   * Get streaming status
   */
  getStatus() {
    return {
      streaming: this.isStreaming,
      currentSegment: this.currentSequence,
      segmentCount: this.segments.length,
      encoder: 'ffmpeg-hls'
    };
  }

  /**
   * Stop streaming
   */
  async stop(): Promise<void> {
    console.log('📴 [HLS] Stopping HLS stream...');
    
    this.isStreaming = false;

    // Close input stream
    if (this.inputStream) {
      this.inputStream.end();
      this.inputStream = null;
    }

    // Kill FFmpeg
    if (this.ffmpeg) {
      this.ffmpeg.kill('SIGTERM');
      this.ffmpeg = null;
    }

    // Clean up segments
    try {
      await fs.rm(this.streamPath, { recursive: true, force: true });
    } catch (error) {
      console.warn('⚠️ [HLS] Error cleaning up segments:', error);
    }

    this.segments = [];
    this.currentSequence = 0;
    this.emit('stopped');
    
    console.log('✅ [HLS] HLS stream stopped');
  }
}

