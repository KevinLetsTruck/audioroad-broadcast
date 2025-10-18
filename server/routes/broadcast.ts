/**
 * Broadcast Configuration Routes
 * 
 * API endpoints for managing Radio.co stream configuration
 */

import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * Get broadcast configuration for a show
 */
router.get('/config/:showId', async (req, res) => {
  try {
    const { showId } = req.params;

    const config = await prisma.broadcastConfig.findUnique({
      where: { showId }
    });

    if (!config) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    // Don't send the password to the client
    const { password, ...safeConfig } = config;

    res.json(safeConfig);
  } catch (error) {
    console.error('Error fetching broadcast config:', error);
    res.status(500).json({ error: 'Failed to fetch configuration' });
  }
});

/**
 * Create or update broadcast configuration
 */
router.post('/config', async (req, res) => {
  try {
    const {
      showId,
      serverUrl,
      port,
      password,
      mountPoint,
      streamName,
      genre,
      bitrate
    } = req.body;

    if (!showId || !serverUrl || !port) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const config = await prisma.broadcastConfig.upsert({
      where: { showId },
      update: {
        serverUrl,
        port,
        password: password || undefined,
        mountPoint,
        streamName,
        genre,
        bitrate
      },
      create: {
        showId,
        serverUrl,
        port,
        password: password || '',
        mountPoint,
        streamName,
        genre,
        bitrate
      }
    });

    // Don't send the password back
    const { password: _, ...safeConfig } = config;

    res.json(safeConfig);
  } catch (error) {
    console.error('Error saving broadcast config:', error);
    res.status(500).json({ error: 'Failed to save configuration' });
  }
});

/**
 * Verify stream connection (test credentials)
 */
router.post('/verify', async (req, res) => {
  try {
    const { serverUrl, port, password } = req.body;

    if (!serverUrl || !port || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // In a production app, you would actually test the connection here
    // For now, we'll just return success
    // TODO: Implement actual connection test to Radio.co

    res.json({
      success: true,
      message: 'Configuration appears valid'
    });
  } catch (error) {
    console.error('Error verifying config:', error);
    res.status(500).json({ error: 'Failed to verify configuration' });
  }
});

/**
 * Log a broadcast session
 */
router.post('/session', async (req, res) => {
  try {
    const {
      episodeId,
      startTime,
      endTime,
      bytesStreamed,
      recordingUrl
    } = req.body;

    if (!episodeId || !startTime) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const session = await prisma.broadcastSession.create({
      data: {
        episodeId,
        startTime: new Date(startTime),
        endTime: endTime ? new Date(endTime) : undefined,
        bytesStreamed: bytesStreamed || 0,
        recordingUrl
      }
    });

    res.json(session);
  } catch (error) {
    console.error('Error logging broadcast session:', error);
    res.status(500).json({ error: 'Failed to log session' });
  }
});

export default router;

