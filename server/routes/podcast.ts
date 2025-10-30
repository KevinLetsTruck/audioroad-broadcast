/**
 * Podcast RSS Feed Routes
 * 
 * Generate iTunes/Spotify-compatible RSS feeds
 * Full episodes + 30-minute teasers
 */

import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/podcast/feed.xml - Full episode RSS feed
 */
router.get('/feed.xml', async (req: Request, res: Response) => {
  try {
    const episodes = await prisma.episode.findMany({
      where: {
        status: 'completed',
        recordingUrl: { not: null }
      },
      include: { show: true },
      orderBy: { date: 'desc' },
      take: 100  // Last 100 episodes
    });

    const rss = generateRSSFeed(episodes, {
      title: 'AudioRoad Network - Full Episodes',
      description: 'Full-length episodes of AudioRoad Network shows - Health, Business, and Life on the Road for Professional Truck Drivers',
      feedUrl: 'https://audioroad-broadcast-production.up.railway.app/api/podcast/feed.xml',
      siteUrl: 'https://audioroad.letstruck.com',
      imageUrl: 'https://audioroad.letstruck.com/podcast-artwork.jpg',
      author: 'AudioRoad Network',
      category: 'Business',
      subcategory: 'Careers',
      useTeaserUrls: false
    });

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(rss);

  } catch (error) {
    console.error('Error generating podcast feed:', error);
    res.status(500).send('Error generating feed');
  }
});

/**
 * GET /api/podcast/teaser-feed.xml - 30-minute teaser RSS feed
 */
router.get('/teaser-feed.xml', async (req: Request, res: Response) => {
  try {
    const episodes = await prisma.episode.findMany({
      where: {
        status: 'completed',
        recordingUrl: { not: null }  // Will check for teaserUrl once we generate them
      },
      include: { show: true },
      orderBy: { date: 'desc' },
      take: 100
    });

    const rss = generateRSSFeed(episodes, {
      title: 'AudioRoad Network - 30-Minute Teasers',
      description: 'Free 30-minute previews of AudioRoad Network shows - Get a taste before diving into full episodes!',
      feedUrl: 'https://audioroad-broadcast-production.up.railway.app/api/podcast/teaser-feed.xml',
      siteUrl: 'https://audioroad.letstruck.com',
      imageUrl: 'https://audioroad.letstruck.com/podcast-teaser-artwork.jpg',
      author: 'AudioRoad Network',
      category: 'Business',
      subcategory: 'Careers',
      useTeaserUrls: true
    });

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(rss);

  } catch (error) {
    console.error('Error generating teaser feed:', error);
    res.status(500).send('Error generating feed');
  }
});

/**
 * Generate RSS XML
 */
function generateRSSFeed(episodes: any[], config: any): string {
  const items = episodes.map(ep => {
    const audioUrl = config.useTeaserUrls 
      ? (ep.teaserUrl || ep.recordingUrl)  // Use teaser if available
      : ep.recordingUrl;

    const duration = config.useTeaserUrls 
      ? Math.min(ep.duration || 0, 30)  // Teasers are max 30 min
      : (ep.duration || 0);

    return `
    <item>
      <title>${escapeXml(ep.title)}</title>
      <description>${escapeXml(ep.show?.description || 'AudioRoad Network episode')}</description>
      <pubDate>${new Date(ep.date).toUTCString()}</pubDate>
      <guid isPermaLink="false">${ep.id}</guid>
      <enclosure url="${audioUrl}" type="audio/mpeg" length="0"/>
      <itunes:duration>${formatDuration(duration)}</itunes:duration>
      <itunes:explicit>no</itunes:explicit>
      <itunes:author>AudioRoad Network</itunes:author>
      <itunes:subtitle>${escapeXml(ep.title)}</itunes:subtitle>
      <itunes:summary>${escapeXml(ep.notes || ep.show?.description || '')}</itunes:summary>
    </item>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
     xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
     xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(config.title)}</title>
    <description>${escapeXml(config.description)}</description>
    <link>${config.siteUrl}</link>
    <language>en-us</language>
    <copyright>© ${new Date().getFullYear()} AudioRoad Network</copyright>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    
    <itunes:author>${config.author}</itunes:author>
    <itunes:summary>${escapeXml(config.description)}</itunes:summary>
    <itunes:owner>
      <itunes:name>${config.author}</itunes:name>
      <itunes:email>podcast@audioroad.letstruck.com</itunes:email>
    </itunes:owner>
    <itunes:image href="${config.imageUrl}"/>
    <itunes:category text="${config.category}">
      <itunes:category text="${config.subcategory}"/>
    </itunes:category>
    <itunes:explicit>no</itunes:explicit>
    
    ${items}
  </channel>
</rss>`;
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Format duration as HH:MM:SS for iTunes
 */
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}:${mins.toString().padStart(2, '0')}:00`;
}

export default router;

