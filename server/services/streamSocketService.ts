/**
 * Stream Socket Service
 * 
 * Handles WebSocket connections from browser for audio streaming
 * NOW with server-side MP3 encoding (much more reliable!)
 */

import { Server as SocketIOServer } from 'socket.io';
import { ServerStreamEncoder } from './serverStreamEncoder.js';

interface StreamConfig {
  serverUrl: string;
  port: number;
  password: string;
  streamName?: string;
  genre?: string;
  url?: string;
  bitrate: number;
}

// Store active stream sessions
const activeStreams = new Map<string, ServerStreamEncoder>();

export function initializeStreamSocketHandlers(io: SocketIOServer): void {
  io.on('connection', (socket) => {
    console.log(`🔌 Client connected for streaming: ${socket.id}`);

    /**
     * Start streaming to Radio.co
     */
    socket.on('stream:start', async (config: StreamConfig, callback) => {
      try {
        console.log('🎙️ [SERVER STREAM] Starting stream to Radio.co with server-side encoding...');

        // Check if already streaming
        if (activeStreams.has(socket.id)) {
          console.warn('⚠️ Stream already active for this client');
          callback({ success: false, error: 'Stream already active' });
          return;
        }

        // Create new server-side stream encoder
        const streamEncoder = new ServerStreamEncoder();

        // Set up event handlers
        streamEncoder.on('connected', () => {
          console.log('✅ [SERVER STREAM] Connected to Radio.co');
          socket.emit('stream:connected');
        });

        streamEncoder.on('disconnected', () => {
          console.log('📴 [SERVER STREAM] Disconnected from Radio.co');
          socket.emit('stream:disconnected');
        });

        streamEncoder.on('stopped', () => {
          console.log('⏹️ [SERVER STREAM] Stream stopped');
          socket.emit('stream:stopped');
        });

        streamEncoder.on('error', (error) => {
          console.error('❌ [SERVER STREAM] Error:', error);
          socket.emit('stream:error', { message: error.message });
        });

        streamEncoder.on('data-sent', (bytes) => {
          // Optionally emit progress updates
          socket.emit('stream:progress', { bytesSent: bytes });
        });

        // Initialize encoder and connect to Radio.co
        await streamEncoder.initialize(config);

        // Store the stream encoder
        activeStreams.set(socket.id, streamEncoder);

        console.log(`✅ [SERVER STREAM] Stream started for client ${socket.id}`);
        callback({ success: true });

      } catch (error: any) {
        console.error('❌ [SERVER STREAM] Failed to start:', error);
        callback({ success: false, error: error.message });
      }
    });

    /**
     * Receive audio data from browser (now as Float32Array PCM)
     */
    socket.on('stream:audio-data', (data: ArrayBuffer) => {
      const streamEncoder = activeStreams.get(socket.id);

      if (!streamEncoder) {
        console.warn('⚠️ [SERVER STREAM] No active stream for this client');
        return;
      }

      try {
        // Convert ArrayBuffer to Float32Array (raw PCM from browser)
        const float32Data = new Float32Array(data);
        
        // Process audio chunk (encode to MP3 and send to Radio.co)
        streamEncoder.processAudioChunk(float32Data);
      } catch (error) {
        console.error('❌ [SERVER STREAM] Error processing audio chunk:', error);
        socket.emit('stream:error', { message: 'Failed to process audio data' });
      }
    });

    /**
     * Stop streaming
     */
    socket.on('stream:stop', async (callback) => {
      const streamEncoder = activeStreams.get(socket.id);

      if (streamEncoder) {
        console.log(`📴 [SERVER STREAM] Stopping stream for ${socket.id}`);
        await streamEncoder.stop();
        activeStreams.delete(socket.id);
        
        if (callback) {
          callback({ success: true });
        }
      } else {
        console.warn('⚠️ [SERVER STREAM] No active stream to stop');
        if (callback) {
          callback({ success: false, error: 'No active stream' });
        }
      }
    });

    /**
     * Get stream status
     */
    socket.on('stream:status', (callback) => {
      const streamEncoder = activeStreams.get(socket.id);

      if (streamEncoder) {
        callback({ success: true, status: streamEncoder.getStatus() });
      } else {
        callback({ success: false, error: 'No active stream' });
      }
    });

    /**
     * Handle client disconnect
     */
    socket.on('disconnect', async () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);

      const streamEncoder = activeStreams.get(socket.id);
      if (streamEncoder) {
        console.log(`📴 [SERVER STREAM] Cleaning up stream for disconnected client`);
        await streamEncoder.stop();
        activeStreams.delete(socket.id);
      }
    });
  });

  console.log('🎙️ Stream socket handlers initialized (server-side encoding enabled)');
}

