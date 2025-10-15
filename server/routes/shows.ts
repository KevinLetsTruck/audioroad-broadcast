import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

router.get('/', async (req: Request, res: Response) => {
  try {
    const shows = await prisma.show.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { episodes: true } }
      }
    });
    res.json(shows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch shows' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const show = await prisma.show.findUnique({
      where: { id: req.params.id },
      include: {
        episodes: {
          orderBy: { date: 'desc' },
          take: 20
        }
      }
    });
    res.json(show);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch show' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, slug, hostId, hostName, description, schedule, logoUrl, color } = req.body;
    const show = await prisma.show.create({
      data: { name, slug, hostId, hostName, description, schedule, logoUrl, color }
    });
    res.status(201).json(show);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create show' });
  }
});

export default router;

