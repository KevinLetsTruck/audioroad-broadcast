/**
 * Call Details Route
 * Check transcription and analysis status
 */

import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/call-details/:callId - Get detailed call info including transcript status
 */
router.get('/:callId', async (req: Request, res: Response) => {
  try {
    const { callId } = req.params;

    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: {
        caller: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            totalCalls: true,
            sentiment: true
          }
        }
      }
    });

    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }

    // Format response with detailed status
    const response = {
      call: {
        id: call.id,
        status: call.status,
        topic: call.topic,
        duration: call.totalDuration,
        onAirAt: call.onAirAt,
        endedAt: call.endedAt
      },
      caller: call.caller,
      recording: {
        hasRecording: !!call.recordingUrl,
        recordingUrl: call.recordingUrl,
        recordingSid: call.recordingSid
      },
      transcription: {
        hasTranscript: !!call.transcriptText,
        transcriptLength: call.transcriptText?.length || 0,
        transcriptPreview: call.transcriptText?.substring(0, 200) || null
      },
      analysis: {
        hasAnalysis: !!call.aiSummary,
        summary: call.aiSummary,
        keyPoints: call.aiKeyPoints,
        topics: call.aiTopics,
        sentiment: call.aiSentiment,
        contentRating: call.contentRating
      },
      status: {
        recordingComplete: !!call.recordingUrl,
        transcriptionComplete: !!call.transcriptText,
        analysisComplete: !!call.aiSummary,
        fullyProcessed: !!(call.recordingUrl && call.transcriptText && call.aiSummary)
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching call details:', error);
    res.status(500).json({ error: 'Failed to fetch call details' });
  }
});

/**
 * GET /api/call-details/recent/:episodeId - Get recent calls with analysis status
 */
router.get('/recent/:episodeId', async (req: Request, res: Response) => {
  try {
    const { episodeId } = req.params;

    const calls = await prisma.call.findMany({
      where: {
        episodeId,
        status: 'completed'
      },
      include: {
        caller: {
          select: {
            name: true,
            phoneNumber: true
          }
        }
      },
      orderBy: {
        endedAt: 'desc'
      },
      take: 10
    });

    const summary = calls.map(call => ({
      id: call.id,
      caller: call.caller?.name || 'Unknown',
      topic: call.topic,
      duration: call.airDuration,
      endedAt: call.endedAt,
      hasRecording: !!call.recordingUrl,
      hasTranscript: !!call.transcriptText,
      hasAnalysis: !!call.aiSummary,
      sentiment: call.aiSentiment,
      contentRating: call.contentRating
    }));

    res.json({
      total: calls.length,
      fullyProcessed: calls.filter(c => c.recordingUrl && c.transcriptText && c.aiSummary).length,
      pendingTranscription: calls.filter(c => c.recordingUrl && !c.transcriptText).length,
      pendingAnalysis: calls.filter(c => c.transcriptText && !c.aiSummary).length,
      calls: summary
    });
  } catch (error) {
    console.error('Error fetching recent calls:', error);
    res.status(500).json({ error: 'Failed to fetch recent calls' });
  }
});

export default router;

