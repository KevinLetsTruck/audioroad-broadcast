/**
 * Stream Socket Service
 * 
 * Handles WebSocket connections from browser for audio streaming
 * Supports BOTH Radio.co (FFmpeg) AND HLS streaming simultaneously!
 */

import { Server as SocketIOServer } from 'socket.io';
import { FFmpegStreamEncoder } from './ffmpegStreamEncoder.js';
import { io as ioClient } from 'socket.io-client';
import { setStreamingActive, updateLastAudioReceived, setHLSServer } from '../routes/stream.js';
import { HLSStreamServer } from './hlsStreamServer.js';
import { DirectMP3Stream } from './directMp3Stream.js';
import { audioCache } from './audioCache.js';

// Connection to dedicated streaming server
let streamingServerSocket: any = null;

interface StreamConfig {
  serverUrl: string;
  port: number;
  password: string;
  streamName?: string;
  genre?: string;
  url?: string;
  bitrate: number;
  mode?: 'radio.co' | 'hls' | 'both';  // Streaming mode
}

// Store active stream sessions
const activeRadioStreams = new Map<string, FFmpegStreamEncoder>();

// Local HLS server for phone callers
let localHLSServer: HLSStreamServer | null = null;

// Direct MP3 stream for phone callers (simpler than HLS conversion)
let directMP3Stream: DirectMP3Stream | null = null;

// Export for access from routes
export function getDirectMP3Stream(): DirectMP3Stream | null {
  return directMP3Stream;
}

// Connect to dedicated streaming server on startup
function connectToStreamingServer() {
  const streamServerUrl = process.env.STREAM_SERVER_URL || 'https://audioroad-streaming-server-production.up.railway.app';
  
  console.log(`📡 [STREAMING] Connecting to dedicated streaming server: ${streamServerUrl}`);
  
  streamingServerSocket = ioClient(streamServerUrl, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: Infinity
  });
  
  streamingServerSocket.on('connect', () => {
    console.log('✅ [STREAMING] Connected to dedicated streaming server');
  });
  
  streamingServerSocket.on('disconnect', () => {
    console.warn('⚠️ [STREAMING] Disconnected from streaming server - will auto-reconnect');
  });
  
  streamingServerSocket.on('connect_error', (error: any) => {
    console.error('❌ [STREAMING] Connection error:', error.message);
  });
}

export function initializeStreamSocketHandlers(io: SocketIOServer): void {
  // Connect to dedicated streaming server on initialization
  connectToStreamingServer();
  
  io.on('connection', (socket) => {
    console.log(`🔌 Client connected for streaming: ${socket.id}`);

    /**
     * Start streaming to Radio.co
     */
    socket.on('stream:start', async (config: StreamConfig, callback) => {
      try {
        const mode = config.mode || 'hls';  // Default to HLS (our platform!)
        console.log(`🎙️ [STREAM] Starting live broadcast - forwarding to dedicated streaming server...`);

        // Notify dedicated streaming server that live show is starting
        if (streamingServerSocket && streamingServerSocket.connected) {
          streamingServerSocket.emit('live-start');
          console.log('✅ [STREAM] Dedicated streaming server notified - Auto DJ will pause');
        } else {
          console.warn('⚠️ [STREAM] Cannot notify streaming server (not connected)');
        }
        
        // Mark as live broadcasting (tracked by dedicated streaming server now)

        // ALSO start Radio.co if mode is 'radio.co'
        if (mode === 'radio.co') {
          if (activeRadioStreams.has(socket.id)) {
            console.warn('⚠️ Radio.co stream already active for this client');
            callback({ success: false, error: 'Radio.co stream already active' });
            return;
          }

          console.log('🎙️ [RADIO.CO] ALSO starting Radio.co stream...');
          
          // Create new FFmpeg stream encoder for Radio.co
          const radioCoEncoder = new FFmpegStreamEncoder();

          // Set up event handlers
          radioCoEncoder.on('connected', () => {
            console.log('✅ [RADIO.CO] Connected to Radio.co');
            socket.emit('stream:connected');
          });

          radioCoEncoder.on('disconnected', () => {
            console.log('📴 [RADIO.CO] Disconnected from Radio.co');
            socket.emit('stream:disconnected');
          });

          radioCoEncoder.on('stopped', () => {
            console.log('⏹️ [RADIO.CO] Stream stopped');
            socket.emit('stream:stopped');
          });

          radioCoEncoder.on('error', (error) => {
            console.error('❌ [RADIO.CO] Error:', error);
            socket.emit('stream:error', { message: error.message });
          });

          radioCoEncoder.on('data-sent', (bytes) => {
            socket.emit('stream:progress', { bytesSent: bytes });
          });

          // Initialize encoder and connect to Radio.co
          await radioCoEncoder.initialize(config);

          // Store the stream encoder
          activeRadioStreams.set(socket.id, radioCoEncoder);

          console.log(`✅ [RADIO.CO] Radio.co stream started for client ${socket.id}`);
        }
        
        // Start direct MP3 stream for phone callers (simpler than HLS)
        if (!directMP3Stream) {
          console.log('🎵 [MP3-STREAM] Starting direct MP3 stream for phone callers...');
          directMP3Stream = new DirectMP3Stream();
          directMP3Stream.start();
          console.log('✅ [MP3-STREAM] Direct MP3 stream ready for phone callers');
        }
        
        // Also start local HLS server for web listeners
        if (!localHLSServer) {
          console.log('🎙️ [LOCAL HLS] Starting local HLS server for web listeners...');
          localHLSServer = new HLSStreamServer({
            segmentDuration: 2,
            playlistSize: 3,
            bitrate: 128
          });
          
          try {
            await localHLSServer.start();
            setHLSServer(localHLSServer); // Make available to routes
            console.log('✅ [LOCAL HLS] Local HLS server started for web listeners');
            
            // Start audio cache for phone callers using LOCAL HLS server
            // Use localhost to avoid Railway DNS issues with cross-service resolution
            if (!audioCache.caching) {
              const port = process.env.PORT || '5000';
              const localHlsUrl = `http://localhost:${port}/api/stream/live.m3u8`;
              console.log('🎵 [AUDIO-CACHE] Starting audio cache for phone callers...');
              console.log(`   Using LOCAL HLS server (localhost): ${localHlsUrl}`);
              audioCache.start(localHlsUrl);
              console.log('✅ [AUDIO-CACHE] Audio cache active');
            }
          } catch (hlsError) {
            console.error('⚠️ [LOCAL HLS] Failed to start:', hlsError);
            localHLSServer = null;
          }
        }
        
        // Notify client of success
        console.log(`✅ [STREAM] All streams started successfully`);
        setStreamingActive(true); // Update stream status
        socket.emit('stream:connected');  // Notify client
        callback({ success: true, mode: mode, hls: true });

      } catch (error: any) {
        console.error('❌ [STREAM] Failed to start:', error);
        callback({ success: false, error: error.message });
      }
    });

    /**
     * Receive audio data from browser (as Float32Array binary data)
     */
    // Track audio chunk count for debugging
    let audioChunkCount = 0;
    let lastLogTime = Date.now();
    
    socket.on('stream:audio-data', (data: Float32Array | Buffer) => {
      const radioCoEncoder = activeRadioStreams.get(socket.id);

      try {
        // Socket.IO sends typed arrays as Buffers - convert back to Float32Array
        let float32Data: Float32Array;
        
        if (data instanceof Float32Array) {
          float32Data = data;
        } else if (Buffer.isBuffer(data)) {
          // Buffer contains raw bytes - copy to ensure 4-byte alignment
          const alignedBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.length);
          float32Data = new Float32Array(alignedBuffer);
        } else {
          console.error('❌ [SOCKET] Unknown data type:', typeof data);
          return;
        }
        
        audioChunkCount++;
        
        // Update stream status (we're receiving audio, so stream is live)
        updateLastAudioReceived();
        
        // Log every 5 seconds to confirm audio is flowing
        const now = Date.now();
        if (now - lastLogTime > 5000) {
          console.log(`🎵 [LIVE STREAM] Received ${audioChunkCount} audio chunks in last 5 seconds`);
          audioChunkCount = 0;
          lastLogTime = now;
        }
        
        // Send to Radio.co encoder if active (optional third-party streaming)
        if (radioCoEncoder) {
          radioCoEncoder.processAudioChunk(float32Data);
        }
        
        // Send to direct MP3 stream for phone callers
        if (directMP3Stream) {
          directMP3Stream.processAudio(float32Data);
        }
        
        // Send to local HLS server for web listeners
        if (localHLSServer) {
          localHLSServer.processAudioChunk(float32Data);
        }
        
        // Forward to dedicated streaming server (handles Auto DJ and external platforms)
        if (streamingServerSocket && streamingServerSocket.connected) {
          streamingServerSocket.emit('live-audio', float32Data);
        } else {
          // Log connection issues once
          if (audioChunkCount === 1) {
            console.error('❌ [STREAM] Not connected to dedicated streaming server!');
            console.error('   Will attempt reconnection automatically...');
          }
        }
        
        // Audio sent to: Radio.co (optional) + Local HLS (phone) + Streaming server (24/7)
      } catch (error) {
        console.error('❌ [STREAM] Error processing audio chunk:', error);
        socket.emit('stream:error', { message: 'Failed to process audio data' });
      }
    });

    /**
     * Stop streaming
     */
    socket.on('stream:stop', async (callback) => {
      const radioCoEncoder = activeRadioStreams.get(socket.id);

      // Stop Radio.co stream if active
      if (radioCoEncoder) {
        console.log(`📴 [RADIO.CO] Stopping stream for ${socket.id}`);
        await radioCoEncoder.stop();
        activeRadioStreams.delete(socket.id);
      }
      
      // Mark as no longer live
      if (activeRadioStreams.size === 0) {
        console.log('📴 [STREAM] Live show ended');
        
        // DON'T notify dedicated server here - will be done in disconnect handler
        // This prevents duplicate live-stop events which cause both streams to play
        console.log('ℹ️ [STREAM] Waiting for broadcaster disconnect to notify streaming server...');
      }

      if (callback) {
        callback({ success: true });
      }
    });

    /**
     * Get stream status
     */
    socket.on('stream:status', (callback) => {
      const radioCoEncoder = activeRadioStreams.get(socket.id);

      callback({ 
        success: true, 
        radioCo: radioCoEncoder ? radioCoEncoder.getStatus() : null,
        streamingServer: streamingServerSocket ? streamingServerSocket.connected : false
      });
    });

    /**
     * Handle client disconnect
     */
    socket.on('disconnect', async () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);

      // Clean up Radio.co stream if active
      const radioCoEncoder = activeRadioStreams.get(socket.id);
      if (radioCoEncoder) {
        console.log(`📴 [RADIO.CO] Cleaning up stream for disconnected client`);
        await radioCoEncoder.stop();
        activeRadioStreams.delete(socket.id);
      }
      
      // Notify dedicated streaming server on disconnect
      if (activeRadioStreams.size === 0) {
        console.log('📴 [STREAM] Last broadcaster disconnected');
        
        // DON'T mark as offline - dedicated server handles Auto DJ
        // DON'T stop local streams - they're for phone callers during shows only
        
        // Tell dedicated streaming server to resume Auto DJ (ONLY ONCE)
        if (streamingServerSocket && streamingServerSocket.connected) {
          streamingServerSocket.emit('live-stop');
          console.log('✅ Notified streaming server - Auto DJ will resume (dedicated server stays live)');
        }
      } else {
        console.log(`ℹ️  [STREAM] Broadcaster disconnected (${activeRadioStreams.size} still active)`);
      }
    });
  });

  console.log('🎙️ Stream socket handlers initialized (Radio.co + HLS + Auto DJ support enabled)');
}

/**
 * Cleanup all streaming processes on shutdown
 */
export async function cleanupOnShutdown(): Promise<void> {
  console.log('🧹 [SHUTDOWN] Cleaning up all streaming processes...');
  
  try {
    // Stop all Radio.co streams
    for (const [socketId, encoder] of activeRadioStreams.entries()) {
      console.log(`   Stopping Radio.co stream: ${socketId}`);
      await encoder.stop();
    }
    activeRadioStreams.clear();
    
    // Disconnect from dedicated streaming server
    if (streamingServerSocket) {
      streamingServerSocket.disconnect();
      streamingServerSocket = null;
    }
    
    console.log('✅ [SHUTDOWN] All streaming processes stopped');
  } catch (error) {
    console.error('❌ [SHUTDOWN] Error during cleanup:', error);
  }
}

/**
 * Start HLS server on boot for 24/7 streaming
 * NOW HANDLED BY DEDICATED STREAMING MICROSERVICE
 * This function kept for backwards compatibility but does nothing
 */
export async function startHLSServerOnBoot(): Promise<void> {
  // No-op: Streaming handled by dedicated audioroad-streaming-server
  console.log('ℹ️ [STARTUP] 24/7 streaming handled by dedicated microservice');
}

