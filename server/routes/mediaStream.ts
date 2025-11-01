/**
 * Twilio MediaStreams WebSocket Route
 * 
 * Handles WebSocket connections from Twilio for live audio streaming to callers
 * Uses MediaStreams API instead of <Play> to support infinite streams
 */

import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { Server as HTTPServer } from 'http';
import { TwilioMediaStreamer } from '../services/twilioMediaStream.js';

const router = express.Router();

// Store active streamers
const activeStreamers = new Map<string, TwilioMediaStreamer>();

/**
 * Initialize WebSocket server for Twilio MediaStreams
 */
export function initializeMediaStreamWebSocket(httpServer: HTTPServer): void {
  const wss = new WebSocketServer({ 
    noServer: true,
    path: '/api/twilio/media-stream'
  });

  // Handle HTTP upgrade for WebSocket
  httpServer.on('upgrade', (request, socket, head) => {
    if (request.url?.startsWith('/api/twilio/media-stream')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws: WebSocket) => {
    console.log('🔌 [MEDIA-STREAM] Twilio WebSocket connected');
    
    let callSid: string | null = null;
    let streamer: TwilioMediaStreamer | null = null;

    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);

        switch (data.event) {
          case 'start':
            // Twilio sends this when stream starts
            callSid = data.start?.callSid || data.streamSid;
            console.log(`📞 [MEDIA-STREAM] Stream started for call: ${callSid}`);
            
            // Start streaming live audio to this caller
            const streamServerUrl = process.env.STREAM_SERVER_URL || 
              'https://audioroad-streaming-server-production.up.railway.app';
            const appUrl = process.env.APP_URL || 
              'https://audioroad-broadcast-production.up.railway.app';
            const hlsUrl = `${appUrl}/api/audio-proxy/live.m3u8`;
            
            streamer = new TwilioMediaStreamer({ hlsUrl, callSid: callSid || undefined });
            streamer.start(ws);
            
            if (callSid) {
              activeStreamers.set(callSid, streamer);
            }
            break;

          case 'media':
            // Twilio sends inbound audio (we don't need it for hold audio)
            break;

          case 'stop':
            // Twilio sends this when stream stops
            console.log(`📴 [MEDIA-STREAM] Stream stopped for call: ${callSid}`);
            if (streamer) {
              streamer.stop();
            }
            if (callSid) {
              activeStreamers.delete(callSid);
            }
            break;

          default:
            console.log(`📊 [MEDIA-STREAM] Unknown event: ${data.event}`);
        }
      } catch (error) {
        console.error('❌ [MEDIA-STREAM] Error handling message:', error);
      }
    });

    ws.on('close', () => {
      console.log('🔌 [MEDIA-STREAM] Twilio WebSocket disconnected');
      if (streamer) {
        streamer.stop();
      }
      if (callSid) {
        activeStreamers.delete(callSid);
      }
    });

    ws.on('error', (error) => {
      console.error('❌ [MEDIA-STREAM] WebSocket error:', error);
      if (streamer) {
        streamer.stop();
      }
      if (callSid) {
        activeStreamers.delete(callSid);
      }
    });
  });

  console.log('✅ [MEDIA-STREAM] WebSocket server initialized');
}

export default router;

