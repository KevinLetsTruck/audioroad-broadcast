/**
 * Twilio Media Stream WebSocket Endpoint
 * Handles incoming Media Stream connections from Twilio phone calls
 */

import express, { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * WebSocket endpoint for Twilio Media Streams
 * Twilio connects here for each phone call when using <Stream>
 * 
 * Note: WebSocket support is added by express-ws in server/index.ts
 */
interface WebSocketRouter extends express.Router {
  ws(path: string, handler: (ws: any, req: Request) => void): void;
}

(router as WebSocketRouter).ws('/stream', async (ws: any, req: Request) => {
  console.log('📞 [MEDIA-STREAM] New WebSocket connection from Twilio');
  
  let callSid: string | null = null;
  let streamSid: string | null = null;

  ws.on('message', async (message: string) => {
    try {
      const msg = JSON.parse(message);

      switch (msg.event) {
        case 'connected':
          console.log('✅ [MEDIA-STREAM] Connected:', msg.protocol);
          break;

        case 'start':
          callSid = msg.start.callSid;
          streamSid = msg.streamSid;
          
          console.log(`▶️ [MEDIA-STREAM] Stream started for call: ${callSid}`);
          console.log(`   Stream SID: ${streamSid}`);
          console.log(`   Custom Parameters:`, msg.start.customParameters);

          // Look up call in database (include caller for name/phone)
          const call = await prisma.call.findFirst({
            where: { twilioCallSid: callSid || undefined },
            include: { caller: true }
          }) as Prisma.CallGetPayload<{ include: { caller: true } }> | null;

          if (!call) {
            console.error(`❌ [MEDIA-STREAM] Call not found: ${callSid}`);
            ws.close();
            return;
          }

          // Get media bridge from app
          const mediaBridge = req.app.get('mediaBridge');
          
          if (!mediaBridge) {
            console.error('❌ [MEDIA-STREAM] Media bridge not initialized');
            ws.close();
            return;
          }

          // Determine which room to join based on call status
          let roomId: string;
          let displayName: string;

          // Get caller name from the caller relation
          const callerName = call.caller.name || call.caller.phoneNumber || 'Unknown Caller';

          switch (call.status) {
            case 'queued':
            case 'ringing':
              // New caller goes to lobby
              roomId = 'lobby';
              displayName = callerName;
              break;

            case 'screening':
              // Being screened - join screening room
              roomId = `screening-${call.episodeId}-${call.id}`;
              displayName = callerName;
              break;

            case 'approved':
            case 'on-air':
            case 'on-hold':
              // Join live room
              roomId = `live-${call.episodeId}`;
              displayName = callerName;
              break;

            default:
              console.warn(`⚠️ [MEDIA-STREAM] Unexpected call status: ${call.status}`);
              roomId = 'lobby';
              displayName = callerName;
          }

          // Start media stream bridge
          await mediaBridge.startMediaStream(
            ws,
            callSid,
            roomId,
            call.id, // Use call ID as participant ID
            displayName
          );

          console.log(`✅ [MEDIA-STREAM] Call ${callSid} bridged to room: ${roomId}`);
          break;

        case 'media':
          // Audio data is handled by the media bridge
          // This is just for logging/debugging
          break;

        case 'stop':
          console.log(`⏹️ [MEDIA-STREAM] Stream stopped: ${streamSid}`);
          
          if (callSid) {
            const mediaBridge = req.app.get('mediaBridge');
            if (mediaBridge) {
              await mediaBridge.stopMediaStream(callSid);
            }
          }
          break;

        default:
          console.log(`ℹ️ [MEDIA-STREAM] Unknown event: ${msg.event}`);
      }
    } catch (error) {
      console.error('❌ [MEDIA-STREAM] Error handling message:', error);
    }
  });

  ws.on('close', async () => {
    console.log(`📴 [MEDIA-STREAM] WebSocket closed for call: ${callSid}`);
    
    if (callSid) {
      const mediaBridge = req.app.get('mediaBridge');
      if (mediaBridge) {
        await mediaBridge.stopMediaStream(callSid);
      }
    }
  });

  ws.on('error', (error: Error) => {
    console.error('❌ [MEDIA-STREAM] WebSocket error:', error);
  });
});

/**
 * Health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
  const mediaBridge = req.app.get('mediaBridge');
  const roomManager = req.app.get('roomManager');

  res.json({
    status: 'ok',
    mediaBridge: mediaBridge ? 'initialized' : 'missing',
    roomManager: roomManager ? 'initialized' : 'missing',
    activeStreams: mediaBridge ? mediaBridge.getActiveStreamsCount() : 0,
    janusConnected: roomManager ? roomManager.isConnected() : false
  });
});

export default router;
