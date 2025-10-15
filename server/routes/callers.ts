import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { generateCallerSummary } from '../services/aiService.js';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/callers - Get all callers
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { search, truckerType } = req.query;

    const where: any = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { phoneNumber: { contains: search as string } },
        { location: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    if (truckerType) {
      where.truckerType = truckerType as string;
    }

    const callers = await prisma.caller.findMany({
      where,
      include: {
        _count: {
          select: { calls: true, documents: true }
        }
      },
      orderBy: {
        lastCallDate: 'desc'
      }
    });

    res.json(callers);
  } catch (error) {
    console.error('Error fetching callers:', error);
    res.status(500).json({ error: 'Failed to fetch callers' });
  }
});

/**
 * GET /api/callers/:id - Get caller details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const caller = await prisma.caller.findUnique({
      where: { id: req.params.id },
      include: {
        calls: {
          orderBy: { incomingAt: 'desc' },
          take: 20,
          include: {
            episode: {
              include: {
                show: true
              }
            }
          }
        },
        documents: {
          orderBy: { uploadedAt: 'desc' }
        }
      }
    });

    if (!caller) {
      return res.status(404).json({ error: 'Caller not found' });
    }

    res.json(caller);
  } catch (error) {
    console.error('Error fetching caller:', error);
    res.status(500).json({ error: 'Failed to fetch caller' });
  }
});

/**
 * GET /api/callers/phone/:phoneNumber - Get caller by phone number
 */
router.get('/phone/:phoneNumber', async (req: Request, res: Response) => {
  try {
    let caller = await prisma.caller.findUnique({
      where: { phoneNumber: req.params.phoneNumber },
      include: {
        calls: {
          orderBy: { incomingAt: 'desc' },
          take: 10
        },
        documents: {
          orderBy: { uploadedAt: 'desc' },
          take: 5
        }
      }
    });

    // If caller doesn't exist, create new one
    if (!caller) {
      caller = await prisma.caller.create({
        data: {
          phoneNumber: req.params.phoneNumber,
          firstCallDate: new Date(),
          lastCallDate: new Date(),
          totalCalls: 0
        },
        include: {
          calls: true,
          documents: true
        }
      });
    }

    res.json(caller);
  } catch (error) {
    console.error('Error fetching/creating caller:', error);
    res.status(500).json({ error: 'Failed to fetch caller' });
  }
});

/**
 * POST /api/callers - Create new caller
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { phoneNumber, name, email, location, truckerType, company, yearsExperience } = req.body;

    const caller = await prisma.caller.create({
      data: {
        phoneNumber,
        name,
        email,
        location,
        truckerType,
        company,
        yearsExperience,
        firstCallDate: new Date(),
        lastCallDate: new Date(),
        totalCalls: 0
      }
    });

    res.status(201).json(caller);
  } catch (error) {
    console.error('Error creating caller:', error);
    res.status(500).json({ error: 'Failed to create caller' });
  }
});

/**
 * PATCH /api/callers/:id - Update caller
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { name, email, location, truckerType, company, yearsExperience, notes, isBlocked, isFavorite } = req.body;

    const caller = await prisma.caller.update({
      where: { id: req.params.id },
      data: {
        name,
        email,
        location,
        truckerType,
        company,
        yearsExperience,
        notes,
        isBlocked,
        isFavorite
      }
    });

    res.json(caller);
  } catch (error) {
    console.error('Error updating caller:', error);
    res.status(500).json({ error: 'Failed to update caller' });
  }
});

/**
 * POST /api/callers/:id/generate-summary - Generate AI summary
 */
router.post('/:id/generate-summary', async (req: Request, res: Response) => {
  try {
    const caller = await prisma.caller.findUnique({
      where: { id: req.params.id },
      include: {
        calls: {
          orderBy: { incomingAt: 'desc' },
          take: 10
        }
      }
    });

    if (!caller) {
      return res.status(404).json({ error: 'Caller not found' });
    }

    // Generate AI summary
    const summary = await generateCallerSummary(caller, caller.calls);

    // Update caller with AI insights
    const updatedCaller = await prisma.caller.update({
      where: { id: req.params.id },
      data: {
        aiSummary: summary.summary,
        commonTopics: summary.commonTopics,
        sentiment: summary.sentiment
      }
    });

    res.json(updatedCaller);
  } catch (error) {
    console.error('Error generating summary:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

export default router;

