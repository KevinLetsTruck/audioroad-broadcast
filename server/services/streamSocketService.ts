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

        // Check if HLS server is already running (24/7 mode)
        if (!hlsServer) {
          console.log('🎬 [HLS] HLS server not running, creating new instance...');
          hlsServer = new HLSStreamServer({
            segmentDuration: 10,
            playlistSize: 6,
            bitrate: config.bitrate
          });
          
          await hlsServer.start();
          setHLSServer(hlsServer);  // Make available to HTTP routes
          console.log('✅ [HLS] HLS server started - listeners can tune in at /listen');
        } else {
          console.log('✅ [HLS] HLS server already running (24/7 mode) - switching to live broadcast');
        }
        
        // DESTROY and recreate Auto DJ to prevent listener accumulation
        if (autoDJ) {
          console.log('🧹 [AUTO DJ] Destroying Auto DJ instance before going live...');
          autoDJ.removeAllListeners(); // Remove ALL listeners
          await autoDJ.stop(); // Full stop, not pause (temporary fix for distortion)
          autoDJ = null;
          console.log('   ✓ Auto DJ destroyed');
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
        
        // Log every 5 seconds to confirm audio is flowing
        const now = Date.now();
        if (now - lastLogTime > 5000) {
          console.log(`🎵 [LIVE STREAM] Received ${audioChunkCount} audio chunks in last 5 seconds`);
          audioChunkCount = 0;
          lastLogTime = now;
        }
        
        // Send to Radio.co encoder if active
        if (radioCoEncoder) {
          radioCoEncoder.processAudioChunk(float32Data);
        }
        
        // Send to HLS server if active
        if (hlsServer && hlsServer.getStatus().streaming) {
          hlsServer.processAudioChunk(float32Data);
        } else {
          // This is a problem - log once
          if (audioChunkCount === 1) {
            console.error('❌ [STREAM] HLS server not streaming! Audio will not reach listeners.');
            console.error('   HLS server exists:', !!hlsServer);
            console.error('   HLS streaming status:', hlsServer ? hlsServer.getStatus() : 'null');
          }
        }
        
        // Warn if no destination
        if (!radioCoEncoder && (!hlsServer || !hlsServer.getStatus().streaming)) {
          if (audioChunkCount === 1) {
            console.warn('⚠️ [STREAM] No active stream destination for audio data');
          }
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
        console.log('📴 [STREAM] No more live broadcasts, transitioning to Auto DJ...');
        
        // KEEP HLS SERVER RUNNING! Start Auto DJ for 24/7 streaming
        if (hlsServer) {
          const autoDJStatus = autoDJ?.getStatus();
          console.log(`   HLS server running: true`);
          console.log(`   Auto DJ status: ${autoDJStatus ? (autoDJStatus.playing ? 'PLAYING' : 'STOPPED') : 'NOT CREATED'}`);
          
          if (!autoDJ || !autoDJStatus || !autoDJStatus.playing) {
            console.log('🎵 [AUTO DJ] Starting Auto DJ to fill airtime...');
            
            // ALWAYS create fresh instance (prevents listener accumulation)
            if (autoDJ) {
              console.log('   Destroying old Auto DJ instance...');
              autoDJ.removeAllListeners();
              await autoDJ.stop();
            }
            
            console.log('   Creating FRESH Auto DJ instance...');
            autoDJ = new AutoDJService();
            
            // Wire Auto DJ audio output to HLS server
            console.log('   Wiring Auto DJ audio to HLS server...');
            autoDJ.on('audio-chunk', (audioData: Float32Array) => {
              if (hlsServer && hlsServer.getStatus().streaming) {
                hlsServer.processAudioChunk(audioData);
              }
            });
            
            await autoDJ.start();
            console.log('✅ [AUTO DJ] Auto DJ started - stream stays alive 24/7!');
            console.log('   Listeners will now hear Auto DJ content');
          } else {
            console.log('✅ [AUTO DJ] Auto DJ already playing - no action needed');
          }
        } else {
          console.warn('⚠️ [STREAM] HLS server not running - stream will be offline');
        }
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
      
      // If no more live broadcasts, start Auto DJ to keep stream alive
      // BUT: Check if there's actually a live episode before restarting Auto DJ!
      if (activeRadioStreams.size === 0) {
        // Check database for active episode (prevents Auto DJ restart during temporary disconnects)
        const { PrismaClient } = await import('@prisma/client');
        const prisma = new PrismaClient();
        
        const liveEpisode = await prisma.episode.findFirst({
          where: { status: 'live' }
        });
        
        if (liveEpisode) {
          console.log(`⚠️ [AUTO DJ] Not restarting - Episode ${liveEpisode.id} is still live (temporary socket disconnect)`);
          return; // Don't restart Auto DJ!
        }
        
        isLiveBroadcasting = false;
        
        // Start Auto DJ if HLS server is running
        if (hlsServer && (!autoDJ || !autoDJ.getStatus().playing)) {
          console.log('🎵 [AUTO DJ] Last broadcaster disconnected, starting Auto DJ...');
          
          // ALWAYS create fresh instance (match nuclear approach)
          if (autoDJ) {
            console.log('   Destroying old Auto DJ instance...');
            autoDJ.removeAllListeners();
            await autoDJ.stop();
          }
          
          console.log('   Creating FRESH Auto DJ instance...');
          autoDJ = new AutoDJService();
          
          // Wire Auto DJ audio output to HLS server
          autoDJ.on('audio-chunk', (audioData: Float32Array) => {
            if (hlsServer && hlsServer.getStatus().streaming) {
              hlsServer.processAudioChunk(audioData);
            }
          });
          
          await autoDJ.start();
          console.log('✅ [AUTO DJ] Auto DJ started - keeping stream alive 24/7!');
        }
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
    // Stop Auto DJ
    if (autoDJ) {
      console.log('   Stopping Auto DJ...');
      autoDJ.removeAllListeners('audio-chunk'); // Remove ALL event listeners!
      await autoDJ.stop();
      autoDJ = null;
    }
    
    // Stop HLS server
    if (hlsServer) {
      console.log('   Stopping HLS server...');
      await hlsServer.stop();
      hlsServer = null;
    }
    
    // Stop all Radio.co streams
    for (const [socketId, encoder] of activeRadioStreams.entries()) {
      console.log(`   Stopping Radio.co stream: ${socketId}`);
      await encoder.stop();
    }
    activeRadioStreams.clear();
    
    console.log('✅ [SHUTDOWN] All streaming processes stopped');
  } catch (error) {
    console.error('❌ [SHUTDOWN] Error during cleanup:', error);
  }
}

/**
 * Start HLS server on boot for 24/7 streaming
 */
export async function startHLSServerOnBoot(): Promise<void> {
  console.log('🎬 [STARTUP] Initializing 24/7 HLS streaming server...');
  
  try {
    // CRITICAL: Stop any existing HLS/Auto DJ first (prevents duplicate FFmpeg!)
    if (autoDJ) {
      console.log('🧹 [STARTUP] Stopping existing Auto DJ...');
      autoDJ.removeAllListeners('audio-chunk'); // Remove ALL event listeners!
      await autoDJ.stop();
      autoDJ = null;
    }
    
    if (hlsServer) {
      console.log('🧹 [STARTUP] Stopping existing HLS server...');
      await hlsServer.stop();
      hlsServer = null;
    }
    
    // Wait for processes to fully terminate
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('✅ [STARTUP] Clean slate - starting fresh');
    
    // Create HLS server
    hlsServer = new HLSStreamServer({
      segmentDuration: 10,
      playlistSize: 6,
      bitrate: 128
    });
    
    await hlsServer.start();
    setHLSServer(hlsServer);
    console.log('✅ [STARTUP] HLS server started - stream is live at /api/stream/live.m3u8');
    
    // Start Auto DJ immediately
    console.log('🎵 [STARTUP] Starting Auto DJ...');
    autoDJ = new AutoDJService();
    
    // Wire Auto DJ to HLS server
    autoDJ.on('audio-chunk', (audioData: Float32Array) => {
      if (hlsServer && hlsServer.getStatus().streaming) {
        hlsServer.processAudioChunk(audioData);
      }
    });
    
    await autoDJ.start();
    console.log('✅ [STARTUP] Auto DJ started - 24/7 streaming is now active!');
    
  } catch (error) {
    console.error('❌ [STARTUP] Failed to start 24/7 streaming:', error);
    throw error;
  }
}

