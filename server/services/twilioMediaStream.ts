/**
 * Twilio MediaStreams Service
 * 
 * Streams live audio to phone callers using Twilio's MediaStreams API
 * MediaStreams uses WebSocket instead of <Play>, supporting infinite streams
 * 
 * Audio Requirements:
 * - Format: mulaw (8-bit PCM mu-law)
 * - Sample Rate: 8000 Hz
 * - Channels: 1 (mono)
 * - Encoding: Base64
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import WebSocket from 'ws';

interface MediaStreamConfig {
  hlsUrl: string;
  callSid?: string;
}

export class TwilioMediaStreamer extends EventEmitter {
  private config: MediaStreamConfig;
  private ffmpeg: ChildProcess | null = null;
  private isRunning = false;
  private audioBuffer: Buffer[] = [];
  private sequenceNumber = 0;

  constructor(config: MediaStreamConfig) {
    super();
    this.config = config;
  }

  /**
   * Start streaming audio from HLS to Twilio MediaStream
   */
  start(ws: WebSocket): void {
    if (this.isRunning) {
      console.warn('⚠️ [MEDIA-STREAM] Already running');
      return;
    }

    this.isRunning = true;
    this.sequenceNumber = 0;
    
    console.log('🎵 [MEDIA-STREAM] Starting FFmpeg HLS → mulaw converter...');
    console.log(`   HLS URL: ${this.config.hlsUrl}`);
    console.log(`   Output: mulaw 8kHz mono (Twilio MediaStreams format)`);

    // FFmpeg: Convert HLS → mulaw for Twilio
    const args = [
      '-loglevel', 'error',
      
      // Input: HLS stream
      '-i', this.config.hlsUrl,
      
      // Reconnect on errors
      '-reconnect', '1',
      '-reconnect_at_eof', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '2',
      
      // Audio output: mulaw 8kHz mono (Twilio requirement)
      '-f', 'mulaw',
      '-ar', '8000',
      '-ac', '1',
      
      // Output to stdout
      'pipe:1'
    ];

    console.log('🎬 [MEDIA-STREAM] FFmpeg command:', 'ffmpeg', args.join(' '));

    this.ffmpeg = spawn('ffmpeg', args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Handle FFmpeg stdout (mulaw audio data)
    this.ffmpeg.stdout?.on('data', (chunk: Buffer) => {
      this.sendAudioToTwilio(ws, chunk);
    });

    // Handle FFmpeg stderr (logs/errors)
    this.ffmpeg.stderr?.on('data', (data: Buffer) => {
      const message = data.toString().trim();
      if (message) {
        console.log('📊 [MEDIA-STREAM FFmpeg]:', message);
      }
    });

    // Handle FFmpeg exit
    this.ffmpeg.on('exit', (code, signal) => {
      console.log(`📴 [MEDIA-STREAM] FFmpeg exited (code: ${code}, signal: ${signal})`);
      this.isRunning = false;
      this.emit('stopped');
    });

    // Handle FFmpeg errors
    this.ffmpeg.on('error', (error) => {
      console.error('❌ [MEDIA-STREAM] FFmpeg error:', error);
      this.isRunning = false;
      this.emit('error', error);
    });

    console.log('✅ [MEDIA-STREAM] FFmpeg converter started');
  }

  /**
   * Send audio data to Twilio via WebSocket
   * Twilio expects base64-encoded mulaw audio in specific JSON format
   */
  private sendAudioToTwilio(ws: WebSocket, chunk: Buffer): void {
    if (ws.readyState !== WebSocket.OPEN) {
      return;
    }

    // Twilio expects 160-byte chunks (20ms of mulaw audio at 8kHz)
    const chunkSize = 160;
    
    for (let i = 0; i < chunk.length; i += chunkSize) {
      const audioChunk = chunk.slice(i, i + chunkSize);
      
      // Pad if needed
      const paddedChunk = audioChunk.length < chunkSize 
        ? Buffer.concat([audioChunk, Buffer.alloc(chunkSize - audioChunk.length)])
        : audioChunk;

      // Send to Twilio in MediaStream format
      const payload = {
        event: 'media',
        streamSid: this.config.callSid || 'unknown',
        media: {
          timestamp: Date.now(),
          payload: paddedChunk.toString('base64')
        }
      };

      try {
        ws.send(JSON.stringify(payload));
        this.sequenceNumber++;
      } catch (error) {
        console.error('❌ [MEDIA-STREAM] Error sending to Twilio:', error);
      }
    }
  }

  /**
   * Stop streaming
   */
  stop(): void {
    if (this.ffmpeg) {
      console.log('🛑 [MEDIA-STREAM] Stopping FFmpeg...');
      this.ffmpeg.kill('SIGTERM');
      this.ffmpeg = null;
    }
    this.isRunning = false;
    this.audioBuffer = [];
    this.sequenceNumber = 0;
  }

  /**
   * Check if streaming
   */
  get streaming(): boolean {
    return this.isRunning;
  }
}


