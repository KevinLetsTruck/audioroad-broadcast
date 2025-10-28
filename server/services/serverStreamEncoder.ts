/**
 * Server-Side Stream Encoder
 * 
 * Handles MP3 encoding on the server and streaming to Radio.co
 * This avoids browser bundling issues with lamejs
 */

// @ts-ignore - lamejs doesn't have types but works perfectly in Node.js
import lamejs from 'lamejs';
import { EventEmitter } from 'events';
import net from 'net';

export interface StreamConfig {
  serverUrl: string;
  port: number;
  password: string;
  streamName?: string;
  genre?: string;
  url?: string;
  bitrate: number;
}

export class ServerStreamEncoder extends EventEmitter {
  private config: StreamConfig | null = null;
  private mp3Encoder: any = null;
  private socket: net.Socket | null = null;
  private isConnected = false;
  private isStreaming = false;
  private bytesStreamed = 0;
  private sampleRate = 48000; // Match browser audio context
  private channels = 2;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  /**
   * Initialize with Radio.co configuration
   */
  async initialize(config: StreamConfig): Promise<void> {
    this.config = config;
    
    console.log('🎙️ [SERVER STREAM] Initializing MP3 encoder...');
    console.log('   Sample rate:', this.sampleRate);
    console.log('   Channels:', this.channels);
    console.log('   Bitrate:', config.bitrate);

    try {
      // Initialize MP3 encoder (works perfectly in Node.js!)
      this.mp3Encoder = new lamejs.Mp3Encoder(this.channels, this.sampleRate, config.bitrate);
      console.log('✅ [SERVER STREAM] MP3 Encoder initialized');
      
      // Connect to Radio.co
      await this.connectToRadioCo();
      
    } catch (error) {
      console.error('❌ [SERVER STREAM] Initialization failed:', error);
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

    const config = this.config; // Type narrowing

    return new Promise((resolve, reject) => {
      console.log(`📡 [SERVER STREAM] Connecting to ${config.serverUrl}:${config.port}`);

      this.socket = new net.Socket();

      this.socket.on('connect', () => {
        console.log('🔌 [SERVER STREAM] TCP connected, sending handshake...');
        this.sendShoutcastHandshake();
      });

      this.socket.on('data', (data) => {
        const response = data.toString();
        console.log('📥 [SERVER STREAM] Radio.co response:', response.substring(0, 100));

        if (response.includes('ICY 200 OK') || response.includes('HTTP/1.0 200 OK')) {
          console.log('✅ [SERVER STREAM] Connected to Radio.co!');
          this.isConnected = true;
          this.isStreaming = true;
          this.reconnectAttempts = 0;
          this.emit('connected');
          resolve();
        } else if (response.includes('Invalid password') || response.includes('401')) {
          const error = new Error('Invalid Radio.co password');
          console.error('❌ [SERVER STREAM]', error.message);
          this.emit('error', error);
          reject(error);
        } else if (!this.isConnected) {
          const error = new Error('Unexpected Radio.co response: ' + response);
          console.error('❌ [SERVER STREAM]', error.message);
          this.emit('error', error);
          reject(error);
        }
      });

      this.socket.on('error', (error) => {
        console.error('❌ [SERVER STREAM] Socket error:', error);
        this.emit('error', error);
        
        if (!this.isConnected) {
          reject(error);
        }
      });

      this.socket.on('close', () => {
        console.log('📴 [SERVER STREAM] Connection closed');
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

    const config = this.config; // Type narrowing for TypeScript

    const handshake = [
      `SOURCE /${config.password} ICE/1.0`,
      `Host: ${config.serverUrl}:${config.port}`,
      `User-Agent: AudioRoad-Broadcast-Server/1.0`,
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

    console.log('📤 [SERVER STREAM] Sending Shoutcast handshake...');
    this.socket.write(handshake);
  }

  /**
   * Process audio chunk from browser
   * @param audioData - Float32Array PCM data from browser
   */
  processAudioChunk(audioData: Float32Array): void {
    if (!this.isStreaming || !this.mp3Encoder || !this.socket) {
      return;
    }

    try {
      // Convert Float32 to Int16 PCM
      const pcmData = this.floatTo16BitPCM(audioData);
      
      // For stereo, split into left and right channels
      const leftChannel = new Int16Array(pcmData.length / 2);
      const rightChannel = new Int16Array(pcmData.length / 2);
      
      for (let i = 0; i < pcmData.length / 2; i++) {
        leftChannel[i] = pcmData[i * 2];
        rightChannel[i] = pcmData[i * 2 + 1];
      }

      // Encode to MP3
      const mp3buf = this.mp3Encoder.encodeBuffer(leftChannel, rightChannel);

      if (mp3buf.length > 0) {
        // Send to Radio.co
        this.socket.write(Buffer.from(mp3buf));
        this.bytesStreamed += mp3buf.length;
        this.emit('data-sent', mp3buf.length);
      }
    } catch (error) {
      console.error('❌ [SERVER STREAM] Error processing audio:', error);
      this.emit('error', error);
    }
  }

  /**
   * Convert Float32 PCM to Int16 PCM
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
   * Stop streaming and disconnect
   */
  async stop(): Promise<void> {
    console.log('📴 [SERVER STREAM] Stopping stream...');
    
    try {
      // Flush remaining MP3 data
      if (this.mp3Encoder && this.socket && this.isStreaming) {
        const mp3buf = this.mp3Encoder.flush();
        if (mp3buf.length > 0) {
          this.socket.write(Buffer.from(mp3buf));
        }
      }
    } catch (error) {
      console.error('⚠️ [SERVER STREAM] Error flushing encoder:', error);
    }

    this.isStreaming = false;
    this.isConnected = false;

    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }

    this.mp3Encoder = null;
    this.emit('stopped');
    
    console.log('✅ [SERVER STREAM] Stream stopped');
  }

  /**
   * Get current stream status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      streaming: this.isStreaming,
      bytesStreamed: this.bytesStreamed,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

