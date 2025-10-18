/**
 * Stream Socket Service
 * 
 * Handles WebSocket connections from browser for audio streaming
 */

import { Server as SocketIOServer } from 'socket.io';
import { RadioCoStreamService } from './radioCoStreamService.js';

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
const activeStreams = new Map<string, RadioCoStreamService>();

export function initializeStreamSocketHandlers(io: SocketIOServer): void {
  io.on('connection', (socket) => {
    console.log(`🔌 Client connected for streaming: ${socket.id}`);

    /**
     * Start streaming to Radio.co
     */
    socket.on('stream:start', async (config: StreamConfig, callback) => {
      try {
        console.log('🎙️ Starting stream to Radio.co...');

        // Check if already streaming
        if (activeStreams.has(socket.id)) {
          console.warn('⚠️ Stream already active for this client');
          callback({ success: false, error: 'Stream already active' });
          return;
        }

        // Create new Radio.co stream service
        const streamService = new RadioCoStreamService();

        // Set up event handlers
        streamService.on('connected', () => {
          console.log('✅ Connected to Radio.co');
          socket.emit('stream:connected');
        });

        streamService.on('disconnected', () => {
          console.log('📴 Disconnected from Radio.co');
          socket.emit('stream:disconnected');
        });

        streamService.on('error', (error) => {
          console.error('❌ Radio.co error:', error);
          socket.emit('stream:error', { message: error.message });
        });

        streamService.on('data-sent', (bytes) => {
          // Optionally emit progress updates
          socket.emit('stream:progress', { bytesSent: bytes });
        });

        // Connect to Radio.co
        await streamService.connect(config);

        // Store the stream service
        activeStreams.set(socket.id, streamService);

        console.log(`✅ Stream started for ${socket.id}`);
        callback({ success: true });

      } catch (error: any) {
        console.error('❌ Failed to start stream:', error);
        callback({ success: false, error: error.message });
      }
    });

    /**
     * Receive audio data from browser
     */
    socket.on('stream:audio-data', (data: ArrayBuffer) => {
      const streamService = activeStreams.get(socket.id);

      if (!streamService) {
        console.warn('⚠️ No active stream for this client');
        return;
      }

      // Convert ArrayBuffer to Buffer
      const buffer = Buffer.from(data);

      // Send to Radio.co
      const success = streamService.sendAudioData(buffer);

      if (!success) {
        socket.emit('stream:error', { message: 'Failed to send audio data' });
      }
    });

    /**
     * Stop streaming
     */
    socket.on('stream:stop', (callback) => {
      const streamService = activeStreams.get(socket.id);

      if (streamService) {
        console.log(`📴 Stopping stream for ${socket.id}`);
        streamService.disconnect();
        activeStreams.delete(socket.id);
        
        if (callback) {
          callback({ success: true });
        }
      } else {
        console.warn('⚠️ No active stream to stop');
        if (callback) {
          callback({ success: false, error: 'No active stream' });
        }
      }
    });

    /**
     * Get stream status
     */
    socket.on('stream:status', (callback) => {
      const streamService = activeStreams.get(socket.id);

      if (streamService) {
        callback({ success: true, status: streamService.getStatus() });
      } else {
        callback({ success: false, error: 'No active stream' });
      }
    });

    /**
     * Handle client disconnect
     */
    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);

      const streamService = activeStreams.get(socket.id);
      if (streamService) {
        console.log(`📴 Cleaning up stream for disconnected client ${socket.id}`);
        streamService.disconnect();
        activeStreams.delete(socket.id);
      }
    });
  });

  console.log('🎙️ Stream socket handlers initialized');
}

