import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { twilioClient } from '../services/twilioService.js';

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

/**
 * POST /api/chat/sms-reply - Send SMS reply to team member
 */
router.post('/sms-reply', async (req: Request, res: Response) => {
  const { to, message, episodeId } = req.body;
  
  try {
    console.log(`📱 Sending SMS reply to ${to}: ${message}`);
    
    // Check if Twilio client is configured
    if (!twilioClient) {
      console.error('❌ Twilio client not configured');
      return res.status(500).json({ error: 'SMS service not configured' });
    }
    
    // Send SMS via Twilio (use SMS-enabled number for replies)
    const smsNumber = process.env.TWILIO_SMS_NUMBER || process.env.TWILIO_PHONE_NUMBER;
    const sms = await twilioClient.messages.create({
      body: message,
      from: smsNumber,
      to: to
    });
    
    console.log('✅ SMS sent, SID:', sms.sid);
    
    // Save reply as chat message
    const chatMessage = await prisma.chatMessage.create({
      data: {
        episodeId,
        senderId: 'host',
        senderName: 'Host',
        senderRole: 'host',
        messageType: 'sms',
        message: `→ ${message}`,
        recipientId: to,
        twilioSid: sms.sid
      }
    });
    
    // Broadcast to chat so you see your own reply
    const io = req.app.get('io');
    if (io) {
      io.to(`episode:${episodeId}`).emit('chat:message', chatMessage);
      console.log('📡 SMS reply broadcast via WebSocket');
    }
    
    res.json({ success: true, message: chatMessage });
    
  } catch (error) {
    console.error('❌ Error sending SMS reply:', error);
    res.status(500).json({ error: 'Failed to send SMS' });
  }
});

export default router;

