/**
 * Stream Encoder (Client-Side)
 * 
 * Captures raw audio and sends to server for MP3 encoding and Radio.co streaming
 * Server-side encoding is more reliable than browser-side lamejs
 */

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
  mode?: 'radio.co' | 'hls' | 'both';  // Streaming destination
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

      // Create audio processing chain (NO MP3 encoding in browser!)
      // Server will handle MP3 encoding - much more reliable
      console.log('🎵 [CLIENT STREAM] Audio context sample rate:', this.audioContext.sampleRate);
      this.sourceNode = this.audioContext.createMediaStreamSource(stream);
      
      // Use ScriptProcessorNode for audio processing
      // Note: This is deprecated but AudioWorklet requires separate files
      // For a production app, migrate to AudioWorklet
      const bufferSize = 4096;
      const channels = 2;
      this.processorNode = this.audioContext.createScriptProcessor(
        bufferSize,
        channels,
        channels
      );

      // Process audio and send RAW PCM to server (server will encode to MP3)
      this.processorNode.onaudioprocess = (event) => {
        if (!this.isStreaming) return;

        // Get left and right channels as Float32Array
        const left = event.inputBuffer.getChannelData(0);
        const right = event.inputBuffer.getChannelData(1);

        // Interleave stereo channels into single Float32Array
        const interleaved = new Float32Array(left.length * 2);
        for (let i = 0; i < left.length; i++) {
          interleaved[i * 2] = left[i];
          interleaved[i * 2 + 1] = right[i];
        }

        // Send raw PCM to server (server handles MP3 encoding)
        this.sendToServer(interleaved);
        this.bytesStreamed += interleaved.byteLength;
      };

      // Connect nodes
      this.sourceNode.connect(this.processorNode);
      this.processorNode.connect(this.audioContext.destination);

      // Connect to server (server will handle MP3 encoding and Radio.co connection)
      await this.connectToServer();

      this.isStreaming = true;
      this.startTime = Date.now();
      console.log('🚀 [CLIENT STREAM] Streaming started - sending raw PCM to server');

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
      console.log('⏹️ [CLIENT STREAM] Stopping audio capture...');

      // Disconnect from server
      this.disconnectFromServer();

      this.cleanup();
      this.isStreaming = false;
      console.log('✅ [CLIENT STREAM] Streaming stopped');

    } catch (error) {
      console.error('Error stopping stream:', error);
      this.cleanup();
    }
  }

  /**
   * Connect to backend WebSocket (server will connect to Radio.co)
   */
  private async connectToServer(): Promise<void> {
    if (!this.config) return;

    return new Promise((resolve, reject) => {
      console.log(`🔌 [CLIENT STREAM] Connecting to backend server...`);

      // Connect to our backend Socket.IO server
      this.socket = io();

      this.socket.on('connect', () => {
        console.log('✅ [CLIENT STREAM] Connected to backend');

        // Request server to start streaming to Radio.co (with FFmpeg MP3 encoding)
        this.socket!.emit('stream:start', this.config, (response: any) => {
          if (response.success) {
            console.log('✅ [CLIENT STREAM] Server connected to Radio.co with FFmpeg encoding!');
            this.isConnected = true;
            resolve();
          } else {
            console.error('❌ [CLIENT STREAM] Server failed to connect to Radio.co:', response.error);
            this.isConnected = false;
            reject(new Error(response.error));
          }
        });
      });

      this.socket.on('stream:connected', () => {
        console.log('🎙️ [CLIENT STREAM] Radio.co stream active (FFmpeg encoding)');
        this.isConnected = true;
      });

      this.socket.on('stream:disconnected', () => {
        console.warn('⚠️ [CLIENT STREAM] Disconnected from Radio.co');
        this.isConnected = false;
      });

      this.socket.on('stream:error', (error: any) => {
        console.error('❌ [CLIENT STREAM] Stream error:', error.message);
        this.isConnected = false;
      });

      this.socket.on('disconnect', () => {
        console.warn('⚠️ [CLIENT STREAM] Backend connection lost');
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
   * Send raw PCM audio data to backend for server-side encoding
   */
  private sendToServer(pcmData: Float32Array): void {
    if (!this.isConnected || !this.socket) return;

    // Send Float32Array directly - Socket.IO handles binary data natively
    // Use the typed array directly (not .buffer) for proper serialization
    this.socket.emit('stream:audio-data', pcmData);
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

