/**
 * Twilio Webhook Authentication Middleware
 * Verifies that webhook requests actually come from Twilio
 */

import { Request, Response, NextFunction } from 'express';
import twilio from 'twilio';

const authToken = process.env.TWILIO_AUTH_TOKEN;

/**
 * Middleware to verify Twilio webhook signatures
 * Prevents attackers from sending fake webhook requests
 */
export function verifyTwilioWebhook(req: Request, res: Response, next: NextFunction) {
  // Skip verification in development if explicitly disabled
  if (process.env.SKIP_TWILIO_VERIFICATION === 'true') {
    console.log('⚠️ [SECURITY] Skipping Twilio webhook verification (development mode)');
    return next();
  }

  if (!authToken) {
    console.error('❌ [SECURITY] TWILIO_AUTH_TOKEN not configured - cannot verify webhooks!');
    return res.status(500).json({ error: 'Webhook verification not configured' });
  }

  try {
    // Get Twilio signature from headers
    const twilioSignature = req.headers['x-twilio-signature'] as string;
    
    if (!twilioSignature) {
      console.error('❌ [SECURITY] Missing Twilio signature header');
      return res.status(403).json({ error: 'Missing signature' });
    }

    // Get the full URL of this request
    const protocol = req.protocol;
    const host = req.get('host');
    const url = `${protocol}://${host}${req.originalUrl}`;

    // Verify the signature
    const isValid = twilio.validateRequest(
      authToken,
      twilioSignature,
      url,
      req.body
    );

    if (!isValid) {
      console.error('❌ [SECURITY] Invalid Twilio webhook signature!');
      console.error('   URL:', url);
      console.error('   This could be an attack attempt!');
      return res.status(403).json({ error: 'Invalid signature' });
    }

    console.log('✅ [SECURITY] Twilio webhook signature verified');
    next();
  } catch (error) {
    console.error('❌ [SECURITY] Error verifying Twilio webhook:', error);
    res.status(500).json({ error: 'Webhook verification failed' });
  }
}

