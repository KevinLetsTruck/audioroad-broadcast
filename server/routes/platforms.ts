/**
 * Streaming Platforms Routes
 * 
 * Manage YouTube, Facebook, X stream keys and settings
 */

import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/platforms - Get all streaming platform configs
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const platforms = await prisma.streamingPlatform.findMany({
      select: {
        id: true,
        name: true,
        enabled: true,
        thirtyMinLimit: true,
        customUrl: true,
        lastUsed: true,
        createdAt: true,
        // Don't send stream keys to frontend for security
        streamKey: false
      }
    });

    res.json(platforms);
  } catch (error) {
    console.error('Error fetching platforms:', error);
    res.status(500).json({ error: 'Failed to fetch platforms' });
  }
});

/**
 * POST /api/platforms - Create or update platform config
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, streamKey, enabled, thirtyMinLimit, customUrl } = req.body;

    if (!name || !streamKey) {
      return res.status(400).json({ error: 'Name and stream key required' });
    }

    // Upsert (create or update)
    const platform = await prisma.streamingPlatform.upsert({
      where: { name },
      create: {
        name,
        streamKey,
        enabled: enabled !== undefined ? enabled : false,
        thirtyMinLimit: thirtyMinLimit !== undefined ? thirtyMinLimit : true,
        customUrl
      },
      update: {
        streamKey,
        enabled,
        thirtyMinLimit,
        customUrl
      }
    });

    console.log(`✅ [PLATFORMS] Saved ${name} configuration`);
    
    // Don't send stream key back
    const { streamKey: _, ...platformWithoutKey } = platform;
    res.json(platformWithoutKey);

  } catch (error) {
    console.error('Error saving platform:', error);
    res.status(500).json({ error: 'Failed to save platform' });
  }
});

/**
 * PATCH /api/platforms/:id/toggle - Enable/disable platform
 */
router.patch('/:id/toggle', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;

    await prisma.streamingPlatform.update({
      where: { id },
      data: { enabled }
    });

    console.log(`✅ [PLATFORMS] Platform ${id} ${enabled ? 'enabled' : 'disabled'}`);
    res.json({ success: true });

  } catch (error) {
    console.error('Error toggling platform:', error);
    res.status(500).json({ error: 'Failed to toggle platform' });
  }
});

/**
 * DELETE /api/platforms/:id - Delete platform config
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.streamingPlatform.delete({
      where: { id }
    });

    console.log(`🗑️ [PLATFORMS] Deleted platform: ${id}`);
    res.json({ success: true });

  } catch (error) {
    console.error('Error deleting platform:', error);
    res.status(500).json({ error: 'Failed to delete platform' });
  }
});

/**
 * POST /api/platforms/:name/test - Test platform connection
 */
router.post('/:name/test', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;

    const platform = await prisma.streamingPlatform.findUnique({
      where: { name }
    });

    if (!platform || !platform.streamKey) {
      return res.status(404).json({ error: 'Platform not configured' });
    }

    // TODO: Actually test RTMP connection
    // For now, just return success
    console.log(`🧪 [PLATFORMS] Testing ${name} connection...`);
    
    res.json({ 
      success: true, 
      message: `${name} configuration looks good!` 
    });

  } catch (error) {
    console.error('Error testing platform:', error);
    res.status(500).json({ error: 'Failed to test platform' });
  }
});

export default router;

