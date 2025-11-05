/**
 * Audio Proxy Route
 * Proxies dedicated streaming server's HLS to local endpoint
 * Solves DNS resolution issue for FFmpeg
 */

import express, { Request, Response } from 'express';
import fetch from 'node-fetch';

const router = express.Router();

const STREAM_SERVER_URL = process.env.STREAM_SERVER_URL || 'https://audioroad-streaming-server-production.up.railway.app';

/**
 * GET /api/audio-proxy/live.m3u8 - Proxy HLS playlist
 */
router.get('/live.m3u8', async (req: Request, res: Response) => {
  try {
    const response = await fetch(`${STREAM_SERVER_URL}/live.m3u8`);
    
    if (!response.ok) {
      return res.status(response.status).send('Stream not available');
    }
    
    let playlist = await response.text();
    
    // Rewrite segment URLs to use our proxy
    playlist = playlist.replace(/segment-(\d+)\.ts/g, 'segment-$1.ts');
    
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(playlist);
  } catch (error) {
    console.error('Error proxying playlist:', error);
    res.status(503).send('Stream unavailable');
  }
});

/**
 * GET /api/audio-proxy/:segment - Proxy HLS segment
 */
router.get('/:segment', async (req: Request, res: Response) => {
  try {
    const { segment } = req.params;
    
    // Validate segment filename
    if (!/^segment-\d+\.ts$/.test(segment)) {
      return res.status(400).send('Invalid segment');
    }
    
    const response = await fetch(`${STREAM_SERVER_URL}/${segment}`);
    
    if (!response.ok) {
      return res.status(response.status).send('Segment not found');
    }
    
    const buffer = await response.arrayBuffer();
    
    res.setHeader('Content-Type', 'video/mp2t');
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Error proxying segment:', error);
    res.status(404).send('Segment not found');
  }
});

export default router;



