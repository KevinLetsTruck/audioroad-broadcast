import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { episodeId } = req.query;
    const messages = await prisma.chatMessage.findMany({
      where: { episodeId: episodeId as string },
      orderBy: { createdAt: 'asc' }
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { episodeId, senderId, senderName, senderRole, recipientId, message, attachmentUrl, attachmentName } = req.body;
    
    const chatMessage = await prisma.chatMessage.create({
      data: {
        episodeId,
        senderId,
        senderName,
        senderRole,
        recipientId: recipientId || null,
        message,
        messageType: attachmentUrl ? 'file' : 'text',
        attachmentUrl: attachmentUrl || null
      }
    });

    const io = req.app.get('io');
    io.to(`episode:${episodeId}`).emit('chat:message', {
      ...chatMessage,
      attachmentName // Include in WebSocket event
    });

    res.status(201).json(chatMessage);
  } catch (error) {
    console.error('Error sending chat message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

export default router;

