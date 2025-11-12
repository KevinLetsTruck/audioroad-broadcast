/**
 * Janus WebRTC Client (Browser)
 * Connects browser to Janus Gateway for WebRTC audio rooms
 */

interface JanusMessage {
  janus: string;
  transaction?: string;
  session_id?: number;
  handle_id?: number;
  jsep?: RTCSessionDescriptionInit;
  [key: string]: any;
}

interface JanusConnectionConfig {
  serverUrl: string;
  iceServers?: RTCIceServer[];
}

export class JanusClient {
  private ws: WebSocket | null = null;
  private serverUrl: string;
  private sessionId: number | null = null;
  private handleId: number | null = null;
  private pc: RTCPeerConnection | null = null;
  private iceServers: RTCIceServer[];
  
  private transactions = new Map<string, {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
  }>();

  private eventCallbacks = new Map<string, Function>();
  
  private keepAliveInterval: number | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(config: JanusConnectionConfig) {
    this.serverUrl = config.serverUrl;
    this.iceServers = config.iceServers || [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' }
    ];
  }

  /**
   * Connect to Janus Gateway
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('📡 [JANUS-CLIENT] Connecting to:', this.serverUrl);

      this.ws = new WebSocket(this.serverUrl);

      this.ws.onopen = async () => {
        console.log('✅ [JANUS-CLIENT] WebSocket connected');
        try {
          await this.createSession();
          await this.attachToVideoRoom();
          this.startKeepAlive();
          resolve();
        } catch (error) {
          reject(error);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message: JanusMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('❌ [JANUS-CLIENT] Failed to parse message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ [JANUS-CLIENT] WebSocket error:', error);
        reject(error);
      };

      this.ws.onclose = () => {
        console.log('📴 [JANUS-CLIENT] WebSocket closed');
        this.stopKeepAlive();
        this.attemptReconnect();
      };

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
      console.log('✅ [JANUS-CLIENT] Session created:', this.sessionId);
    } else {
      throw new Error('Failed to create session');
    }
  }

  /**
   * Attach to VideoRoom plugin
   */
  private async attachToVideoRoom(): Promise<void> {
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
      this.handleId = response.data.id;
      console.log('✅ [JANUS-CLIENT] Attached to VideoRoom:', this.handleId);
    } else {
      throw new Error('Failed to attach to VideoRoom plugin');
    }
  }

  /**
   * Join a room as publisher (send + receive audio)
   */
  async joinRoom(
    roomId: string,
    displayName: string,
    audioStream: MediaStream
  ): Promise<void> {
    if (!this.sessionId || !this.handleId) {
      throw new Error('Not connected to Janus');
    }

    console.log(`🔌 [JANUS-CLIENT] Joining room: ${roomId} as ${displayName}`);

    // Create peer connection
    this.pc = new RTCPeerConnection({ iceServers: this.iceServers });

    // Add audio track
    audioStream.getTracks().forEach(track => {
      this.pc!.addTrack(track, audioStream);
      console.log('🎤 [JANUS-CLIENT] Added audio track to peer connection');
    });

    // Handle ICE candidates
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 [JANUS-CLIENT] New ICE candidate');
        // Janus handles ICE via trickle
        this.sendRequest({
          janus: 'trickle',
          session_id: this.sessionId!,
          handle_id: this.handleId!,
          transaction: this.generateTransactionId(),
          candidate: event.candidate
        }).catch(error => {
          console.error('❌ [JANUS-CLIENT] Failed to send ICE candidate:', error);
        });
      } else {
        console.log('✅ [JANUS-CLIENT] ICE gathering complete');
      }
    };

    // Handle incoming tracks (from other participants)
    this.pc.ontrack = (event) => {
      console.log('📥 [JANUS-CLIENT] Received remote track:', event.track.kind);
      this.emit('track', event.streams[0]);
    };

    // Create offer
    const offer = await this.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false
    });

    await this.pc.setLocalDescription(offer);

    // Join room via Janus
    const response = await this.sendRequest({
      janus: 'message',
      session_id: this.sessionId,
      handle_id: this.handleId,
      transaction: this.generateTransactionId(),
      body: {
        request: 'join',
        room: roomId,
        ptype: 'publisher',
        display: displayName
      },
      jsep: {
        type: offer.type,
        sdp: offer.sdp
      }
    });

    // Handle Janus answer
    if (response.jsep) {
      await this.pc.setRemoteDescription(
        new RTCSessionDescription(response.jsep)
      );
      console.log('✅ [JANUS-CLIENT] Joined room:', roomId);
    }
  }

  /**
   * Leave current room
   */
  async leaveRoom(): Promise<void> {
    if (!this.handleId) {
      return;
    }

    await this.sendRequest({
      janus: 'message',
      session_id: this.sessionId!,
      handle_id: this.handleId,
      transaction: this.generateTransactionId(),
      body: {
        request: 'leave'
      }
    });

    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    console.log('✅ [JANUS-CLIENT] Left room');
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
   * Handle incoming messages
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
        console.log('✅ [JANUS-CLIENT] WebRTC connection established');
        this.emit('webrtcup');
        break;
      case 'media':
        this.emit('media', message);
        break;
      case 'hangup':
        console.log('📴 [JANUS-CLIENT] Hangup received');
        this.emit('hangup');
        break;
    }
  }

  /**
   * Keep-alive pings
   */
  private startKeepAlive(): void {
    this.keepAliveInterval = window.setInterval(() => {
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
      console.error('❌ [JANUS-CLIENT] Max reconnection attempts reached');
      this.emit('connection-failed');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    console.log(
      `🔄 [JANUS-CLIENT] Reconnecting in ${delay}ms ` +
      `(attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    setTimeout(async () => {
      try {
        await this.connect();
        this.emit('reconnected');
      } catch (error) {
        console.error('❌ [JANUS-CLIENT] Reconnection failed:', error);
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
   * Event emitter
   */
  on(event: string, callback: Function): void {
    this.eventCallbacks.set(event, callback);
  }

  private emit(event: string, data?: any): void {
    const callback = this.eventCallbacks.get(event);
    if (callback) {
      callback(data);
    }
  }

  /**
   * Disconnect from Janus
   */
  async disconnect(): Promise<void> {
    this.stopKeepAlive();

    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    if (this.sessionId && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        await this.sendRequest({
          janus: 'destroy',
          session_id: this.sessionId,
          transaction: this.generateTransactionId()
        });
      } catch (error) {
        console.error('❌ [JANUS-CLIENT] Error destroying session:', error);
      }
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.sessionId = null;
    this.handleId = null;

    console.log('✅ [JANUS-CLIENT] Disconnected');
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return (
      this.ws !== null &&
      this.ws.readyState === WebSocket.OPEN &&
      this.sessionId !== null &&
      this.handleId !== null
    );
  }

  /**
   * Get peer connection stats
   */
  async getStats(): Promise<RTCStatsReport | null> {
    if (!this.pc) {
      return null;
    }
    return await this.pc.getStats();
  }
}

export default JanusClient;

