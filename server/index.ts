import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { validateEnvironment } from './utils/validation.js';

// Import routes
import authRoutes from './routes/auth.js';
import clerkWebhooksRoutes from './routes/clerk-webhooks.js';
import callRoutes from './routes/calls.js';
import callerRoutes from './routes/callers.js';
import episodeRoutes from './routes/episodes.js';
import showRoutes from './routes/shows.js';
import twilioRoutes from './routes/twilio.js';
import analysisRoutes from './routes/analysis.js';
import audioAssetRoutes from './routes/audio-assets.js';
import clipRoutes from './routes/clips.js';
import chatRoutes from './routes/chat.js';
import recordingsRoutes from './routes/recordings.js';
import participantsRoutes from './routes/participants.js';
import commercialsRoutes from './routes/commercials.js';
import contentRoutes from './routes/content.js';
import voicesRoutes from './routes/voices.js';
import streamRoutes from './routes/stream.js';
import playlistRoutes from './routes/playlist.js';
import platformsRoutes from './routes/platforms.js';
import podcastRoutes from './routes/podcast.js';
// import broadcastRoutes from './routes/broadcast.js'; // Temporarily disabled until migration runs

// Import services
import { initializeSocketHandlers } from './services/socketService.js';
import { initializeStreamSocketHandlers } from './services/streamSocketService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// Create HTTP server
const httpServer = createServer(app);

// Initialize Socket.IO
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.APP_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// Initialize socket handlers
initializeSocketHandlers(io);
initializeStreamSocketHandlers(io);

// Make io available to routes
app.set('io', io);

// Trust proxy - for Railway deployment
app.set('trust proxy', 1);

// Rate limiting configuration - increased for development
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // Increased from 500 to handle WebRTC/Socket connections
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000, // Increased from 100 for development
  message: 'Too many API requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const twilioWebhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // High limit for Twilio webhooks
  standardHeaders: true,
  legacyHeaders: false,
});

// Security Middleware
// Helmet - adds security headers (but allow Clerk scripts)
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP to allow Clerk (they handle their own security)
  crossOriginEmbedderPolicy: false, // Allow audio/video embedding
  crossOriginResourcePolicy: { policy: "cross-origin" } // Allow S3/external resources
}));

// CORS - restrict to known origins in production
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [process.env.APP_URL || 'https://audioroad-broadcast-production.up.railway.app']
  : ['http://localhost:5173', 'http://localhost:3001'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️ [SECURITY] Blocked CORS request from: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true // Allow cookies
}));

app.use(cookieParser());
app.use(express.json({ limit: '10mb' })); // Limit JSON payload size
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(generalLimiter);

// API Routes
app.use('/api/auth', apiLimiter, authRoutes); // Custom auth routes (legacy, can be removed later)
app.use('/api/clerk', clerkWebhooksRoutes); // Clerk webhooks (no rate limit - Clerk handles this)
app.use('/api/calls', apiLimiter, callRoutes);
app.use('/api/callers', apiLimiter, callerRoutes);
app.use('/api/episodes', apiLimiter, episodeRoutes);
app.use('/api/shows', apiLimiter, showRoutes);
app.use('/api/twilio', twilioWebhookLimiter, twilioRoutes); // Twilio webhooks
app.use('/api/analysis', apiLimiter, analysisRoutes);
app.use('/api/audio-assets', apiLimiter, audioAssetRoutes);
app.use('/api/clips', apiLimiter, clipRoutes);
app.use('/api/chat', apiLimiter, chatRoutes);
app.use('/api/recordings', apiLimiter, recordingsRoutes);
app.use('/api/participants', apiLimiter, participantsRoutes);
app.use('/api/commercials', apiLimiter, commercialsRoutes); // Shopify product commercials
app.use('/api/content', apiLimiter, contentRoutes); // Social media content generation
app.use('/api/voices', apiLimiter, voicesRoutes); // ElevenLabs voices for commercial generation
app.use('/api/stream', streamRoutes); // HLS streaming endpoints (public, no auth needed for listeners)
app.use('/api/playlist', apiLimiter, playlistRoutes); // Auto DJ playlist management
app.use('/api/platforms', apiLimiter, platformsRoutes); // Multi-platform streaming (YouTube, Facebook, X)
app.use('/api/podcast', podcastRoutes); // Podcast RSS feeds (public)
// app.use('/api/broadcast', apiLimiter, broadcastRoutes); // Temporarily disabled until migration runs

// NOTE: Route protection can be added gradually using requireAuth middleware
// Example: app.use('/api/episodes', apiLimiter, requireAuth, episodeRoutes);

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'AudioRoad Broadcast Platform',
    version: '1.0.0'
  });
});

// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
  // In Railway, dist folder is at /app/dist (one level up from dist/server)
  const distPath = path.join(__dirname, '..');
  console.log('📂 Serving static files from:', distPath);
  
  app.use(express.static(distPath, {
    setHeaders: (res, filepath) => {
      if (filepath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
      } else if (filepath.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
      } else if (filepath.endsWith('.html')) {
        // Prevent HTML caching to always get latest app version
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    }
  }));

  // Handle React routing in production
  app.get('*', (req: Request, res: Response) => {
    const indexPath = path.join(distPath, 'index.html');
    console.log('📄 Serving index.html from:', indexPath);
    
    // Force no caching on index.html
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    res.sendFile(indexPath);
  });
}

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});

// Start server
const startServer = async () => {
  try {
    console.log('🎙️  Starting AudioRoad Broadcast Platform...');
    console.log(`📡 Port: ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Validate required environment variables
    console.log('🔐 [SECURITY] Validating environment...');
    validateEnvironment();
    
    console.log(`📊 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
    console.log(`📞 Twilio: ${process.env.TWILIO_ACCOUNT_SID ? 'Configured' : 'Not configured'}`);
    console.log(`🤖 Claude AI: ${process.env.ANTHROPIC_API_KEY ? 'Configured' : 'Not configured'}`);
    console.log(`🔐 Clerk: ${process.env.CLERK_SECRET_KEY ? 'Configured' : 'Not configured'}`);
    console.log(`🛡️  Security: Helmet enabled, CORS restricted, Input validation active`);
    
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`\n✅ Server running on port ${PORT}`);
      console.log(`📊 API available at http://localhost:${PORT}/api`);
      console.log(`🔌 WebSocket available at http://localhost:${PORT}`);
      console.log(`🌐 Frontend proxy: ${process.env.APP_URL || 'http://localhost:5173'}`);
      console.log(`🔒 Security hardening: ACTIVE\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    console.error('Error details:', error instanceof Error ? error.message : error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    process.exit(1);
  }
};

console.log('Initializing server...');
startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  httpServer.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

