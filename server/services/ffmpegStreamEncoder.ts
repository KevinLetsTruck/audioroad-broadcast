/**
 * FFmpeg-Based Stream Encoder
 * 
 * Professional MP3 encoding using FFmpeg (industry standard)
 * Much more reliable than lamejs - used by Netflix, Spotify, YouTube, etc.
 */

import { EventEmitter } from 'events';
import net from 'net';
import { spawn, ChildProcess } from 'child_process';
import { PassThrough } from 'stream';

export interface StreamConfig {
  serverUrl: string;
  port: number;
  password: string;
  streamName?: string;
  genre?: string;
  url?: string;
  bitrate: number;
}

export class FFmpegStreamEncoder extends EventEmitter {
  private config: StreamConfig | null = null;
  private socket: net.Socket | null = null;
  private ffmpeg: ChildProcess | null = null;
  private inputStream: PassThrough | null = null;
  private isConnected = false;
  private isStreaming = false;
  private bytesStreamed = 0;
  private sampleRate = 48000; // Match browser audio context
  private channels = 2;

  /**
   * Initialize with Radio.co configuration
   */
  async initialize(config: StreamConfig): Promise<void> {
    this.config = config;
    
    console.log('🎙️ [FFMPEG STREAM] Initializing FFmpeg encoder...');
    console.log('   Sample rate:', this.sampleRate);
    console.log('   Channels:', this.channels);
    console.log('   Bitrate:', config.bitrate);

    try {
      // Connect to Radio.co first
      await this.connectToRadioCo();
      
      // Start FFmpeg encoder
      await this.startFFmpeg();
      
      console.log('✅ [FFMPEG STREAM] Encoder initialized and connected!');
      
    } catch (error) {
      console.error('❌ [FFMPEG STREAM] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Connect to Radio.co Shoutcast server
   */
  private async connectToRadioCo(): Promise<void> {
    if (!this.config) {
      throw new Error('Stream not configured');
    }

    const config = this.config;

    return new Promise((resolve, reject) => {
      console.log(`📡 [FFMPEG STREAM] Connecting to ${config.serverUrl}:${config.port}`);

      this.socket = new net.Socket();

      this.socket.on('connect', () => {
        console.log('🔌 [FFMPEG STREAM] TCP connected, sending handshake...');
        this.sendShoutcastHandshake();
      });

      this.socket.on('data', (data) => {
        const response = data.toString();
        console.log('📥 [FFMPEG STREAM] Radio.co response:', response.substring(0, 100));

        if (response.includes('ICY 200 OK') || response.includes('HTTP/1.0 200 OK')) {
          console.log('✅ [FFMPEG STREAM] Connected to Radio.co!');
          this.isConnected = true;
          this.emit('connected');
          resolve();
        } else if (response.includes('Invalid password') || response.includes('401')) {
          const error = new Error('Invalid Radio.co password');
          console.error('❌ [FFMPEG STREAM]', error.message);
          this.emit('error', error);
          reject(error);
        } else if (!this.isConnected) {
          const error = new Error('Unexpected Radio.co response: ' + response);
          console.error('❌ [FFMPEG STREAM]', error.message);
          this.emit('error', error);
          reject(error);
        }
      });

      this.socket.on('error', (error) => {
        console.error('❌ [FFMPEG STREAM] Socket error:', error);
        this.emit('error', error);
        
        if (!this.isConnected) {
          reject(error);
        }
      });

      this.socket.on('close', () => {
        console.log('📴 [FFMPEG STREAM] Connection closed');
        this.isConnected = false;
        this.isStreaming = false;
        this.emit('disconnected');
      });

      // Connect to Radio.co
      this.socket.connect(config.port, config.serverUrl);

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!this.isConnected) {
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Send Shoutcast handshake
   */
  private sendShoutcastHandshake(): void {
    if (!this.socket || !this.config) return;

    const config = this.config;

    // Radio.co uses Icecast 2.x protocol
    // Try basic authentication format first
    const handshake = [
      `SOURCE / HTTP/1.0`,
      `Authorization: Basic ${Buffer.from(`source:${config.password}`).toString('base64')}`,
      `Host: ${config.serverUrl}:${config.port}`,
      `User-Agent: AudioRoad-FFmpeg/1.0`,
      `Content-Type: audio/mpeg`,
      `ice-name: ${config.streamName || 'AudioRoad Network LIVE'}`,
      `ice-genre: ${config.genre || 'Trucking'}`,
      `ice-url: ${config.url || 'http://audioroad.letstruck.com'}`,
      `ice-public: 1`,
      `ice-bitrate: ${config.bitrate}`,
      `ice-description: ${config.streamName || 'Live Broadcast'}`,
      '',
      ''
    ].join('\r\n');
    
    console.log('📤 [FFMPEG STREAM] Using Icecast 2.x HTTP Basic Auth format');

    console.log('📤 [FFMPEG STREAM] Sending Shoutcast handshake...');
    this.socket.write(handshake);
  }

  /**
   * Start FFmpeg encoder process
   */
  private async startFFmpeg(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('🎬 [FFMPEG STREAM] Starting FFmpeg process...');

      // Create passthrough stream for PCM input
      this.inputStream = new PassThrough();

      // FFmpeg command to encode PCM to MP3
      const args = [
        '-f', 'f32le',                    // Input format: 32-bit float PCM little-endian
        '-ar', this.sampleRate.toString(), // Sample rate: 48000 from browser
        '-ac', this.channels.toString(),   // Channels: 2 (stereo)
        '-channel_layout', 'stereo',      // Explicit stereo layout
        '-i', 'pipe:0',                   // Input from stdin
        '-acodec', 'libmp3lame',          // Use LAME MP3 encoder
        '-b:a', `${this.config!.bitrate}k`, // Bitrate
        '-ar', '44100',                   // Output: 44.1kHz (standard for Radio.co)
        '-ac', '2',                       // Stereo output
        '-f', 'mp3',                      // Output format: MP3
        '-fflags', '+nobuffer',           // Low latency
        '-flush_packets', '1',            // Flush packets immediately
        'pipe:1'                          // Output to stdout
      ];

      console.log('🎬 [FFMPEG STREAM] FFmpeg args:', args.join(' '));

      // Spawn FFmpeg process
      this.ffmpeg = spawn('ffmpeg', args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Pipe input stream to FFmpeg stdin
      this.inputStream.pipe(this.ffmpeg.stdin!);

      // Pipe FFmpeg output (MP3) to Radio.co
      this.ffmpeg.stdout!.on('data', (mp3Data: Buffer) => {
        if (this.socket && this.isConnected) {
          this.socket.write(mp3Data);
          this.bytesStreamed += mp3Data.length;
          this.emit('data-sent', mp3Data.length);
        }
      });

      // Handle FFmpeg errors
      this.ffmpeg.stderr!.on('data', (data: Buffer) => {
        const message = data.toString();
        // Only log errors, not info messages
        if (message.includes('Error') || message.includes('error')) {
          console.error('⚠️ [FFMPEG]:', message);
        }
      });

      this.ffmpeg.on('error', (error) => {
        console.error('❌ [FFMPEG STREAM] FFmpeg error:', error);
        this.emit('error', error);
        reject(error);
      });

      this.ffmpeg.on('exit', (code) => {
        console.log(`📴 [FFMPEG STREAM] FFmpeg exited with code ${code}`);
        this.isStreaming = false;
      });

      // FFmpeg ready after a moment
      setTimeout(() => {
        this.isStreaming = true;
        console.log('✅ [FFMPEG STREAM] FFmpeg encoder started');
        resolve();
      }, 500);
    });
  }

  /**
   * Process audio chunk from browser
   * @param audioData - Float32Array PCM data from browser
   */
  processAudioChunk(audioData: Float32Array): void {
    if (!this.isStreaming || !this.inputStream) {
      return;
    }

    try {
      // Convert Float32Array to Buffer (raw PCM bytes)
      const buffer = Buffer.from(audioData.buffer);
      
      // Send to FFmpeg for encoding
      this.inputStream.write(buffer);
    } catch (error) {
      console.error('❌ [FFMPEG STREAM] Error processing audio:', error);
      this.emit('error', error);
    }
  }

  /**
   * Stop streaming and disconnect
   */
  async stop(): Promise<void> {
    console.log('📴 [FFMPEG STREAM] Stopping stream...');
    
    this.isStreaming = false;

    // Close FFmpeg input
    if (this.inputStream) {
      this.inputStream.end();
      this.inputStream = null;
    }

    // Kill FFmpeg process
    if (this.ffmpeg) {
      this.ffmpeg.kill('SIGTERM');
      this.ffmpeg = null;
    }

    this.isConnected = false;

    // Close Radio.co connection
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }

    this.emit('stopped');
    
    console.log('✅ [FFMPEG STREAM] Stream stopped');
  }

  /**
   * Get current stream status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      streaming: this.isStreaming,
      bytesStreamed: this.bytesStreamed,
      encoder: 'ffmpeg'
    };
  }
}

