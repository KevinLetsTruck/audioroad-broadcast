import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import { analyzeDocument, extractDocumentText } from '../services/aiService.js';
import { uploadToS3 } from '../services/audioService.js';

const router = express.Router();
const prisma = new PrismaClient();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

/**
 * POST /api/analysis/document - Upload and analyze document
 */
router.post('/document', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { callerId, callId, documentType } = req.body;

    // Check if AWS is configured
    const awsConfigured = process.env.AWS_ACCESS_KEY_ID && 
                          process.env.AWS_ACCESS_KEY_ID !== 'not_configured_yet' &&
                          process.env.AWS_SECRET_ACCESS_KEY && 
                          process.env.AWS_SECRET_ACCESS_KEY !== 'not_configured_yet';

    let fileUrl = '';
    
    if (awsConfigured) {
      // Upload to S3 if configured
      const s3Key = `documents/${callerId}/${Date.now()}-${req.file.originalname}`;
      fileUrl = await uploadToS3(req.file.buffer, s3Key, req.file.mimetype);
    } else {
      // Use placeholder URL for MVP without S3
      console.log('⚠️  S3 not configured, using placeholder URL for file:', req.file.originalname);
      fileUrl = `file://local/${req.file.originalname}`;
    }

    // Extract text from document
    const documentContent = await extractDocumentText(req.file.buffer, req.file.mimetype);

    // Analyze with AI (uses mock AI for MVP)
    const analysis = await analyzeDocument(fileUrl, documentType, documentContent);

    // Save to database
    const document = await prisma.callerDocument.create({
      data: {
        callerId,
        callId: callId || null,
        documentType,
        fileName: req.file.originalname,
        fileUrl,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        analyzed: true,
        analyzedAt: new Date(),
        aiAnalysis: analysis,
        aiSummary: analysis.summary,
        aiKeyFindings: analysis.keyFindings,
        aiRecommendations: analysis.recommendations,
        aiConfidence: analysis.confidence
      }
    });

    res.status(201).json(document);
  } catch (error) {
    console.error('Error analyzing document:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to analyze document';
    res.status(500).json({ error: errorMessage, details: error instanceof Error ? error.stack : undefined });
  }
});

/**
 * GET /api/analysis/document/:id - Get document analysis
 */
router.get('/document/:id', async (req: Request, res: Response) => {
  try {
    const document = await prisma.callerDocument.findUnique({
      where: { id: req.params.id },
      include: {
        caller: true
      }
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(document);
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

/**
 * GET /api/analysis/documents - Get all documents for a caller
 */
router.get('/documents', async (req: Request, res: Response) => {
  try {
    const { callerId, callId } = req.query;

    const where: any = {};
    if (callerId) where.callerId = callerId as string;
    if (callId) where.callId = callId as string;

    const documents = await prisma.callerDocument.findMany({
      where,
      orderBy: { uploadedAt: 'desc' }
    });

    res.json(documents);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

export default router;

