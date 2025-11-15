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
import { createRequire } from 'module';
import RTPHandler, { RTP_PAYLOAD_TYPES } from './rtpHandler.js';
import JitterBuffer from './jitterBuffer.js';

// Use require for CommonJS module in ES module context
const require = createRequire(import.meta.url);
const alawmulaw = require('alawmulaw');

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

    // Add participant to WebRTC room immediately
    await this.roomManager.addParticipant(
      participantId,
      roomId,
      displayName,
      true // As publisher
    );
    
    // Start playback loop immediately (pulls from jitter buffer)
    this.startPlaybackLoop(connection);
    console.log(`▶️ [MEDIA-BRIDGE] Playback loop started, waiting for audio...`);

    // Handle incoming audio from phone call
    ws.on('message', async (message: string) => {
      try {
        const msg = JSON.parse(message);

        switch (msg.event) {
          case 'start':
            connection.streamSid = msg.streamSid;
            console.log(`▶️ [MEDIA-BRIDGE] Stream started: ${msg.streamSid}`);
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
      const duration = (Date.now() - connection.stats.startTime) / 1000;
      console.log(`📴 [MEDIA-BRIDGE] WebSocket closed for ${callSid} after ${duration.toFixed(1)}s`);
      
      // Alert if connection closed very quickly (indicates setup failure)
      if (duration < 5) {
        console.error(`⚠️ [MEDIA-BRIDGE] Connection closed after only ${duration.toFixed(1)}s!`);
        console.error(`   This usually indicates a setup error or Twilio rejecting the connection`);
        console.error(`   Packets received: ${connection.stats.packetsReceived}`);
      }
      
      await this.stopMediaStream(callSid);
    });

    ws.on('error', (error: Error) => {
      console.error(`❌ [MEDIA-BRIDGE] WebSocket error for ${callSid}:`, error);
      console.error(`   Error type: ${error.name}`);
      console.error(`   Error message: ${error.message}`);
      console.error(`   Connection age: ${((Date.now() - connection.stats.startTime) / 1000).toFixed(1)}s`);
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
      const pcmInt16Array = MuLawDecoder(muLawData); // Returns Int16Array
      
      // Log BEFORE conversion to verify muLaw decoder works
      if (connection.stats.packetsReceived === 1) {
        console.log(`🔊 [MEDIA-BRIDGE] First packet - muLaw decoding:`);
        console.log(`   muLaw input bytes: ${muLawData.length}`);
        console.log(`   First 10 muLaw bytes: [${Array.from(muLawData.slice(0, 10)).join(', ')}]`);
        console.log(`   PCM Int16 output samples: ${pcmInt16Array.length}`);
        console.log(`   First 10 Int16 values: [${Array.from(pcmInt16Array.slice(0, 10)).join(', ')}]`);
      }
      
      // Convert Int16Array to Buffer (2 bytes per sample, little-endian)
      const pcmData = Buffer.allocUnsafe(pcmInt16Array.length * 2);
      for (let i = 0; i < pcmInt16Array.length; i++) {
        pcmData.writeInt16LE(pcmInt16Array[i], i * 2);
      }
      
      // Log AFTER conversion to verify Buffer encoding
      if (connection.stats.packetsReceived === 1) {
        console.log(`🔊 [MEDIA-BRIDGE] First packet - PCM Buffer:`);
        console.log(`   PCM Buffer bytes: ${pcmData.length} (expected: ${pcmInt16Array.length * 2})`);
        console.log(`   First 20 PCM bytes: [${Array.from(pcmData.slice(0, 20)).join(', ')}]`);
        
        // Verify the buffer is actually written correctly
        const testRead = pcmData.readInt16LE(0);
        console.log(`   Test read first Int16: ${testRead} (should match ${pcmInt16Array[0]})`);
      }
      
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
      console.error('   Error type:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('   Error message:', error instanceof Error ? error.message : String(error));
      console.error('   Call SID:', connection?.callSid || 'unknown');
      console.error('   Payload length:', payload?.length || 0, 'chars');
      if (error instanceof Error && error.stack) {
        console.error('   Error stack:', error.stack);
      }
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
   * Convert from 48kHz PCM to 8kHz muLaw for Twilio
   */
  sendAudioToPhone(callSid: string, pcmAudioData: Buffer): void {
    const connection = this.activeStreams.get(callSid);
    
    if (!connection || !connection.ws) {
      return;
    }

    try {
      // Convert Buffer to Int16Array (48kHz PCM from browser)
      const pcmInt16_48k = new Int16Array(
        pcmAudioData.buffer,
        pcmAudioData.byteOffset,
        pcmAudioData.length / 2
      );
      
      // CRITICAL: Downsample from 48kHz to 8kHz (6:1 ratio)
      // Twilio MUST receive 8kHz audio or it will sound garbled
      const downsampleRatio = 6; // 48000 / 8000 = 6
      const numSamples8k = Math.floor(pcmInt16_48k.length / downsampleRatio);
      const pcmInt16_8k = new Int16Array(numSamples8k);
      
      for (let i = 0; i < numSamples8k; i++) {
        // Simple decimation: take every 6th sample
        pcmInt16_8k[i] = pcmInt16_48k[i * downsampleRatio];
      }
      
      // Log first outgoing packet to verify downsampling
      if (connection.stats.packetsSent === 0) {
        console.log(`🎤 [MEDIA-BRIDGE] First outgoing audio packet:`);
        console.log(`   Input: ${pcmInt16_48k.length} samples at 48kHz`);
        console.log(`   Output: ${pcmInt16_8k.length} samples at 8kHz (ratio: ${downsampleRatio})`);
        console.log(`   First 5 samples 48k: [${Array.from(pcmInt16_48k.slice(0, 5)).join(', ')}]`);
        console.log(`   First 5 samples 8k: [${Array.from(pcmInt16_8k.slice(0, 5)).join(', ')}]`);
      }
      
      // Now encode 8kHz PCM to 8kHz muLaw
      const muLawArray = MuLawEncoder(pcmInt16_8k);
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
      
      // Update stats
      connection.stats.packetsSent++;
      connection.stats.bytesSent += muLawData.length;
      
    } catch (error) {
      console.error('❌ [MEDIA-BRIDGE] Error sending audio:', error);
      console.error('   Error type:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('   Error message:', error instanceof Error ? error.message : String(error));
      console.error('   Call SID:', callSid);
      console.error('   Room ID:', connection?.roomId || 'unknown');
      console.error('   WebSocket state:', connection?.ws?.readyState || 'unknown');
      if (error instanceof Error && error.stack) {
        console.error('   Error stack:', error.stack);
      }
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

  /**
   * Find callSid for a given room (for forwarding browser audio to phone)
   */
  getCallSidForRoom(roomId: string): string | null {
    console.log(`🔍 [MEDIA-BRIDGE] Looking for call in room: ${roomId}`);
    console.log(`   Active streams: ${this.activeStreams.size}`);
    
    for (const [callSid, connection] of this.activeStreams.entries()) {
      console.log(`   Checking: ${callSid} in room ${connection.roomId}`);
      console.log(`   Match: ${connection.roomId === roomId}`);
      console.log(`   Comparison: "${connection.roomId}" === "${roomId}"`);
      
      if (connection.roomId === roomId) {
        console.log(`✅ [MEDIA-BRIDGE] Found call ${callSid} for room ${roomId}`);
        return callSid;
      }
    }
    
    // Only log if we have active streams but none match (indicates room mapping issue)
    if (this.activeStreams.size > 0) {
      console.error(`❌ [MEDIA-BRIDGE] Room mapping mismatch!`);
      console.error(`   Looking for: ${roomId}`);
      console.error(`   Active streams: ${this.activeStreams.size}`);
      for (const [callSid, connection] of this.activeStreams.entries()) {
        console.error(`   - ${callSid}: ${connection.roomId}`);
      }
    }
    
    return null;
  }

  /**
   * Get all active streams (for fallback audio routing)
   */
  getActiveStreams(): Map<string, MediaStreamConnection> {
    return this.activeStreams;
  }
}

export default TwilioMediaBridge;

