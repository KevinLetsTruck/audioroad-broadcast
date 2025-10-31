/**
 * Commercials API Routes
 * Generate audio commercials from Shopify products
 */

import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { fetchAllProducts, getFeaturedProducts } from '../services/shopifyService.js';
import { generateCommercialScript, scoreProductsForCommercials } from '../services/commercialGeneratorService.js';
import { generateCommercialAudio } from '../services/textToSpeechService.js';
import { uploadToS3 } from '../services/audioService.js';
import fs from 'fs/promises';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/commercials/products - Fetch products from Shopify
 */
router.get('/products', async (req: Request, res: Response) => {
  try {
    const products = await fetchAllProducts();
    res.json({ 
      success: true,
      count: products.length,
      products 
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

/**
 * GET /api/commercials/featured - Get featured products for commercials
 */
router.get('/featured', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const products = await getFeaturedProducts(limit);
    const scored = scoreProductsForCommercials(products);
    
    res.json({ 
      success: true,
      count: scored.length,
      products: scored 
    });
  } catch (error) {
    console.error('Error fetching featured products:', error);
    res.status(500).json({ error: 'Failed to fetch featured products' });
  }
});

/**
 * POST /api/commercials/generate - Generate commercials for products
 * Body: { productIds?: string[], count?: number }
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { productIds, count = 5, showId } = req.body;

    console.log('🎬 [COMMERCIALS] Starting commercial generation...');

    // Get products to create commercials for
    let products;
    if (productIds && productIds.length > 0) {
      // Fetch specific products
      const allProducts = await fetchAllProducts();
      products = allProducts.filter(p => productIds.includes(p.id));
    } else {
      // Get featured products
      products = await getFeaturedProducts(count);
      products = scoreProductsForCommercials(products).slice(0, count);
    }

    console.log(`📦 [COMMERCIALS] Creating commercials for ${products.length} products`);

    const results = [];

    for (const product of products) {
      try {
        console.log(`\n🎯 [COMMERCIAL] Processing: ${product.title}`);

        // Step 1: Generate script with AI
        console.log('  📝 Step 1: Generating script...');
        const script = await generateCommercialScript({
          title: product.title,
          description: product.description,
          price: product.price,
          category: 'product_type' in product ? product.product_type : undefined
        });

        // Step 2: Convert to speech
        console.log('  🎤 Step 2: Converting to speech...');
        const audioFilePath = await generateCommercialAudio(script, product.title);

        // Step 3: Upload to S3
        console.log('  ☁️  Step 3: Uploading to S3...');
        const audioBuffer = await fs.readFile(audioFilePath);
        const handle = 'handle' in product ? product.handle : product.title.toLowerCase().replace(/\s+/g, '-');
        const s3Key = `commercials/${Date.now()}-${handle}.mp3`;
        const s3Url = await uploadToS3(audioBuffer, s3Key);

        // Step 4: Get audio duration (estimate from file size)
        const stats = await fs.stat(audioFilePath);
        const estimatedDuration = Math.round(stats.size / 4000); // Rough estimate: 4KB/sec for speech

        // Step 5: Store as AudioAsset
        console.log('  💾 Step 4: Saving to database...');
        const audioAsset = await prisma.audioAsset.create({
          data: {
            showId: showId || null,
            name: `${product.title} Commercial`,
            type: 'commercial',
            fileUrl: s3Url,
            duration: estimatedDuration,
            fileSize: stats.size,
            category: 'product_type' in product ? product.product_type : undefined,
            tags: 'tags' in product ? [...product.tags, 'auto-generated', 'shopify'] : ['auto-generated', 'shopify'],
            color: '#10b981', // Green for product commercials
            isActive: true
          }
        });

        // Clean up temp file
        await fs.unlink(audioFilePath);

        console.log(`✅ [COMMERCIAL] Completed: ${product.title} (Asset ID: ${audioAsset.id})`);

        results.push({
          product: product.title,
          script,
          audioAssetId: audioAsset.id,
          fileUrl: s3Url,
          duration: estimatedDuration
        });

        // Delay between products to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`❌ [COMMERCIAL] Failed for ${product.title}:`, error);
        results.push({
          product: product.title,
          error: error instanceof Error ? error.message : 'Generation failed'
        });
      }
    }

    console.log(`\n🎊 [COMMERCIALS] Batch complete: ${results.filter(r => !r.error).length}/${results.length} successful`);

    res.json({
      success: true,
      generated: results.filter(r => !r.error).length,
      total: results.length,
      results
    });

  } catch (error) {
    console.error('❌ [COMMERCIALS] Error in batch generation:', error);
    res.status(500).json({ error: 'Failed to generate commercials' });
  }
});

/**
 * POST /api/commercials/generate-one - Generate single commercial
 * Body: { productId: string, showId?: string }
 */
router.post('/generate-one', async (req: Request, res: Response) => {
  try {
    const { productId, showId } = req.body;

    if (!productId) {
      return res.status(400).json({ error: 'Product ID required' });
    }

    console.log(`🎬 [COMMERCIAL] Generating commercial for product: ${productId}`);

    // Fetch product
    const allProducts = await fetchAllProducts();
    const product = allProducts.find(p => p.id === productId);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Generate script
    const script = await generateCommercialScript({
      title: product.title,
      description: product.description,
      price: product.price,
      category: product.product_type
    });

    // Convert to audio
    const audioFilePath = await generateCommercialAudio(script, product.title);

    // Upload to S3
    const audioBuffer = await fs.readFile(audioFilePath);
    const s3Key = `commercials/${Date.now()}-${product.handle}.mp3`;
    const s3Url = await uploadToS3(audioBuffer, s3Key);

    // Get duration
    const stats = await fs.stat(audioFilePath);
    const duration = Math.round(stats.size / 4000);

    // Save to database
    const audioAsset = await prisma.audioAsset.create({
      data: {
        showId: showId || null,
        name: `${product.title} Commercial`,
        type: 'commercial',
        fileUrl: s3Url,
        duration,
        fileSize: stats.size,
        category: product.product_type,
        tags: [...product.tags, 'auto-generated', 'shopify'],
        color: '#10b981',
        isActive: true
      }
    });

    // Clean up
    await fs.unlink(audioFilePath);

    console.log(`✅ [COMMERCIAL] Generated commercial for ${product.title}`);

    res.json({
      success: true,
      product: product.title,
      script,
      audioAsset: {
        id: audioAsset.id,
        name: audioAsset.name,
        fileUrl: audioAsset.fileUrl,
        duration: audioAsset.duration
      }
    });

  } catch (error) {
    console.error('❌ [COMMERCIAL] Error generating commercial:', error);
    res.status(500).json({ error: 'Failed to generate commercial' });
  }
});

/**
 * POST /api/commercials/generate-script - Generate script only (no audio)
 * Body: { productId: string }
 */
router.post('/generate-script', async (req: Request, res: Response) => {
  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ error: 'Product ID required' });
    }

    console.log(`📝 [COMMERCIAL] Generating script for product: ${productId}`);

    // Fetch product
    const allProducts = await fetchAllProducts();
    const product = allProducts.find(p => p.id === productId);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Generate script
    const script = await generateCommercialScript({
      title: product.title,
      description: product.description,
      price: product.price,
      category: product.product_type
    });

    console.log(`✅ [COMMERCIAL] Script generated for ${product.title}`);

    res.json({
      success: true,
      product: {
        id: product.id,
        title: product.title,
        price: product.price
      },
      script,
      wordCount: script.split(/\s+/).length,
      charCount: script.length
    });

  } catch (error) {
    console.error('❌ [COMMERCIAL] Error generating script:', error);
    res.status(500).json({ error: 'Failed to generate script' });
  }
});

/**
 * POST /api/commercials/generate-with-script - Generate commercial with custom script
 * Body: { productId: string, script: string, voiceId?: string, showId?: string }
 */
router.post('/generate-with-script', async (req: Request, res: Response) => {
  try {
    const { productId, script, voiceId, showId } = req.body;

    if (!productId || !script) {
      return res.status(400).json({ error: 'Product ID and script required' });
    }

    console.log(`🎬 [COMMERCIAL] Generating commercial with custom script for product: ${productId}`);
    console.log(`   📋 Script length: ${script.length} chars`);
    console.log(`   🎙️ Voice ID received: "${voiceId}"`);

    // Fetch product for metadata
    const allProducts = await fetchAllProducts();
    const product = allProducts.find(p => p.id === productId);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Convert script to audio with optional custom voice
    const audioFilePath = await generateCommercialAudio(script, product.title, voiceId);

    // Upload to S3
    const audioBuffer = await fs.readFile(audioFilePath);
    const s3Key = `commercials/${Date.now()}-${product.handle}.mp3`;
    const s3Url = await uploadToS3(audioBuffer, s3Key);

    // Get duration
    const stats = await fs.stat(audioFilePath);
    const duration = Math.round(stats.size / 4000);

    // Save to database
    const audioAsset = await prisma.audioAsset.create({
      data: {
        showId: showId || null,
        name: `${product.title} Commercial`,
        type: 'commercial',
        fileUrl: s3Url,
        duration,
        fileSize: stats.size,
        category: product.product_type,
        tags: [...product.tags, 'auto-generated', 'shopify', voiceId ? `voice-${voiceId}` : 'default-voice'],
        color: '#10b981',
        isActive: true
      }
    });

    // Clean up
    await fs.unlink(audioFilePath);

    console.log(`✅ [COMMERCIAL] Generated commercial with custom script for ${product.title}`);

    res.json({
      success: true,
      product: product.title,
      script,
      voiceId: voiceId || 'default',
      audioAsset: {
        id: audioAsset.id,
        name: audioAsset.name,
        fileUrl: audioAsset.fileUrl,
        duration: audioAsset.duration
      }
    });

  } catch (error) {
    console.error('❌ [COMMERCIAL] Error generating commercial with script:', error);
    res.status(500).json({ error: 'Failed to generate commercial' });
  }
});

/**
 * GET /api/commercials/list - List all generated commercials
 */
router.get('/list', async (req: Request, res: Response) => {
  try {
    const commercials = await prisma.audioAsset.findMany({
      where: {
        type: 'commercial',
        isActive: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      success: true,
      count: commercials.length,
      commercials
    });
  } catch (error) {
    console.error('Error fetching commercials:', error);
    res.status(500).json({ error: 'Failed to fetch commercials' });
  }
});

export default router;

