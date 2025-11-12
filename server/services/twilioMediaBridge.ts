/**
 * Twilio Media Stream Bridge
 * Bridges phone calls (PSTN) to WebRTC audio rooms via Twilio Media Streams
 * 
 * Flow:
 * Phone Call → Twilio → Media Stream (WebSocket) → Convert to RTP → Janus → WebRTC
 * WebRTC → Janus → Convert to muLaw → Media Stream → Twilio → Phone Call
 */

import { EventEmitter } from 'events';
import LiveKitRoomManager from './livekitRoomManager.js';
import * as alawmulaw from 'alawmulaw';
import RTPHandler, { RTP_PAYLOAD_TYPES } from './rtpHandler.js';
import JitterBuffer from './jitterBuffer.js';

const MuLawEncoder = alawmulaw.mulaw.encode;
const MuLawDecoder = alawmulaw.mulaw.decode;

// Audio constants
const SAMPLE_RATE = 8000; // Twilio uses 8kHz
const BYTES_PER_SAMPLE = 1; // muLaw is 8-bit
const FRAME_SIZE = 160; // 20ms at 8kHz (8000 * 0.02)

interface MediaStreamConnection {
  callSid: string;
  streamSid: string;
  roomId: string;
  participantId: string;
  ws: any; // WebSocket from Twilio
  audioBuffer: Buffer[];
  rtpHandler: RTPHandler;
  jitterBuffer: JitterBuffer;
  playbackInterval: NodeJS.Timeout | null;
  stats: {
    packetsReceived: number;
    packetsSent: number;
    bytesReceived: number;
    bytesSent: number;
    startTime: number;
  };
}

export class TwilioMediaBridge extends EventEmitter {
  private roomManager: LiveKitRoomManager;
  private activeStreams: Map<string, MediaStreamConnection> = new Map();

  constructor(roomManager: LiveKitRoomManager) {
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
      audioBuffer: [],
      rtpHandler: new RTPHandler(
        undefined, // Auto-generate SSRC
        RTP_PAYLOAD_TYPES.PCMU, // muLaw
        SAMPLE_RATE,
        FRAME_SIZE
      ),
      jitterBuffer: new JitterBuffer(
        3,  // Min 3 packets (60ms)
        20, // Max 20 packets (400ms)
        5   // Target 5 packets (100ms)
      ),
      playbackInterval: null,
      stats: {
        packetsReceived: 0,
        packetsSent: 0,
        bytesReceived: 0,
        bytesSent: 0,
        startTime: Date.now()
      }
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
            
            // Start playback loop (pulls from jitter buffer)
            this.startPlaybackLoop(connection);
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
   * Convert from muLaw to PCM, package as RTP, add to jitter buffer
   */
  private async handleIncomingAudio(
    connection: MediaStreamConnection,
    payload: string
  ): Promise<void> {
    try {
      // Decode base64 to get muLaw encoded audio
      const muLawData = Buffer.from(payload, 'base64');
      
      // Update statistics
      connection.stats.packetsReceived++;
      connection.stats.bytesReceived += muLawData.length;
      
      // Convert muLaw (8-bit) to PCM (16-bit signed)
      const pcmData = Buffer.from(MuLawDecoder(muLawData));
      
      // Create RTP packet
      const rtpPacket = connection.rtpHandler.createPacket(pcmData);
      
      // Add to jitter buffer for smooth playback
      connection.jitterBuffer.push(rtpPacket);
      
      // Log stats periodically
      if (connection.stats.packetsReceived % 100 === 0) {
        const jitterStats = connection.jitterBuffer.getStats();
        const duration = (Date.now() - connection.stats.startTime) / 1000;
        console.log(`📊 [MEDIA-BRIDGE] ${connection.callSid} - ${duration.toFixed(1)}s`);
        console.log(`   Packets: ${connection.stats.packetsReceived} received, ${jitterStats.packetsPlayed} played`);
        console.log(`   Jitter: ${jitterStats.averageJitter.toFixed(2)}ms avg, buffer: ${jitterStats.currentDepth}/${jitterStats.targetDepth}`);
        console.log(`   Loss: ${jitterStats.packetsLate} late, ${jitterStats.packetsDropped} dropped`);
      }
      
    } catch (error) {
      console.error('❌ [MEDIA-BRIDGE] Error processing audio:', error);
    }
  }

  /**
   * Start playback loop
   * Pulls packets from jitter buffer at regular intervals
   */
  private startPlaybackLoop(connection: MediaStreamConnection): void {
    if (connection.playbackInterval) {
      return; // Already running
    }

    console.log(`▶️ [MEDIA-BRIDGE] Starting playback loop for ${connection.callSid}`);

    // Play one packet every 20ms (matching Twilio's packet rate)
    connection.playbackInterval = setInterval(() => {
      try {
        const packet = connection.jitterBuffer.pop();
        
        if (packet) {
          // Emit audio to Janus for forwarding to WebRTC participants
          this.emit('audio-from-phone', {
            participantId: connection.participantId,
            roomId: connection.roomId,
            audioData: packet.payload,
            sampleRate: SAMPLE_RATE,
            timestamp: packet.timestamp
          });
        }
      } catch (error) {
        console.error('❌ [MEDIA-BRIDGE] Playback error:', error);
      }
    }, 20); // 20ms interval (50 packets/second)
  }

  /**
   * Stop playback loop
   */
  private stopPlaybackLoop(connection: MediaStreamConnection): void {
    if (connection.playbackInterval) {
      clearInterval(connection.playbackInterval);
      connection.playbackInterval = null;
      console.log(`⏹️ [MEDIA-BRIDGE] Stopped playback loop for ${connection.callSid}`);
    }
  }

  /**
   * Send outgoing audio to phone call
   * Convert from PCM to muLaw for Twilio
   */
  sendAudioToPhone(callSid: string, pcmAudioData: Buffer): void {
    const connection = this.activeStreams.get(callSid);
    
    if (!connection || !connection.ws) {
      return;
    }

    try {
      // Convert PCM (16-bit signed) to muLaw (8-bit)
      // First convert Buffer to Int16Array for the encoder
      const pcmInt16 = new Int16Array(
        pcmAudioData.buffer,
        pcmAudioData.byteOffset,
        pcmAudioData.length / 2
      );
      const muLawArray = MuLawEncoder(pcmInt16);
      const muLawData = Buffer.from(muLawArray);
      
      // Encode to base64 for Twilio
      const payload = muLawData.toString('base64');
      
      // Send to Twilio Media Stream
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
      // Stop playback loop
      this.stopPlaybackLoop(connection);
      
      // Log final statistics
      const duration = (Date.now() - connection.stats.startTime) / 1000;
      const jitterStats = connection.jitterBuffer.getStats();
      console.log(`📊 [MEDIA-BRIDGE] Final stats for ${callSid} (${duration.toFixed(1)}s):`);
      console.log(`   Packets: ${connection.stats.packetsReceived} received, ${jitterStats.packetsPlayed} played`);
      console.log(`   Bytes: ${connection.stats.bytesReceived} received, ${connection.stats.bytesSent} sent`);
      console.log(`   Quality: ${jitterStats.packetsLate} late, ${jitterStats.packetsDropped} dropped, ${jitterStats.packetsDuplicate} duplicate`);
      console.log(`   Jitter: ${jitterStats.averageJitter.toFixed(2)}ms average`);
      
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

