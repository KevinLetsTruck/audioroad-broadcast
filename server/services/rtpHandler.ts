/**
 * RTP Packet Handler
 * Handles Real-time Transport Protocol packets for WebRTC audio
 * 
 * RTP Packet Format (RFC 3550):
 * 0                   1                   2                   3
 * 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |V=2|P|X|  CC   |M|     PT      |       sequence number         |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                           timestamp                           |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |           synchronization source (SSRC) identifier            |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 * |                            payload                             |
 * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 */

export interface RTPPacket {
  version: number;          // Always 2
  padding: boolean;         // Padding flag
  extension: boolean;       // Extension flag
  csrcCount: number;        // CSRC count
  marker: boolean;          // Marker bit
  payloadType: number;      // Payload type (0 = PCMU, 8 = PCMA, 111 = Opus)
  sequenceNumber: number;   // Sequence number
  timestamp: number;        // Timestamp
  ssrc: number;             // Synchronization source
  payload: Buffer;          // Audio data
}

export class RTPHandler {
  private sequenceNumber: number = 0;
  private timestamp: number = 0;
  private ssrc: number;
  private payloadType: number;
  private sampleRate: number;
  private samplesPerPacket: number;

  constructor(
    ssrc?: number,
    payloadType: number = 0, // PCMU (G.711 μ-law)
    sampleRate: number = 8000,
    samplesPerPacket: number = 160 // 20ms at 8kHz
  ) {
    this.ssrc = ssrc || Math.floor(Math.random() * 0xFFFFFFFF);
    this.payloadType = payloadType;
    this.sampleRate = sampleRate;
    this.samplesPerPacket = samplesPerPacket;
    
    // Initialize with random values as per RFC 3550
    this.sequenceNumber = Math.floor(Math.random() * 0xFFFF);
    this.timestamp = Math.floor(Math.random() * 0xFFFFFFFF);
  }

  /**
   * Create RTP packet from audio payload
   */
  createPacket(payload: Buffer, marker: boolean = false): RTPPacket {
    const packet: RTPPacket = {
      version: 2,
      padding: false,
      extension: false,
      csrcCount: 0,
      marker,
      payloadType: this.payloadType,
      sequenceNumber: this.sequenceNumber,
      timestamp: this.timestamp,
      ssrc: this.ssrc,
      payload
    };

    // Increment sequence number (wraps at 0xFFFF)
    this.sequenceNumber = (this.sequenceNumber + 1) & 0xFFFF;
    
    // Increment timestamp by samples in packet
    this.timestamp = (this.timestamp + this.samplesPerPacket) & 0xFFFFFFFF;

    return packet;
  }

  /**
   * Serialize RTP packet to buffer
   */
  serialize(packet: RTPPacket): Buffer {
    const headerSize = 12; // Fixed RTP header size
    const buffer = Buffer.allocUnsafe(headerSize + packet.payload.length);

    // Byte 0: V(2), P(1), X(1), CC(4)
    buffer[0] = (packet.version << 6) |
                (packet.padding ? 0x20 : 0) |
                (packet.extension ? 0x10 : 0) |
                packet.csrcCount;

    // Byte 1: M(1), PT(7)
    buffer[1] = (packet.marker ? 0x80 : 0) | packet.payloadType;

    // Bytes 2-3: Sequence number
    buffer.writeUInt16BE(packet.sequenceNumber, 2);

    // Bytes 4-7: Timestamp
    buffer.writeUInt32BE(packet.timestamp, 4);

    // Bytes 8-11: SSRC
    buffer.writeUInt32BE(packet.ssrc, 8);

    // Copy payload
    packet.payload.copy(buffer, headerSize);

    return buffer;
  }

  /**
   * Parse RTP packet from buffer
   */
  parse(buffer: Buffer): RTPPacket | null {
    if (buffer.length < 12) {
      console.error('❌ [RTP] Packet too small:', buffer.length);
      return null;
    }

    try {
      // Parse header
      const byte0 = buffer[0];
      const byte1 = buffer[1];

      const packet: RTPPacket = {
        version: (byte0 >> 6) & 0x03,
        padding: !!(byte0 & 0x20),
        extension: !!(byte0 & 0x10),
        csrcCount: byte0 & 0x0F,
        marker: !!(byte1 & 0x80),
        payloadType: byte1 & 0x7F,
        sequenceNumber: buffer.readUInt16BE(2),
        timestamp: buffer.readUInt32BE(4),
        ssrc: buffer.readUInt32BE(8),
        payload: Buffer.alloc(0)
      };

      // Validate version
      if (packet.version !== 2) {
        console.error('❌ [RTP] Invalid version:', packet.version);
        return null;
      }

      // Calculate header size (accounting for CSRC list)
      let headerSize = 12 + (packet.csrcCount * 4);

      // Handle extension header if present
      if (packet.extension) {
        if (buffer.length < headerSize + 4) {
          console.error('❌ [RTP] Extension header incomplete');
          return null;
        }
        const extensionLength = buffer.readUInt16BE(headerSize + 2) * 4;
        headerSize += 4 + extensionLength;
      }

      // Extract payload
      if (buffer.length > headerSize) {
        packet.payload = buffer.slice(headerSize);
        
        // Handle padding if present
        if (packet.padding && packet.payload.length > 0) {
          const paddingLength = packet.payload[packet.payload.length - 1];
          if (paddingLength <= packet.payload.length) {
            packet.payload = packet.payload.slice(0, -paddingLength);
          }
        }
      }

      return packet;
    } catch (error) {
      console.error('❌ [RTP] Parse error:', error);
      return null;
    }
  }

  /**
   * Reset sequence and timestamp (for new stream)
   */
  reset(): void {
    this.sequenceNumber = Math.floor(Math.random() * 0xFFFF);
    this.timestamp = Math.floor(Math.random() * 0xFFFFFFFF);
  }

  /**
   * Get current state (for debugging)
   */
  getState(): {
    sequenceNumber: number;
    timestamp: number;
    ssrc: number;
    payloadType: number;
  } {
    return {
      sequenceNumber: this.sequenceNumber,
      timestamp: this.timestamp,
      ssrc: this.ssrc,
      payloadType: this.payloadType
    };
  }
}

/**
 * Payload types (common codecs)
 */
export const RTP_PAYLOAD_TYPES = {
  PCMU: 0,        // G.711 μ-law (Twilio uses this)
  GSM: 3,         // GSM
  G723: 4,        // G.723
  DVI4_8000: 5,   // DVI4 8kHz
  DVI4_16000: 6,  // DVI4 16kHz
  LPC: 7,         // LPC
  PCMA: 8,        // G.711 A-law
  G722: 9,        // G.722
  L16_2CH: 10,    // Linear 16-bit stereo
  L16_1CH: 11,    // Linear 16-bit mono
  OPUS: 111,      // Opus (WebRTC standard)
  TELEPHONE_EVENT: 101 // DTMF events
} as const;

export default RTPHandler;

