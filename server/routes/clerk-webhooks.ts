/**
 * Clerk Webhook Handlers
 * Syncs Clerk user events with your database
 */

import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { Webhook } from 'svix';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * POST /api/clerk/webhooks - Handle Clerk webhook events
 * 
 * Events we handle:
 * - user.created: Create BroadcastUser record when user signs up
 * - user.updated: Update BroadcastUser when user info changes
 * - user.deleted: Delete BroadcastUser when user is deleted
 */
router.post('/webhooks', async (req: Request, res: Response) => {
  try {
    // Verify webhook signature (for security)
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

    if (!WEBHOOK_SECRET) {
      console.warn('⚠️ [CLERK] CLERK_WEBHOOK_SECRET not set - skipping verification');
      // In development, continue anyway
      // In production, you should require this!
    }

    let payload = req.body;

    // Verify signature if secret is configured
    if (WEBHOOK_SECRET) {
      const svix_id = req.headers['svix-id'] as string;
      const svix_timestamp = req.headers['svix-timestamp'] as string;
      const svix_signature = req.headers['svix-signature'] as string;

      if (!svix_id || !svix_timestamp || !svix_signature) {
        return res.status(400).json({ error: 'Missing svix headers' });
      }

      const wh = new Webhook(WEBHOOK_SECRET);
      
      try {
        payload = wh.verify(JSON.stringify(req.body), {
          'svix-id': svix_id,
          'svix-timestamp': svix_timestamp,
          'svix-signature': svix_signature,
        });
      } catch (err) {
        console.error('❌ [CLERK] Webhook verification failed:', err);
        return res.status(400).json({ error: 'Webhook verification failed' });
      }
    }

    const { type, data } = payload;
    console.log(`📥 [CLERK] Webhook event: ${type}`);

    // Handle different event types
    switch (type) {
      case 'user.created':
        await handleUserCreated(data);
        break;
      
      case 'user.updated':
        await handleUserUpdated(data);
        break;
      
      case 'user.deleted':
        await handleUserDeleted(data);
        break;
      
      default:
        console.log(`ℹ️  [CLERK] Unhandled event type: ${type}`);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ [CLERK] Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Handle user.created event
 */
async function handleUserCreated(data: any) {
  console.log('👤 [CLERK] User created:', data.email_addresses[0]?.email_address);

  const email = data.email_addresses[0]?.email_address;
  if (!email) {
    console.error('❌ [CLERK] No email in user data');
    return;
  }

  // Check if user already exists in our DB
  const existing = await prisma.broadcastUser.findUnique({
    where: { email }
  });

  if (existing) {
    console.log('ℹ️  [CLERK] User already exists in database');
    return;
  }

  // Create user in our database (for reference/legacy data)
  // Note: Clerk is now the source of truth for auth
  await prisma.broadcastUser.create({
    data: {
      id: data.id, // Use Clerk's ID
      email: email,
      password: 'clerk_managed', // Placeholder - Clerk manages passwords
      name: `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'User',
      role: (data.public_metadata?.role as string) || 'user',
      showId: data.public_metadata?.showId as string | undefined,
      isActive: true
    }
  });

  console.log('✅ [CLERK] User synced to database');
}

/**
 * Handle user.updated event
 */
async function handleUserUpdated(data: any) {
  console.log('🔄 [CLERK] User updated:', data.email_addresses[0]?.email_address);

  try {
    await prisma.broadcastUser.update({
      where: { id: data.id },
      data: {
        email: data.email_addresses[0]?.email_address,
        name: `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'User',
        role: (data.public_metadata?.role as string) || 'user',
        showId: data.public_metadata?.showId as string | undefined
      }
    });
    console.log('✅ [CLERK] User updated in database');
  } catch (error) {
    console.error('❌ [CLERK] Failed to update user:', error);
    // Don't throw - webhook should still return 200
  }
}

/**
 * Handle user.deleted event
 */
async function handleUserDeleted(data: any) {
  console.log('🗑️  [CLERK] User deleted:', data.id);

  try {
    await prisma.broadcastUser.update({
      where: { id: data.id },
      data: { isActive: false } // Soft delete
    });
    console.log('✅ [CLERK] User deactivated in database');
  } catch (error) {
    console.error('❌ [CLERK] Failed to delete user:', error);
  }
}

export default router;

