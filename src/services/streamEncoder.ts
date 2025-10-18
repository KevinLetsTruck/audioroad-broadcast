/**
 * Stream Encoder
 * 
 * Handles encoding audio to MP3 and streaming to Radio.co via backend WebSocket
 */

// @ts-ignore - lamejs doesn't have types
import * as lamejs from 'lamejs';
import { io, Socket } from 'socket.io-client';

export interface StreamConfig {
  serverUrl: string;
  port: number;
  password: string;
  mountPoint?: string;
  streamName?: string;
  genre?: string;
  url?: string;
  bitrate: number; // 128 or 256
}

export interface StreamStatus {
  connected: boolean;
  streaming: boolean;
  bytesStreamed: number;
  duration: number;
  error?: string;
}

export class StreamEncoder {
  private config: StreamConfig | null = null;
  private isStreaming = false;
  private isConnected = false;
  private mp3Encoder: any = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private bytesStreamed = 0;
  private startTime = 0;
  private socket: Socket | null = null;

  /**
   * Initialize encoder with configuration
   */
  configure(config: StreamConfig): void {
    this.config = config;
    console.log('🎙️ Stream encoder configured:', {
      server: config.serverUrl,
      port: config.port,
      bitrate: config.bitrate
    });
  }

  /**
   * Start streaming to Radio.co
   */
  async startStreaming(stream: MediaStream): Promise<void> {
    if (!this.config) {
      throw new Error('Stream encoder not configured');
    }

    if (this.isStreaming) {
      console.warn('Already streaming');
      return;
    }

    try {
      // Create audio context if needed
      if (!this.audioContext) {
        this.audioContext = new AudioContext({
          sampleRate: 48000
        });
      }

      // Create MP3 encoder
      const sampleRate = this.audioContext.sampleRate;
      const kbps = this.config.bitrate;
      const channels = 2;

      // Initialize lame encoder
      this.mp3Encoder = new lamejs.Mp3Encoder(channels, sampleRate, kbps);

      // Create audio processing chain
      this.sourceNode = this.audioContext.createMediaStreamSource(stream);
      
      // Use ScriptProcessorNode for audio processing
      // Note: This is deprecated but AudioWorklet requires separate files
      // For a production app, migrate to AudioWorklet
      const bufferSize = 4096;
      this.processorNode = this.audioContext.createScriptProcessor(
        bufferSize,
        channels,
        channels
      );

      // Process audio and encode to MP3
      this.processorNode.onaudioprocess = (event) => {
        if (!this.isStreaming || !this.mp3Encoder) return;

        const left = event.inputBuffer.getChannelData(0);
        const right = event.inputBuffer.getChannelData(1);

        // Convert Float32Array to Int16Array for lame
        const leftInt16 = this.floatTo16BitPCM(left);
        const rightInt16 = this.floatTo16BitPCM(right);

        // Encode to MP3
        const mp3buf = this.mp3Encoder.encodeBuffer(leftInt16, rightInt16);

        if (mp3buf.length > 0) {
          this.sendToServer(mp3buf);
          this.bytesStreamed += mp3buf.length;
        }
      };

      // Connect nodes
      this.sourceNode.connect(this.processorNode);
      this.processorNode.connect(this.audioContext.destination);

      // Connect to Radio.co server
      await this.connectToServer();

      this.isStreaming = true;
      this.startTime = Date.now();
      console.log('🚀 Streaming started');

    } catch (error) {
      console.error('Failed to start streaming:', error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Stop streaming
   */
  async stopStreaming(): Promise<void> {
    if (!this.isStreaming) return;

    try {
      // Flush remaining MP3 data
      if (this.mp3Encoder) {
        const mp3buf = this.mp3Encoder.flush();
        if (mp3buf.length > 0) {
          this.sendToServer(mp3buf);
        }
      }

      // Disconnect from server
      this.disconnectFromServer();

      this.cleanup();
      this.isStreaming = false;
      console.log('⏹️ Streaming stopped');

    } catch (error) {
      console.error('Error stopping stream:', error);
      this.cleanup();
    }
  }

  /**
   * Connect to Radio.co via backend WebSocket
   */
  private async connectToServer(): Promise<void> {
    if (!this.config) return;

    return new Promise((resolve, reject) => {
      console.log(`🔌 Connecting to Radio.co via backend...`);

      // Connect to our backend Socket.IO server
      this.socket = io();

      this.socket.on('connect', () => {
        console.log('✅ Connected to backend');

        // Request to start streaming to Radio.co
        this.socket!.emit('stream:start', this.config, (response: any) => {
          if (response.success) {
            console.log('✅ Backend connected to Radio.co!');
            this.isConnected = true;
            resolve();
          } else {
            console.error('❌ Failed to connect to Radio.co:', response.error);
            this.isConnected = false;
            reject(new Error(response.error));
          }
        });
      });

      this.socket.on('stream:connected', () => {
        console.log('🎙️ Stream to Radio.co active');
        this.isConnected = true;
      });

      this.socket.on('stream:disconnected', () => {
        console.warn('⚠️ Disconnected from Radio.co');
        this.isConnected = false;
      });

      this.socket.on('stream:error', (error: any) => {
        console.error('❌ Stream error:', error.message);
        this.isConnected = false;
      });

      this.socket.on('disconnect', () => {
        console.warn('⚠️ Backend connection lost');
        this.isConnected = false;
      });
    });
  }

  /**
   * Disconnect from server
   */
  private disconnectFromServer(): void {
    if (this.socket) {
      this.socket.emit('stream:stop');
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
  }

  /**
   * Send encoded MP3 data to backend WebSocket
   */
  private sendToServer(mp3Data: Int8Array | Uint8Array): void {
    if (!this.isConnected || !this.socket) return;

    // Convert to ArrayBuffer for transmission
    const buffer = mp3Data.buffer.slice(
      mp3Data.byteOffset,
      mp3Data.byteOffset + mp3Data.byteLength
    );

    // Send to backend via Socket.IO
    this.socket.emit('stream:audio-data', buffer);
  }

  /**
   * Convert Float32 audio to 16-bit PCM
   */
  private floatTo16BitPCM(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
  }

  /**
   * Get current stream status
   */
  getStatus(): StreamStatus {
    return {
      connected: this.isConnected,
      streaming: this.isStreaming,
      bytesStreamed: this.bytesStreamed,
      duration: this.isStreaming ? Date.now() - this.startTime : 0
    };
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    this.mp3Encoder = null;
  }

  /**
   * Destroy encoder
   */
  async destroy(): Promise<void> {
    await this.stopStreaming();
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
    }
    
    this.audioContext = null;
    this.config = null;
  }
}

