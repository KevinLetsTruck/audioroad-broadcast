/**
 * Stream Socket Service
 * 
 * Handles WebSocket connections from browser for audio streaming
 * Supports BOTH Radio.co (FFmpeg) AND HLS streaming simultaneously!
 */

import { Server as SocketIOServer } from 'socket.io';
import { FFmpegStreamEncoder } from './ffmpegStreamEncoder.js';
import { HLSStreamServer } from './hlsStreamServer.js';
import { AutoDJService } from './autoDJService.js';
import { setHLSServer } from '../routes/stream.js';

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
let hlsServer: HLSStreamServer | null = null;
let autoDJ: AutoDJService | null = null;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let isLiveBroadcasting = false;

export function initializeStreamSocketHandlers(io: SocketIOServer): void {
  io.on('connection', (socket) => {
    console.log(`🔌 Client connected for streaming: ${socket.id}`);

    /**
     * Start streaming to Radio.co
     */
    socket.on('stream:start', async (config: StreamConfig, callback) => {
      try {
        const mode = config.mode || 'hls';  // Default to HLS (our platform!)
        console.log(`🎙️ [STREAM] Starting stream in ${mode} mode...`);

        // ALWAYS start HLS server (this is now your primary streaming platform!)
        if (!hlsServer) {
          console.log('🎬 [HLS] Creating HLS streaming server (your custom platform)...');
          hlsServer = new HLSStreamServer({
            segmentDuration: 10,
            playlistSize: 6,
            bitrate: config.bitrate
          });
          
          await hlsServer.start();
          setHLSServer(hlsServer);  // Make available to HTTP routes
          console.log('✅ [HLS] HLS server started - listeners can tune in at /listen');
        }
        
        // Stop Auto DJ if playing (live broadcast takes priority!)
        if (autoDJ && autoDJ.getStatus().playing) {
          console.log('📴 [AUTO DJ] Stopping Auto DJ - going live!');
          await autoDJ.stop();
        }
        
        // Mark as live broadcasting
        isLiveBroadcasting = true;

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
        
        // Notify client of success
        console.log(`✅ [STREAM] All streams started successfully`);
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
        
        // Send to Radio.co encoder if active
        if (radioCoEncoder) {
          radioCoEncoder.processAudioChunk(float32Data);
        }
        
        // Send to HLS server if active
        if (hlsServer && hlsServer.getStatus().streaming) {
          hlsServer.processAudioChunk(float32Data);
        }
        
        // Warn if no destination
        if (!radioCoEncoder && (!hlsServer || !hlsServer.getStatus().streaming)) {
          console.warn('⚠️ [STREAM] No active stream destination for audio data');
        }
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
        isLiveBroadcasting = false;
        
        // STOP HLS SERVER - This prevents audio looping!
        if (hlsServer) {
          console.log('📴 [HLS] Stopping HLS server - no more live broadcasts');
          await hlsServer.stop();
          hlsServer = null;
          console.log('✅ [HLS] HLS server stopped - stream is now offline');
        }
        
        // Note: Auto DJ integration can be added later if you want 24/7 streaming
        // For now, stream goes offline when show ends (prevents looping audio)
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
      const hlsStatus = hlsServer ? hlsServer.getStatus() : null;

      callback({ 
        success: true, 
        radioCo: radioCoEncoder ? radioCoEncoder.getStatus() : null,
        hls: hlsStatus
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
      
      // If no more live broadcasts, stop HLS server
      if (activeRadioStreams.size === 0) {
        isLiveBroadcasting = false;
        
        // STOP HLS SERVER - This prevents audio looping!
        if (hlsServer) {
          console.log('📴 [HLS] Last broadcaster disconnected, stopping HLS server');
          await hlsServer.stop();
          hlsServer = null;
          console.log('✅ [HLS] HLS server stopped - stream is now offline');
        }
        
        // Note: Auto DJ integration can be added later if you want 24/7 streaming
        // For now, stream goes offline when broadcaster disconnects
      }
    });
  });

  console.log('🎙️ Stream socket handlers initialized (Radio.co + HLS + Auto DJ support enabled)');
}

