/**
 * Radio.co Streaming Service
 * 
 * Handles streaming MP3 audio to Radio.co's Shoutcast/Icecast server
 */

import net from 'net';
import { EventEmitter } from 'events';

export interface StreamConfig {
  serverUrl: string;
  port: number;
  password: string;
  streamName?: string;
  genre?: string;
  url?: string;
  bitrate: number;
}

export class RadioCoStreamService extends EventEmitter {
  private socket: net.Socket | null = null;
  private isConnected = false;
  private isStreaming = false;
  private config: StreamConfig | null = null;
  private bytesStreamed = 0;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimer: NodeJS.Timeout | null = null;

  /**
   * Connect to Radio.co Shoutcast server
   */
  async connect(config: StreamConfig): Promise<void> {
    this.config = config;

    return new Promise((resolve, reject) => {
      try {
        console.log(`📡 Connecting to Radio.co: ${config.serverUrl}:${config.port}`);

        this.socket = new net.Socket();

        // Set up socket event handlers
        this.socket.on('connect', () => {
          console.log('🔌 TCP connection established');
          this.sendShoutcastHandshake();
        });

        this.socket.on('data', (data) => {
          const response = data.toString();
          console.log('📥 Server response:', response);

          if (response.includes('ICY 200 OK') || response.includes('HTTP/1.0 200 OK')) {
            console.log('✅ Shoutcast handshake successful!');
            this.isConnected = true;
            this.isStreaming = true;
            this.reconnectAttempts = 0;
            this.emit('connected');
            resolve();
          } else if (response.includes('Invalid password') || response.includes('401')) {
            console.error('❌ Invalid password');
            this.emit('error', new Error('Invalid Radio.co password'));
            reject(new Error('Invalid password'));
          } else if (!this.isConnected) {
            console.error('❌ Unexpected response:', response);
            this.emit('error', new Error('Unexpected server response'));
            reject(new Error('Unexpected response'));
          }
        });

        this.socket.on('error', (error) => {
          console.error('❌ Socket error:', error);
          this.emit('error', error);
          
          if (!this.isConnected) {
            reject(error);
          } else {
            this.handleDisconnect();
          }
        });

        this.socket.on('close', () => {
          console.log('🔌 Connection closed');
          this.isConnected = false;
          this.isStreaming = false;
          this.emit('disconnected');
          
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        });

        // Connect to the server
        this.socket.connect(config.port, config.serverUrl);

      } catch (error) {
        console.error('❌ Connection error:', error);
        reject(error);
      }
    });
  }

  /**
   * Send Shoutcast/Icecast handshake
   */
  private sendShoutcastHandshake(): void {
    if (!this.socket || !this.config) return;

    const password = this.config.password;
    const streamName = this.config.streamName || 'AudioRoad Network LIVE';
    const genre = this.config.genre || 'Trucking';
    const url = this.config.url || 'http://audioroad.letstruck.com';
    const bitrate = this.config.bitrate || 256;

    // Shoutcast 1.x protocol (SOURCE)
    const handshake = [
      `SOURCE /${password} ICE/1.0`,
      `Host: ${this.config.serverUrl}:${this.config.port}`,
      `User-Agent: AudioRoad-Broadcast/1.0`,
      `Content-Type: audio/mpeg`,
      `ice-name: ${streamName}`,
      `ice-genre: ${genre}`,
      `ice-url: ${url}`,
      `ice-public: 1`,
      `ice-bitrate: ${bitrate}`,
      `ice-description: ${streamName}`,
      '',
      ''
    ].join('\r\n');

    console.log('📤 Sending handshake...');
    this.socket.write(handshake);
  }

  /**
   * Send audio data to Radio.co
   */
  sendAudioData(data: Buffer): boolean {
    if (!this.socket || !this.isConnected || !this.isStreaming) {
      console.warn('⚠️ Not connected to Radio.co');
      return false;
    }

    try {
      this.socket.write(data);
      this.bytesStreamed += data.length;
      this.emit('data-sent', data.length);
      return true;
    } catch (error) {
      console.error('❌ Error sending data:', error);
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Handle disconnection and attempt reconnect
   */
  private handleDisconnect(): void {
    console.log('🔄 Handling disconnect...');
    this.isConnected = false;
    this.isStreaming = false;

    if (this.reconnectAttempts < this.maxReconnectAttempts && this.config) {
      this.scheduleReconnect();
    } else {
      console.error('❌ Max reconnection attempts reached');
      this.emit('max-reconnects-reached');
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff, max 30s

    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.config) {
        this.connect(this.config).catch((error) => {
          console.error('❌ Reconnection failed:', error);
        });
      }
    }, delay);
  }

  /**
   * Disconnect from Radio.co
   */
  disconnect(): void {
    console.log('📴 Disconnecting from Radio.co');
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.isStreaming = false;
    this.isConnected = false;

    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }

    this.emit('disconnected');
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

  /**
   * Check if currently connected
   */
  isCurrentlyConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Check if currently streaming
   */
  isCurrentlyStreaming(): boolean {
    return this.isStreaming;
  }
}

