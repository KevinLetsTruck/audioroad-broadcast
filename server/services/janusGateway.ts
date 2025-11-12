/**
 * Janus Gateway Client
 * Connects to Janus WebRTC server for managing audio rooms
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';

interface JanusMessage {
  janus: string;
  transaction?: string;
  session_id?: number;
  handle_id?: number;
  [key: string]: any;
}

export class JanusGateway extends EventEmitter {
  private ws: WebSocket | null = null;
  private serverUrl: string;
  private sessionId: number | null = null;
  private handles: Map<number, any> = new Map();
  private transactions: Map<string, { resolve: Function; reject: Function }> = new Map();
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(serverUrl: string) {
    super();
    this.serverUrl = serverUrl;
  }

  /**
   * Connect to Janus Gateway
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('📡 [JANUS] Connecting to Janus Gateway:', this.serverUrl);

      this.ws = new WebSocket(this.serverUrl);

      this.ws.on('open', async () => {
        console.log('✅ [JANUS] WebSocket connected');
        try {
          await this.createSession();
          this.startKeepAlive();
          this.reconnectAttempts = 0;
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message: JanusMessage = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          console.error('❌ [JANUS] Failed to parse message:', error);
        }
      });

      this.ws.on('error', (error) => {
        console.error('❌ [JANUS] WebSocket error:', error);
        this.emit('error', error);
      });

      this.ws.on('close', () => {
        console.log('📴 [JANUS] WebSocket closed');
        this.stopKeepAlive();
        this.attemptReconnect();
      });

      setTimeout(() => {
        if (!this.sessionId) {
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Create Janus session
   */
  private async createSession(): Promise<void> {
    const response = await this.sendRequest({
      janus: 'create',
      transaction: this.generateTransactionId()
    });

    if (response.janus === 'success' && response.data?.id) {
      this.sessionId = response.data.id;
      console.log('✅ [JANUS] Session created:', this.sessionId);
    } else {
      throw new Error('Failed to create session');
    }
  }

  /**
   * Attach to VideoRoom plugin
   */
  async attachToVideoRoom(): Promise<number> {
    if (!this.sessionId) {
      throw new Error('No active session');
    }

    const response = await this.sendRequest({
      janus: 'attach',
      session_id: this.sessionId,
      plugin: 'janus.plugin.videoroom',
      transaction: this.generateTransactionId()
    });

    if (response.janus === 'success' && response.data?.id) {
      const handleId = response.data.id;
      this.handles.set(handleId, { type: 'videoroom' });
      console.log('✅ [JANUS] Attached to VideoRoom plugin:', handleId);
      return handleId;
    }

    throw new Error('Failed to attach to VideoRoom plugin');
  }

  /**
   * Create an audio room
   */
  async createRoom(roomId: string, description: string): Promise<void> {
    const handleId = await this.attachToVideoRoom();

    const response = await this.sendRequest({
      janus: 'message',
      session_id: this.sessionId!,
      handle_id: handleId,
      transaction: this.generateTransactionId(),
      body: {
        request: 'create',
        room: roomId,
        description: description,
        publishers: 50, // Max participants
        audiocodec: 'opus',
        audiolevel_event: true,
        audio_active_packets: 50,
        record: false, // We handle recording separately
        is_private: false
      }
    });

    if (response.plugindata?.data?.videoroom === 'created') {
      console.log(`✅ [JANUS] Room created: ${roomId}`);
    } else {
      throw new Error(`Failed to create room: ${roomId}`);
    }
  }

  /**
   * Join a room as publisher (send + receive audio)
   */
  async joinRoomAsPublisher(
    roomId: string,
    participantId: string,
    displayName: string
  ): Promise<{ handleId: number; jsep?: any }> {
    const handleId = await this.attachToVideoRoom();

    const response = await this.sendRequest({
      janus: 'message',
      session_id: this.sessionId!,
      handle_id: handleId,
      transaction: this.generateTransactionId(),
      body: {
        request: 'join',
        room: roomId,
        ptype: 'publisher',
        id: participantId,
        display: displayName
      }
    });

    console.log(`✅ [JANUS] Joined room ${roomId} as publisher:`, participantId);
    return { handleId, jsep: response.jsep };
  }

  /**
   * Join a room as subscriber (receive only)
   */
  async joinRoomAsSubscriber(
    roomId: string,
    participantId: string,
    feed: number
  ): Promise<{ handleId: number; jsep?: any }> {
    const handleId = await this.attachToVideoRoom();

    const response = await this.sendRequest({
      janus: 'message',
      session_id: this.sessionId!,
      handle_id: handleId,
      transaction: this.generateTransactionId(),
      body: {
        request: 'join',
        room: roomId,
        ptype: 'subscriber',
        feed: feed
      }
    });

    console.log(`✅ [JANUS] Joined room ${roomId} as subscriber:`, participantId);
    return { handleId, jsep: response.jsep };
  }

  /**
   * Leave a room
   */
  async leaveRoom(handleId: number): Promise<void> {
    await this.sendRequest({
      janus: 'message',
      session_id: this.sessionId!,
      handle_id: handleId,
      transaction: this.generateTransactionId(),
      body: {
        request: 'leave'
      }
    });

    this.handles.delete(handleId);
    console.log('✅ [JANUS] Left room, handle:', handleId);
  }

  /**
   * Send request and wait for response
   */
  private sendRequest(message: JanusMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error('WebSocket not connected'));
      }

      const transaction = message.transaction || this.generateTransactionId();
      message.transaction = transaction;

      this.transactions.set(transaction, { resolve, reject });

      this.ws.send(JSON.stringify(message));

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.transactions.has(transaction)) {
          this.transactions.delete(transaction);
          reject(new Error('Request timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Handle incoming messages from Janus
   */
  private handleMessage(message: JanusMessage): void {
    // Handle transaction responses
    if (message.transaction && this.transactions.has(message.transaction)) {
      const { resolve } = this.transactions.get(message.transaction)!;
      this.transactions.delete(message.transaction);
      resolve(message);
      return;
    }

    // Handle events
    switch (message.janus) {
      case 'event':
        this.emit('event', message);
        break;
      case 'webrtcup':
        this.emit('webrtcup', message);
        break;
      case 'media':
        this.emit('media', message);
        break;
      case 'hangup':
        this.emit('hangup', message);
        break;
      case 'detached':
        this.emit('detached', message);
        break;
    }
  }

  /**
   * Keep-alive pings
   */
  private startKeepAlive(): void {
    this.keepAliveInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN && this.sessionId) {
        this.ws.send(JSON.stringify({
          janus: 'keepalive',
          session_id: this.sessionId,
          transaction: this.generateTransactionId()
        }));
      }
    }, 30000); // Every 30 seconds
  }

  private stopKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  /**
   * Reconnect on disconnect
   */
  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ [JANUS] Max reconnection attempts reached');
      this.emit('connection-failed');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    console.log(`🔄 [JANUS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(async () => {
      try {
        await this.connect();
        this.emit('reconnected');
      } catch (error) {
        console.error('❌ [JANUS] Reconnection failed:', error);
      }
    }, delay);
  }

  /**
   * Generate unique transaction ID
   */
  private generateTransactionId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  /**
   * Disconnect from Janus
   */
  async disconnect(): Promise<void> {
    this.stopKeepAlive();

    if (this.sessionId && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        await this.sendRequest({
          janus: 'destroy',
          session_id: this.sessionId,
          transaction: this.generateTransactionId()
        });
      } catch (error) {
        console.error('❌ [JANUS] Error destroying session:', error);
      }
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.sessionId = null;
    this.handles.clear();
    this.transactions.clear();

    console.log('✅ [JANUS] Disconnected');
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.ws !== null && 
           this.ws.readyState === WebSocket.OPEN && 
           this.sessionId !== null;
  }
}

export default JanusGateway;

