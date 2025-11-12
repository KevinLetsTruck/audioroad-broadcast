/**
 * Twilio Media Stream Bridge
 * Bridges phone calls (PSTN) to WebRTC audio rooms via Twilio Media Streams
 * 
 * Flow:
 * Phone Call → Twilio → Media Stream (WebSocket) → Convert to RTP → Janus → WebRTC
 * WebRTC → Janus → Convert to muLaw → Media Stream → Twilio → Phone Call
 */

import { EventEmitter } from 'events';
import WebRTCRoomManager from './webrtcRoomManager.js';

interface MediaStreamConnection {
  callSid: string;
  streamSid: string;
  roomId: string;
  participantId: string;
  ws: any; // WebSocket from Twilio
  audioBuffer: Buffer[];
}

export class TwilioMediaBridge extends EventEmitter {
  private roomManager: WebRTCRoomManager;
  private activeStreams: Map<string, MediaStreamConnection> = new Map();

  constructor(roomManager: WebRTCRoomManager) {
    super();
    this.roomManager = roomManager;
  }

  /**
   * Start media stream for a phone call
   * Called when Twilio sends Media Stream WebSocket connection
   */
  async startMediaStream(
    ws: any,
    callSid: string,
    roomId: string,
    participantId: string,
    displayName: string
  ): Promise<void> {
    console.log(`📞 [MEDIA-BRIDGE] Starting media stream for ${callSid} → ${roomId}`);

    const connection: MediaStreamConnection = {
      callSid,
      streamSid: '',
      roomId,
      participantId,
      ws,
      audioBuffer: []
    };

    this.activeStreams.set(callSid, connection);

    // Handle incoming audio from phone call
    ws.on('message', async (message: string) => {
      try {
        const msg = JSON.parse(message);

        switch (msg.event) {
          case 'start':
            connection.streamSid = msg.streamSid;
            console.log(`▶️ [MEDIA-BRIDGE] Stream started: ${msg.streamSid}`);
            
            // Add participant to WebRTC room
            await this.roomManager.addParticipant(
              participantId,
              roomId,
              displayName,
              true // As publisher
            );
            break;

          case 'media':
            // Incoming audio from phone (muLaw encoded, base64)
            await this.handleIncomingAudio(connection, msg.media.payload);
            break;

          case 'stop':
            console.log(`⏹️ [MEDIA-BRIDGE] Stream stopped: ${connection.streamSid}`);
            await this.stopMediaStream(callSid);
            break;
        }
      } catch (error) {
        console.error('❌ [MEDIA-BRIDGE] Error handling message:', error);
      }
    });

    ws.on('close', async () => {
      console.log(`📴 [MEDIA-BRIDGE] WebSocket closed for ${callSid}`);
      await this.stopMediaStream(callSid);
    });

    ws.on('error', (error: Error) => {
      console.error(`❌ [MEDIA-BRIDGE] WebSocket error for ${callSid}:`, error);
    });
  }

  /**
   * Handle incoming audio from phone call
   * Convert from muLaw to format Janus expects
   */
  private async handleIncomingAudio(
    connection: MediaStreamConnection,
    payload: string
  ): Promise<void> {
    try {
      // Decode base64
      const audioData = Buffer.from(payload, 'base64');
      
      // TODO: Convert muLaw to PCM
      // For now, buffer the audio
      connection.audioBuffer.push(audioData);
      
      // Send to Janus room (this will need RTP packaging)
      // This is a placeholder - full implementation needs RTP wrapper
      
    } catch (error) {
      console.error('❌ [MEDIA-BRIDGE] Error processing audio:', error);
    }
  }

  /**
   * Send outgoing audio to phone call
   * Convert from WebRTC to muLaw for Twilio
   */
  sendAudioToPhone(callSid: string, audioData: Buffer): void {
    const connection = this.activeStreams.get(callSid);
    
    if (!connection || !connection.ws) {
      return;
    }

    try {
      // TODO: Convert from PCM to muLaw
      // Encode to base64
      const payload = audioData.toString('base64');
      
      // Send to Twilio
      connection.ws.send(JSON.stringify({
        event: 'media',
        streamSid: connection.streamSid,
        media: {
          payload: payload
        }
      }));
      
    } catch (error) {
      console.error('❌ [MEDIA-BRIDGE] Error sending audio:', error);
    }
  }

  /**
   * Move participant's stream to different room
   */
  async moveStreamToRoom(
    callSid: string,
    newRoomId: string
  ): Promise<void> {
    const connection = this.activeStreams.get(callSid);
    
    if (!connection) {
      throw new Error(`No active stream for ${callSid}`);
    }

    console.log(`🔄 [MEDIA-BRIDGE] Moving stream from ${connection.roomId} to ${newRoomId}`);

    // Move in WebRTC room manager
    await this.roomManager.moveParticipant(
      connection.participantId,
      connection.roomId,
      newRoomId
    );

    connection.roomId = newRoomId;
    console.log(`✅ [MEDIA-BRIDGE] Stream moved to ${newRoomId}`);
  }

  /**
   * Stop media stream and remove from room
   */
  async stopMediaStream(callSid: string): Promise<void> {
    const connection = this.activeStreams.get(callSid);
    
    if (!connection) {
      return;
    }

    console.log(`📴 [MEDIA-BRIDGE] Stopping media stream for ${callSid}`);

    try {
      // Remove from WebRTC room
      await this.roomManager.removeParticipant(connection.participantId);
      
      // Close WebSocket if still open
      if (connection.ws && connection.ws.readyState === 1) {
        connection.ws.close();
      }
      
      this.activeStreams.delete(callSid);
      console.log(`✅ [MEDIA-BRIDGE] Media stream stopped: ${callSid}`);
      
    } catch (error) {
      console.error('❌ [MEDIA-BRIDGE] Error stopping stream:', error);
    }
  }

  /**
   * Get active streams count
   */
  getActiveStreamsCount(): number {
    return this.activeStreams.size;
  }

  /**
   * Get stream info
   */
  getStreamInfo(callSid: string): MediaStreamConnection | undefined {
    return this.activeStreams.get(callSid);
  }
}

export default TwilioMediaBridge;

