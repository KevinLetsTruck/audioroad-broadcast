/**
 * Input Validation Schemas using Zod
 * Prevents malicious or malformed data from entering the system
 */

import { z } from 'zod';

// ============================================
// CALL VALIDATION
// ============================================

export const createCallSchema = z.object({
  episodeId: z.string().min(1, 'Episode ID required'),
  callerId: z.string().min(1, 'Caller ID required'),
  twilioCallSid: z.string().min(1, 'Twilio Call SID required'),
  topic: z.string().optional(),
  status: z.enum(['incoming', 'queued', 'screening', 'approved', 'on-air', 'completed', 'rejected', 'missed']).optional()
});

export const updateCallStatusSchema = z.object({
  screenerUserId: z.string().optional(),
  screenerNotes: z.string().max(1000).optional(),
  topic: z.string().max(500).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  recordingUrl: z.string().url().optional(),
  recordingSid: z.string().optional(),
  duration: z.number().positive().optional(),
  airDuration: z.number().positive().optional()
});

// ============================================
// CALLER VALIDATION
// ============================================

export const createCallerSchema = z.object({
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  location: z.string().max(200).optional(),
  timezone: z.string().max(50).optional(),
  truckerType: z.enum(['OTR', 'Regional', 'Local', 'Owner-Operator', 'Fleet', 'Other']).optional(),
  company: z.string().max(200).optional(),
  yearsExperience: z.number().int().min(0).max(100).optional(),
  notes: z.string().max(2000).optional()
});

export const updateCallerSchema = createCallerSchema.partial();

// ============================================
// EPISODE VALIDATION
// ============================================

export const createEpisodeSchema = z.object({
  showId: z.string().min(1, 'Show ID required'),
  title: z.string().min(1).max(200),
  date: z.string().datetime().or(z.date()),
  scheduledStart: z.string().datetime().or(z.date()),
  scheduledEnd: z.string().datetime().or(z.date()),
  description: z.string().max(5000).optional()
});

export const updateEpisodeSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  notes: z.string().max(5000).optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['scheduled', 'live', 'completed', 'cancelled', 'archived']).optional(),
  recordingUrl: z.string().url().optional(),
  transcriptUrl: z.string().url().optional()
});

// ============================================
// SHOW VALIDATION
// ============================================

export const createShowSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
  hostId: z.string().min(1),
  hostName: z.string().min(1).max(100),
  description: z.string().max(5000).optional(),
  schedule: z.object({
    days: z.array(z.string()),
    time: z.string(),
    duration: z.number().positive(),
    timezone: z.string()
  }),
  logoUrl: z.string().url().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be hex format').optional()
});

// ============================================
// CHAT MESSAGE VALIDATION
// ============================================

export const createChatMessageSchema = z.object({
  episodeId: z.string().min(1),
  senderId: z.string().min(1),
  senderName: z.string().min(1).max(100),
  senderRole: z.enum(['host', 'co-host', 'screener', 'producer', 'caller', 'admin']),
  message: z.string().min(1).max(2000),
  recipientId: z.string().optional(),
  recipientRole: z.string().optional(),
  messageType: z.enum(['text', 'system', 'file', 'call_update']).default('text')
});

// ============================================
// DOCUMENT UPLOAD VALIDATION
// ============================================

export const uploadDocumentSchema = z.object({
  callerId: z.string().min(1),
  callId: z.string().optional(),
  documentType: z.enum(['medical_lab', 'blood_work', 'cgm_data', 'oil_analysis', 'other']),
  fileName: z.string().min(1).max(255),
  fileSize: z.number().positive().max(10 * 1024 * 1024, 'File must be less than 10MB'),
  mimeType: z.string().regex(/^(application\/pdf|image\/(jpeg|png|gif)|text\/plain)$/, 'Invalid file type')
});

// ============================================
// AUDIO ASSET VALIDATION
// ============================================

export const createAudioAssetSchema = z.object({
  showId: z.string().optional(),
  name: z.string().min(1).max(200),
  type: z.enum(['opener', 'closer', 'bumper', 'commercial', 'jingle', 'transition', 'sfx']),
  fileUrl: z.string().url(),
  duration: z.number().positive(),
  fileSize: z.number().positive(),
  category: z.string().max(100).optional(),
  tags: z.array(z.string()).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  hotkey: z.string().max(20).optional()
});

// ============================================
// CLIP VALIDATION
// ============================================

export const createClipSchema = z.object({
  episodeId: z.string().min(1),
  callId: z.string().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  type: z.enum(['call_of_day', 'teaser', 'health_tip', 'business_tip', 'financial_tip', 'highlight', 'promo']),
  startTime: z.number().nonnegative().optional(),
  endTime: z.number().positive().optional(),
  duration: z.number().positive()
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Validate request body against a schema
 * Returns validated data or throws detailed error
 */
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.issues.map((err: any) => ({
        field: err.path.join('.'),
        message: err.message
      }));
      throw new Error(`Validation failed: ${JSON.stringify(errors)}`);
    }
    throw error;
  }
}

/**
 * Validate and sanitize string input
 * Removes potentially dangerous characters
 */
export function sanitizeString(input: string, maxLength: number = 1000): string {
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
    .replace(/<[^>]*>/g, ''); // Remove all HTML tags
}

/**
 * Validate environment variables on startup
 */
export function validateEnvironment() {
  const required = [
    'DATABASE_URL',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'CLERK_SECRET_KEY',
    'VITE_CLERK_PUBLISHABLE_KEY'
  ];

  const optional = [
    'ANTHROPIC_API_KEY',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_S3_BUCKET_NAME',
    'AWS_REGION',
    'APP_URL',
    'STREAM_SERVER_URL',
    'ELEVENLABS_API_KEY',
    'ELEVENLABS_GREETING_VOICE',
    'PORT',
    'NODE_ENV'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error(`❌ [SECURITY] Missing required environment variables: ${missing.join(', ')}`);
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const missingOptional = optional.filter(key => !process.env[key]);
  if (missingOptional.length > 0) {
    console.warn(`⚠️ [CONFIG] Missing optional environment variables: ${missingOptional.join(', ')}`);
    console.warn('   Some features may not work correctly.');
  }

  console.log('✅ [SECURITY] All required environment variables present');
  console.log(`📋 [CONFIG] ${optional.length - missingOptional.length}/${optional.length} optional variables configured`);
}

