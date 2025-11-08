import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import twilio from 'twilio';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/health - Health check endpoint
 * Returns status of critical services
 */
router.get('/', async (_req: Request, res: Response) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: { status: 'unknown', latency: 0 },
      twilio: { status: 'unknown' },
      s3: { status: 'unknown' }
    },
    environment: {
      nodeEnv: process.env.NODE_ENV || 'development',
      hasRequiredVars: true,
      missingVars: [] as string[]
    }
  };

  // Check required environment variables
  const requiredVars = [
    'DATABASE_URL',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'CLERK_SECRET_KEY'
  ];
  
  const missingVars = requiredVars.filter(key => !process.env[key]);
  health.environment.missingVars = missingVars;
  health.environment.hasRequiredVars = missingVars.length === 0;

  // Check database connectivity
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    health.services.database.latency = Date.now() - start;
    health.services.database.status = 'connected';
  } catch (error) {
    health.services.database.status = 'disconnected';
    health.status = 'degraded';
    console.error('❌ [HEALTH] Database check failed:', error);
  }

  // Check Twilio API
  try {
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      const twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      // Simple API call to verify credentials
      await twilioClient.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
      health.services.twilio.status = 'connected';
    } else {
      health.services.twilio.status = 'not_configured';
    }
  } catch (error) {
    health.services.twilio.status = 'error';
    health.status = 'degraded';
    console.error('❌ [HEALTH] Twilio check failed:', error);
  }

  // Check S3 connectivity
  try {
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_S3_BUCKET_NAME) {
      const s3Client = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
      });
      // Try to head bucket (will fail if credentials are wrong or bucket doesn't exist)
      await s3Client.send(new HeadBucketCommand({ Bucket: process.env.AWS_S3_BUCKET_NAME }));
      health.services.s3.status = 'connected';
    } else {
      health.services.s3.status = 'not_configured';
    }
  } catch (error) {
    health.services.s3.status = 'error';
    // S3 is optional, so don't mark as degraded
    console.warn('⚠️ [HEALTH] S3 check failed (optional):', error);
  }

  // Determine overall status
  if (health.services.database.status !== 'connected' || !health.environment.hasRequiredVars) {
    health.status = 'unhealthy';
  }

  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
  res.status(statusCode).json(health);
});

export default router;

