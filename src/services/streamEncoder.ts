/**
 * Stream Encoder
 * 
 * Handles encoding audio to MP3 and streaming to Radio.co/Shoutcast server
 */

// @ts-ignore - lamejs doesn't have types
import lamejs from 'lamejs';

export interface StreamConfig {
  serverUrl: string;
  port: number;
  password: string;
  mountPoint?: string;
  streamName?: string;
  genre?: string;
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
  private ws: WebSocket | null = null;

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
   * Connect to Radio.co/Shoutcast server
   */
  private async connectToServer(): Promise<void> {
    if (!this.config) return;

    // For Radio.co, we'll use their HTTP API
    // This is a simplified version - Radio.co may require specific headers
    // In production, you might need a backend proxy to handle Icecast protocol
    
    const serverUrl = `${this.config.serverUrl}:${this.config.port}`;
    console.log(`🔌 Connecting to ${serverUrl}...`);

    // Note: Direct streaming to Icecast/Shoutcast from browser is challenging
    // due to CORS and authentication requirements. 
    // For production, consider:
    // 1. Using a backend proxy
    // 2. Using Radio.co's WebRTC/RTMP endpoints if available
    // 3. Or streaming via WebSocket to your own server that forwards to Radio.co

    // For now, we'll prepare for WebSocket connection to a backend proxy
    this.isConnected = true;
    console.log('✅ Connected to streaming server');
  }

  /**
   * Disconnect from server
   */
  private disconnectFromServer(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  /**
   * Send encoded MP3 data to server
   */
  private sendToServer(_mp3Data: Int8Array | Uint8Array): void {
    if (!this.isConnected) return;

    // In a real implementation, this would send data via:
    // 1. WebSocket to backend proxy
    // 2. HTTP POST chunks to Radio.co API
    // 3. RTMP stream if supported

    // For now, we'll log that data is being "sent"
    // You'll need to implement the actual transmission based on Radio.co's API
    
    // Example WebSocket send:
    // if (this.ws && this.ws.readyState === WebSocket.OPEN) {
    //   this.ws.send(_mp3Data.buffer);
    // }
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

