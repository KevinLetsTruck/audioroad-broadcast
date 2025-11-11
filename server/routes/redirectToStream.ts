/**
 * Redirect approved callers to live stream
 */
import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import twilio from 'twilio';

const router = express.Router();
const prisma = new PrismaClient();
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * POST /api/calls/redirect-to-stream
 * Redirect all approved callers to listen to live stream
 * Called when show starts
 */
router.post('/redirect-to-stream', async (req: Request, res: Response) => {
  try {
    const { episodeId } = req.body;
    
    if (!episodeId) {
      return res.status(400).json({ error: 'Episode ID required' });
    }
    
    console.log(`📻 [REDIRECT] Redirecting approved callers to live stream for episode: ${episodeId}`);
    
    // Find all approved calls for this episode
    const approvedCalls = await prisma.call.findMany({
      where: {
        episodeId,
        status: 'approved',
        endedAt: null
      }
    });
    
    console.log(`   Found ${approvedCalls.length} approved callers to redirect`);
    
    const appUrl = process.env.APP_URL || 'https://audioroad-broadcast-production.up.railway.app';
    
    // Redirect each caller to live stream
    const results = await Promise.allSettled(
      approvedCalls.map(async (call) => {
        try {
          await twilioClient
            .calls(call.twilioCallSid)
            .update({
              twiml: `<?xml version="1.0" encoding="UTF-8"?>
                <Response>
                  <Play loop="0">${appUrl}/api/live-stream</Play>
                </Response>`
            });
          
          console.log(`   ✅ Redirected ${call.id} to live stream`);
          return { callId: call.id, success: true };
        } catch (error: any) {
          console.error(`   ❌ Failed to redirect ${call.id}:`, error.message);
          return { callId: call.id, success: false, error: error.message };
        }
      })
    );
    
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    console.log(`✅ [REDIRECT] Redirected ${successCount}/${approvedCalls.length} callers to live stream`);
    
    res.json({ 
      success: true, 
      redirected: successCount, 
      total: approvedCalls.length 
    });
    
  } catch (error) {
    console.error('❌ [REDIRECT] Error:', error);
    res.status(500).json({ error: 'Failed to redirect callers' });
  }
});

export default router;

