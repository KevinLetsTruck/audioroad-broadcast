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
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

// Import routes
import authRoutes from './routes/auth.js';
import clerkWebhooksRoutes from './routes/clerk-webhooks.js';
import callRoutes from './routes/calls.js';
import moveToLiveRoutes from './routes/moveToLive.js';
import liveStreamRoutes from './routes/liveStream.js';
import redirectToStreamRoutes from './routes/redirectToStream.js';
import callerRoutes from './routes/callers.js';
import episodeRoutes from './routes/episodes.js';
import showRoutes from './routes/shows.js';
import twilioRoutes from './routes/twilio.js';
import twilioPlaybackRoutes from './routes/twilio-playback.js';
import analysisRoutes from './routes/analysis.js';
import audioAssetRoutes from './routes/audio-assets.js';
import clipRoutes from './routes/clips.js';
import chatRoutes from './routes/chat.js';
import recordingsRoutes from './routes/recordings.js';
import participantsRoutes from './routes/participants.js';
import commercialsRoutes from './routes/commercials.js';
import contentRoutes from './routes/content.js';
import voicesRoutes from './routes/voices.js';
import announcementsRoutes from './routes/announcements.js';
import streamRoutes from './routes/stream.js';
import playlistRoutes from './routes/playlist.js';
import platformsRoutes from './routes/platforms.js';
import podcastRoutes from './routes/podcast.js';
import directMp3Routes from './routes/directMp3.js';
import audioProxyRoutes from './routes/audioProxy.js';
import healthRoutes from './routes/health.js';
import mediaStreamRoutes from './routes/mediaStream.js';
import screeningRoutes from './routes/screening.js';
import liveRoomRoutes from './routes/liveRoom.js';
// import broadcastRoutes from './routes/broadcast.js'; // Temporarily disabled until migration runs

// Import services
import { initializeSocketHandlers } from './services/socketService.js';
import { initializeStreamSocketHandlers, startHLSServerOnBoot } from './services/streamSocketService.js';
import { audioCache } from './services/audioCache.js';
import WebRTCRoomManager from './services/webrtcRoomManager.js';
import TwilioMediaBridge from './services/twilioMediaBridge.js';

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

// Initialize WebRTC infrastructure (if Janus URL configured)
let roomManager: WebRTCRoomManager | null = null;
let mediaBridge: TwilioMediaBridge | null = null;

const janusUrl = process.env.JANUS_WS_URL;
if (janusUrl) {
  console.log('🔌 [WEBRTC] Initializing WebRTC infrastructure...');
  console.log('   Janus URL:', janusUrl);
  
  try {
    roomManager = new WebRTCRoomManager(janusUrl);
    mediaBridge = new TwilioMediaBridge(roomManager);
    
    // Make available to routes
    app.set('roomManager', roomManager);
    app.set('mediaBridge', mediaBridge);
    
    // Initialize connection to Janus (don't await - let it connect in background)
    roomManager.initialize().then(() => {
      console.log('✅ [WEBRTC] Connected to Janus Gateway');
    }).catch((error) => {
      console.error('❌ [WEBRTC] Failed to connect to Janus:', error);
      console.warn('⚠️ [WEBRTC] Continuing without WebRTC (falling back to Twilio conferences)');
    });
  } catch (error) {
    console.error('❌ [WEBRTC] Failed to initialize WebRTC infrastructure:', error);
    console.warn('⚠️ [WEBRTC] Continuing without WebRTC');
  }
} else {
  console.log('ℹ️ [WEBRTC] Janus WebSocket URL not configured - WebRTC features disabled');
  console.log('   Set JANUS_WS_URL environment variable to enable WebRTC');
}

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
  max: 10000, // Very high limit for active broadcasts with multiple users/tabs
  message: 'Too many API requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for critical real-time endpoints
    return req.path.includes('/participants/') || 
           req.path.includes('/episodes') ||
           req.path.includes('/calls');
  }
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
app.use('/api/calls', apiLimiter, moveToLiveRoutes);
app.use('/api/calls', apiLimiter, redirectToStreamRoutes);
app.use('/api/screening', apiLimiter, screeningRoutes); // WebRTC screening room management
app.use('/api/live-room', apiLimiter, liveRoomRoutes); // WebRTC live room participant management
app.use('/api/callers', apiLimiter, callerRoutes);
app.use('/api/episodes', apiLimiter, episodeRoutes);
app.use('/api/shows', apiLimiter, showRoutes);
app.use('/api/twilio', twilioWebhookLimiter, twilioRoutes); // Twilio webhooks
app.use('/api/twilio', apiLimiter, twilioPlaybackRoutes); // Twilio conference playback
app.use('/api/twilio/media-stream', mediaStreamRoutes); // Twilio Media Streams WebSocket (WebRTC bridge)
app.use('/api/live-stream', liveStreamRoutes); // Live audio stream for callers on hold
app.use('/api/analysis', apiLimiter, analysisRoutes);
app.use('/api/audio-assets', apiLimiter, audioAssetRoutes);
app.use('/api/clips', apiLimiter, clipRoutes);
app.use('/api/chat', apiLimiter, chatRoutes);
app.use('/api/recordings', apiLimiter, recordingsRoutes);
app.use('/api/participants', apiLimiter, participantsRoutes);
app.use('/api/commercials', apiLimiter, commercialsRoutes); // Shopify product commercials
app.use('/api/content', apiLimiter, contentRoutes); // Social media content generation
app.use('/api/voices', apiLimiter, voicesRoutes); // ElevenLabs voices for commercial generation
app.use('/api/announcements', apiLimiter, announcementsRoutes); // AI-generated screener announcements
app.use('/api/stream', streamRoutes); // HLS streaming endpoints (public, no auth needed for listeners)
app.use('/api/mp3-stream', directMp3Routes); // Direct MP3 stream for phone callers (public)
app.use('/api/audio-proxy', audioProxyRoutes); // Proxy for dedicated streaming server (solves DNS issue)
app.use('/api/playlist', apiLimiter, playlistRoutes); // Auto DJ playlist management
app.use('/api/platforms', apiLimiter, platformsRoutes); // Multi-platform streaming (YouTube, Facebook, X)
app.use('/api/podcast', podcastRoutes); // Podcast RSS feeds (public)
// app.use('/api/broadcast', apiLimiter, broadcastRoutes); // Temporarily disabled until migration runs

// NOTE: Route protection can be added gradually using requireAuth middleware
// Example: app.use('/api/episodes', apiLimiter, requireAuth, episodeRoutes);

// Health check endpoint (comprehensive)
app.use('/api/health', healthRoutes);

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

// 404 handler for undefined routes (must be before error handler)
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    console.log('🎙️  Starting AudioRoad Broadcast Platform...');
    console.log(`📡 Port: ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔄 Clean start - all FFmpeg processes will be fresh`);
    
    // Validate required environment variables
    console.log('🔐 [SECURITY] Validating environment...');
    validateEnvironment();
    
    console.log(`📊 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
    console.log(`📞 Twilio: ${process.env.TWILIO_ACCOUNT_SID ? 'Configured' : 'Not configured'}`);
    console.log(`🤖 Claude AI: ${process.env.ANTHROPIC_API_KEY ? 'Configured' : 'Not configured'}`);
    console.log(`🔐 Clerk: ${process.env.CLERK_SECRET_KEY ? 'Configured' : 'Not configured'}`);
    console.log(`🛡️  Security: Helmet enabled, CORS restricted, Input validation active`);
    
    httpServer.listen(PORT, '0.0.0.0', async () => {
      console.log(`\n✅ Server running on port ${PORT}`);
      console.log(`📊 API available at http://localhost:${PORT}/api`);
      console.log(`🔌 WebSocket available at http://localhost:${PORT}`);
      console.log(`🌐 Frontend proxy: ${process.env.APP_URL || 'http://localhost:5173'}`);
      console.log(`🔒 Security hardening: ACTIVE\n`);
      
      // 24/7 STREAMING MOVED TO DEDICATED MICROSERVICE
      // audioroad-streaming-server handles HLS and Auto DJ
      // This app only sends audio to the streaming server via Socket.IO
      console.log('📡 [STREAMING] Using dedicated streaming server (microservice architecture)');
      
      // ========================================
      // Audio cache DISABLED - Using Twilio's built-in hold music instead
      // ========================================
      // Callers waiting for screener: Twilio hold music (no restarts)
      // Callers in host queue: Hear live conference audio directly when show starts
      // 
      // This eliminates the audio restart/jump issue caused by chunking from rolling buffer
      console.log('========================================');
      console.log('🎵 [AUDIO] Using Twilio hold music (simple, no restarts)');
      console.log('   Approved callers hear live conference when show starts');
      console.log('========================================\n');
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

// Graceful shutdown - CRITICAL for Railway restarts!
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM signal received: graceful shutdown starting...');
  
  try {
    // Import cleanup function
    const { cleanupOnShutdown } = await import('./services/streamSocketService.js');
    
    // Kill all FFmpeg processes before shutdown
    await cleanupOnShutdown();
    console.log('✅ All streaming processes cleaned up');
  } catch (error) {
    console.error('⚠️ Error during cleanup:', error);
  }
  
  httpServer.close(() => {
    console.log('✅ HTTP server closed gracefully');
    process.exit(0);
  });
  
  // Force exit after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    console.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
});

