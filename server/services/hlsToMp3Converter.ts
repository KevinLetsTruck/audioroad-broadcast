/**
 * HLS to MP3 Converter Service
 * 
 * Converts HLS stream segments to continuous MP3 stream for Twilio compatibility
 * Twilio requires MP3/WAV format, not HLS
 * 
 * Supports multiple output streams from a single converter instance using PassThrough streams
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { Readable, PassThrough } from 'stream';

export interface HLSConverterConfig {
  hlsPlaylistUrl: string;
  bitrate?: number;        // MP3 bitrate (default: 128k)
  sampleRate?: number;     // Sample rate (default: 44100)
  channels?: number;       // Audio channels (default: 2)
}

export class HLSToMP3Converter extends EventEmitter {
  private config: HLSConverterConfig;
  private ffmpeg: ChildProcess | null = null;
  private isRunning = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 2000; // 2 seconds
  private outputStream: PassThrough | null = null;
  private outputStreams: Set<PassThrough> = new Set();

  constructor(config: HLSConverterConfig) {
    super();
    this.config = {
      bitrate: 128,
      sampleRate: 44100,
      channels: 2,
      ...config
    };
  }

  /**
   * Start converting HLS to MP3 stream
   * Returns a readable stream of MP3 data
   * Multiple calls to this method share the same underlying converter
   */
  start(): Readable {
    // Initialize converter on first call
    if (!this.isRunning) {
      this.isRunning = true;
      this.reconnectAttempts = 0;
      this.startFFmpeg();
    }

    // Create a new PassThrough stream for this client
    const clientStream = new PassThrough();
    this.outputStreams.add(clientStream);

    // Note: We don't pipe from outputStream because PassThrough doesn't support multiple pipes
    // Instead, data is pushed directly to all client streams in the FFmpeg data handler

    // Clean up when client stream ends
    clientStream.on('end', () => {
      this.outputStreams.delete(clientStream);
    });

    clientStream.on('close', () => {
      this.outputStreams.delete(clientStream);
    });

    return clientStream;
  }

  /**
   * Start FFmpeg process to convert HLS to MP3
   */
  private startFFmpeg(): void {
    console.log('🎵 [HLS→MP3] Starting FFmpeg converter...');
    console.log(`   HLS URL: ${this.config.hlsPlaylistUrl}`);
    console.log(`   Output: MP3 ${this.config.bitrate}kbps, ${this.config.sampleRate}Hz, ${this.config.channels}ch`);
    console.log(`   NOTE: If this fails with 503, the HLS server may not be running or accessible`);

    // Create main output stream
    this.outputStream = new PassThrough();

    // FFmpeg command to convert HLS to MP3 stream
    const args = [
      // Logging
      '-loglevel', 'info',
      
      // Input: HLS playlist URL
      '-i', this.config.hlsPlaylistUrl,
      
      // Handle errors gracefully (continue on errors)
      '-ignore_unknown',
      '-fflags', '+genpts',
      '-reconnect', '1',
      '-reconnect_at_eof', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '2',
      
      // Audio codec: MP3
      '-c:a', 'libmp3lame',
      '-b:a', `${this.config.bitrate}k`,
      '-ar', this.config.sampleRate!.toString(),
      '-ac', this.config.channels!.toString(),
      
      // Output format: MP3
      '-f', 'mp3',
      
      // Output to stdout
      'pipe:1'
    ];

    console.log('🎬 [HLS→MP3] FFmpeg command:', 'ffmpeg', args.join(' '));

    // Spawn FFmpeg process
    this.ffmpeg = spawn('ffmpeg', args, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let bytesReceived = 0;
    let lastLogTime = Date.now();

    // Pipe FFmpeg stdout (MP3 data) to output stream
    this.ffmpeg.stdout!.on('data', (data: Buffer) => {
      if (this.isRunning && this.outputStream) {
        bytesReceived += data.length;
        
        // Log data flow every 5 seconds
        const now = Date.now();
        if (now - lastLogTime > 5000) {
          console.log(`📊 [HLS→MP3] Streaming: ${(bytesReceived / 1024).toFixed(1)} KB received, ${this.outputStreams.size} clients`);
          lastLogTime = now;
        }
        
        // Push to main output stream
        this.outputStream.push(data);
        
        // Also push to all client streams directly
        // (PassThrough streams don't support multiple pipes)
        for (const clientStream of this.outputStreams) {
          if (!clientStream.destroyed) {
            clientStream.push(data);
          }
        }
      }
    });

    // Handle FFmpeg errors/info - LOG EVERYTHING for debugging
    this.ffmpeg.stderr!.on('data', (data: Buffer) => {
      const message = data.toString();
      
      // Log ALL output for now to debug issues
      console.log('📊 [HLS→MP3 FFmpeg]:', message.trim().substring(0, 300));
      
      // Detect specific errors
      if (message.includes('Server returned 4') || message.includes('Server returned 5')) {
        console.error('❌ [HLS→MP3] HTTP error accessing stream:', message.trim());
        this.emit('error', new Error('Stream not accessible'));
      }
      
      if (message.includes('No such file') || message.includes('Invalid data')) {
        console.error('❌ [HLS→MP3] Invalid stream data:', message.trim());
        this.emit('error', new Error('Invalid stream'));
      }
    });

    // Handle FFmpeg process errors
    this.ffmpeg.on('error', (error) => {
      console.error('❌ [HLS→MP3] FFmpeg spawn error:', error);
      this.emit('error', error);
      this.handleReconnect();
    });

    // Handle FFmpeg exit
    this.ffmpeg.on('exit', (code, signal) => {
      console.log(`📴 [HLS→MP3] FFmpeg exited with code ${code}, signal ${signal}`);
      console.log(`   Total bytes processed: ${(bytesReceived / 1024).toFixed(1)} KB`);
      
      if (code !== 0 && code !== null && this.isRunning) {
        console.warn('⚠️ [HLS→MP3] FFmpeg exited unexpectedly, attempting reconnect...');
        this.handleReconnect();
      } else {
        this.isRunning = false;
        this.emit('stopped');
      }
    });

    // FFmpeg ready
    setTimeout(() => {
      console.log('✅ [HLS→MP3] FFmpeg converter started, waiting for data...');
      this.emit('started');
    }, 1000);
  }

  /**
   * Handle reconnection if FFmpeg exits unexpectedly
   */
  private handleReconnect(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ [HLS→MP3] Max reconnection attempts reached');
      this.stop();
      this.emit('error', new Error('Max reconnection attempts reached'));
      return;
    }

    this.reconnectAttempts++;
    console.log(`🔄 [HLS→MP3] Reconnecting (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    // Clean up old process
    if (this.ffmpeg) {
      this.ffmpeg.removeAllListeners();
      this.ffmpeg.kill('SIGKILL');
      this.ffmpeg = null;
    }

    // Recreate output stream
    if (this.outputStream) {
      // Old stream will be replaced, client streams will get data from new FFmpeg process
      this.outputStream.end();
      this.outputStream = null;
    }

    // Wait before reconnecting
    setTimeout(() => {
      if (this.isRunning) {
        this.startFFmpeg();
      }
    }, this.reconnectDelay);
  }

  /**
   * Stop the converter
   */
  stop(): void {
    console.log('📴 [HLS→MP3] Stopping converter...');
    
    this.isRunning = false;

    if (this.ffmpeg) {
      this.ffmpeg.removeAllListeners();
      this.ffmpeg.kill('SIGTERM');
      this.ffmpeg = null;
    }

    // End all output streams
    if (this.outputStream) {
      this.outputStream.end();
      this.outputStream = null;
    }

    for (const stream of this.outputStreams) {
      stream.end();
    }
    this.outputStreams.clear();

    this.emit('stopped');
    console.log('✅ [HLS→MP3] Converter stopped');
  }

  /**
   * Check if converter is running
   */
  getStatus() {
    return {
      running: this.isRunning,
      reconnectAttempts: this.reconnectAttempts,
      activeClients: this.outputStreams.size
    };
  }
}
