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

    // Upload to S3
    const s3Key = `documents/${callerId}/${Date.now()}-${req.file.originalname}`;
    const fileUrl = await uploadToS3(req.file.buffer, s3Key, req.file.mimetype);

    // Extract text from document
    const documentContent = await extractDocumentText(req.file.buffer, req.file.mimetype);

    // Analyze with AI
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
    res.status(500).json({ error: 'Failed to analyze document' });
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

export default router;

