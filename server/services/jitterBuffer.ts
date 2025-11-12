/**
 * Jitter Buffer
 * Handles packet reordering and timing variations for smooth audio playback
 * 
 * Key functions:
 * - Reorder packets that arrive out of sequence
 * - Compensate for network jitter (variable delay)
 * - Detect and handle packet loss
 * - Maintain optimal buffer depth (latency vs quality)
 */

import { RTPPacket } from './rtpHandler.js';

interface BufferedPacket {
  packet: RTPPacket;
  receivedAt: number;
}

export interface JitterBufferStats {
  packetsReceived: number;
  packetsPlayed: number;
  packetsDropped: number;
  packetsLate: number;
  packetsDuplicate: number;
  currentDepth: number;
  targetDepth: number;
  averageJitter: number;
}

export class JitterBuffer {
  private buffer: Map<number, BufferedPacket> = new Map();
  private minBufferSize: number;
  private maxBufferSize: number;
  private targetBufferSize: number;
  
  private lastSequenceNumber: number = -1;
  private lastTimestamp: number = 0;
  private baseTimestamp: number = -1;
  
  // Statistics
  private stats: JitterBufferStats = {
    packetsReceived: 0,
    packetsPlayed: 0,
    packetsDropped: 0,
    packetsLate: 0,
    packetsDuplicate: 0,
    currentDepth: 0,
    targetDepth: 0,
    averageJitter: 0
  };
  
  // Jitter calculation
  private jitterSum: number = 0;
  private jitterCount: number = 0;
  private lastArrival: number = 0;
  
  constructor(
    minBufferSize: number = 3,   // Minimum packets to buffer (60ms at 20ms/packet)
    maxBufferSize: number = 20,  // Maximum packets to buffer (400ms)
    targetBufferSize: number = 5 // Target packets to buffer (100ms)
  ) {
    this.minBufferSize = minBufferSize;
    this.maxBufferSize = maxBufferSize;
    this.targetBufferSize = targetBufferSize;
    this.stats.targetDepth = targetBufferSize;
  }

  /**
   * Add packet to buffer
   */
  push(packet: RTPPacket): void {
    this.stats.packetsReceived++;
    
    // Initialize base timestamp on first packet
    if (this.baseTimestamp === -1) {
      this.baseTimestamp = packet.timestamp;
      this.lastTimestamp = packet.timestamp;
    }
    
    // Check for duplicate
    if (this.buffer.has(packet.sequenceNumber)) {
      this.stats.packetsDuplicate++;
      console.warn(`⚠️ [JITTER] Duplicate packet: ${packet.sequenceNumber}`);
      return;
    }
    
    // Calculate jitter (variation in arrival time)
    const now = Date.now();
    if (this.lastArrival > 0) {
      const actualDelay = now - this.lastArrival;
      const expectedDelay = 20; // 20ms for 8kHz, 160 samples
      const jitter = Math.abs(actualDelay - expectedDelay);
      
      this.jitterSum += jitter;
      this.jitterCount++;
      this.stats.averageJitter = this.jitterSum / this.jitterCount;
    }
    this.lastArrival = now;
    
    // Add to buffer
    this.buffer.set(packet.sequenceNumber, {
      packet,
      receivedAt: now
    });
    
    this.stats.currentDepth = this.buffer.size;
    
    // Trim buffer if too large
    if (this.buffer.size > this.maxBufferSize) {
      const oldest = this.getOldestSequence();
      if (oldest !== null) {
        this.buffer.delete(oldest);
        this.stats.packetsDropped++;
        console.warn(`⚠️ [JITTER] Buffer overflow, dropped packet: ${oldest}`);
      }
    }
  }

  /**
   * Get next packet in sequence (if available)
   */
  pop(): RTPPacket | null {
    // Wait until we have minimum buffer size (except if we've been waiting too long)
    if (this.buffer.size < this.minBufferSize && this.lastSequenceNumber === -1) {
      return null; // Still building initial buffer
    }
    
    // Determine next expected sequence number
    const nextSequence = this.lastSequenceNumber === -1 
      ? this.getOldestSequence() 
      : (this.lastSequenceNumber + 1) & 0xFFFF;
    
    if (nextSequence === null) {
      return null;
    }
    
    // Try to get the next packet
    const buffered = this.buffer.get(nextSequence);
    
    if (buffered) {
      // Found the next packet in sequence
      this.buffer.delete(nextSequence);
      this.lastSequenceNumber = nextSequence;
      this.lastTimestamp = buffered.packet.timestamp;
      this.stats.packetsPlayed++;
      this.stats.currentDepth = this.buffer.size;
      return buffered.packet;
    }
    
    // Packet not available - check if it's late or lost
    const now = Date.now();
    const oldestBuffered = this.getOldestBufferedPacket();
    
    if (oldestBuffered && (now - oldestBuffered.receivedAt) > 100) {
      // Waited too long - consider packet lost, play next available
      this.stats.packetsLate++;
      console.warn(`⚠️ [JITTER] Packet ${nextSequence} lost or too late, skipping`);
      
      this.lastSequenceNumber = nextSequence;
      
      // Return next available packet
      const oldest = this.getOldestSequence();
      if (oldest !== null) {
        const packet = this.buffer.get(oldest);
        if (packet) {
          this.buffer.delete(oldest);
          this.lastSequenceNumber = oldest;
          this.lastTimestamp = packet.packet.timestamp;
          this.stats.packetsPlayed++;
          this.stats.currentDepth = this.buffer.size;
          return packet.packet;
        }
      }
    }
    
    return null; // Wait for the packet to arrive
  }

  /**
   * Get oldest sequence number in buffer
   */
  private getOldestSequence(): number | null {
    if (this.buffer.size === 0) {
      return null;
    }
    
    let oldest: number | null = null;
    
    for (const seq of this.buffer.keys()) {
      if (oldest === null) {
        oldest = seq;
      } else {
        // Handle sequence number wrap-around (0xFFFF → 0)
        const diff = this.sequenceDiff(seq, oldest);
        if (diff < 0) {
          oldest = seq;
        }
      }
    }
    
    return oldest;
  }

  /**
   * Get oldest buffered packet
   */
  private getOldestBufferedPacket(): BufferedPacket | null {
    const oldest = this.getOldestSequence();
    if (oldest === null) {
      return null;
    }
    return this.buffer.get(oldest) || null;
  }

  /**
   * Calculate sequence number difference (accounting for wrap-around)
   */
  private sequenceDiff(a: number, b: number): number {
    const diff = a - b;
    
    // Handle wrap-around
    if (diff > 0x8000) {
      return diff - 0x10000;
    } else if (diff < -0x8000) {
      return diff + 0x10000;
    }
    
    return diff;
  }

  /**
   * Flush all packets (in order)
   */
  flush(): RTPPacket[] {
    const packets: RTPPacket[] = [];
    
    while (this.buffer.size > 0) {
      const packet = this.pop();
      if (packet) {
        packets.push(packet);
      } else {
        // No more sequential packets available
        break;
      }
    }
    
    return packets;
  }

  /**
   * Clear buffer
   */
  clear(): void {
    this.buffer.clear();
    this.lastSequenceNumber = -1;
    this.lastTimestamp = 0;
    this.baseTimestamp = -1;
    this.lastArrival = 0;
    this.stats.currentDepth = 0;
  }

  /**
   * Get buffer statistics
   */
  getStats(): JitterBufferStats {
    return { ...this.stats };
  }

  /**
   * Adjust target buffer size based on network conditions
   */
  adjustTargetSize(increase: boolean): void {
    if (increase && this.targetBufferSize < this.maxBufferSize) {
      this.targetBufferSize++;
      console.log(`📈 [JITTER] Increased target buffer: ${this.targetBufferSize}`);
    } else if (!increase && this.targetBufferSize > this.minBufferSize) {
      this.targetBufferSize--;
      console.log(`📉 [JITTER] Decreased target buffer: ${this.targetBufferSize}`);
    }
    this.stats.targetDepth = this.targetBufferSize;
  }

  /**
   * Get current buffer depth
   */
  getDepth(): number {
    return this.buffer.size;
  }

  /**
   * Check if buffer is ready to play
   */
  isReady(): boolean {
    return this.buffer.size >= this.minBufferSize;
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      packetsReceived: 0,
      packetsPlayed: 0,
      packetsDropped: 0,
      packetsLate: 0,
      packetsDuplicate: 0,
      currentDepth: this.buffer.size,
      targetDepth: this.targetBufferSize,
      averageJitter: 0
    };
    this.jitterSum = 0;
    this.jitterCount = 0;
  }
}

export default JitterBuffer;

