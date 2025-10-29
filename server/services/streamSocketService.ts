/**
 * Stream Socket Service
 * 
 * Handles WebSocket connections from browser for audio streaming
 * NOW with FFmpeg server-side MP3 encoding (professional grade!)
 */

import { Server as SocketIOServer } from 'socket.io';
import { FFmpegStreamEncoder } from './ffmpegStreamEncoder.js';

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
const activeStreams = new Map<string, FFmpegStreamEncoder>();

export function initializeStreamSocketHandlers(io: SocketIOServer): void {
  io.on('connection', (socket) => {
    console.log(`🔌 Client connected for streaming: ${socket.id}`);

    /**
     * Start streaming to Radio.co
     */
    socket.on('stream:start', async (config: StreamConfig, callback) => {
      try {
        console.log('🎙️ [FFMPEG STREAM] Starting stream to Radio.co with FFmpeg encoding...');

        // Check if already streaming
        if (activeStreams.has(socket.id)) {
          console.warn('⚠️ Stream already active for this client');
          callback({ success: false, error: 'Stream already active' });
          return;
        }

        // Create new FFmpeg stream encoder
        const streamEncoder = new FFmpegStreamEncoder();

        // Set up event handlers
        streamEncoder.on('connected', () => {
          console.log('✅ [FFMPEG STREAM] Connected to Radio.co');
          socket.emit('stream:connected');
        });

        streamEncoder.on('disconnected', () => {
          console.log('📴 [FFMPEG STREAM] Disconnected from Radio.co');
          socket.emit('stream:disconnected');
        });

        streamEncoder.on('stopped', () => {
          console.log('⏹️ [FFMPEG STREAM] Stream stopped');
          socket.emit('stream:stopped');
        });

        streamEncoder.on('error', (error) => {
          console.error('❌ [FFMPEG STREAM] Error:', error);
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

        console.log(`✅ [FFMPEG STREAM] Stream started for client ${socket.id}`);
        callback({ success: true });

      } catch (error: any) {
        console.error('❌ [FFMPEG STREAM] Failed to start:', error);
        callback({ success: false, error: error.message });
      }
    });

    /**
     * Receive audio data from browser (now as Float32Array PCM)
     */
    socket.on('stream:audio-data', (data: ArrayBuffer) => {
      const streamEncoder = activeStreams.get(socket.id);

      if (!streamEncoder) {
        console.warn('⚠️ [FFMPEG STREAM] No active stream for this client');
        return;
      }

      try {
        // Debug: Log the first chunk
        if (streamEncoder.getStatus().bytesStreamed === 0) {
          console.log('🔍 [SOCKET] First audio chunk from browser:');
          console.log('   Type:', data.constructor.name);
          console.log('   Byte length:', data.byteLength);
          console.log('   First 16 bytes as Uint8:', Array.from(new Uint8Array(data).slice(0, 16)));
        }
        
        // Convert ArrayBuffer to Float32Array (raw PCM from browser)
        const float32Data = new Float32Array(data);
        
        // Process audio chunk (FFmpeg encodes to MP3 and sends to Radio.co)
        streamEncoder.processAudioChunk(float32Data);
      } catch (error) {
        console.error('❌ [FFMPEG STREAM] Error processing audio chunk:', error);
        socket.emit('stream:error', { message: 'Failed to process audio data' });
      }
    });

    /**
     * Stop streaming
     */
    socket.on('stream:stop', async (callback) => {
      const streamEncoder = activeStreams.get(socket.id);

      if (streamEncoder) {
        console.log(`📴 [FFMPEG STREAM] Stopping stream for ${socket.id}`);
        await streamEncoder.stop();
        activeStreams.delete(socket.id);
        
        if (callback) {
          callback({ success: true });
        }
      } else {
        console.warn('⚠️ [FFMPEG STREAM] No active stream to stop');
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
        console.log(`📴 [FFMPEG STREAM] Cleaning up stream for disconnected client`);
        await streamEncoder.stop();
        activeStreams.delete(socket.id);
      }
    });
  });

  console.log('🎙️ Stream socket handlers initialized (FFmpeg encoding enabled)');
}

