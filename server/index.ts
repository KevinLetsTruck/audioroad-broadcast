import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

// Import routes
import callRoutes from './routes/calls.js';
import callerRoutes from './routes/callers.js';
import episodeRoutes from './routes/episodes.js';
import showRoutes from './routes/shows.js';
import twilioRoutes from './routes/twilio.js';
import analysisRoutes from './routes/analysis.js';
import audioAssetRoutes from './routes/audio-assets.js';
import clipRoutes from './routes/clips.js';
import chatRoutes from './routes/chat.js';

// Import services
import { initializeSocketHandlers } from './services/socketService.js';

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

// Make io available to routes
app.set('io', io);

// Trust proxy - for Railway deployment
app.set('trust proxy', 1);

// Rate limiting configuration
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
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

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(generalLimiter);

// API Routes
app.use('/api/calls', apiLimiter, callRoutes);
app.use('/api/callers', apiLimiter, callerRoutes);
app.use('/api/episodes', apiLimiter, episodeRoutes);
app.use('/api/shows', apiLimiter, showRoutes);
app.use('/api/twilio', twilioWebhookLimiter, twilioRoutes); // Twilio webhooks
app.use('/api/analysis', apiLimiter, analysisRoutes);
app.use('/api/audio-assets', apiLimiter, audioAssetRoutes);
app.use('/api/clips', apiLimiter, clipRoutes);
app.use('/api/chat', apiLimiter, chatRoutes);

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
  const distPath = path.join(__dirname, '../..');
  console.log('📂 Serving static files from:', distPath);
  
  app.use(express.static(distPath, {
    setHeaders: (res, filepath) => {
      if (filepath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
      } else if (filepath.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
      }
    }
  }));

  // Handle React routing in production
  app.get('*', (req: Request, res: Response) => {
    const indexPath = path.join(distPath, 'index.html');
    console.log('📄 Serving index.html from:', indexPath);
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
    console.log(`📊 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
    console.log(`📞 Twilio: ${process.env.TWILIO_ACCOUNT_SID ? 'Configured' : 'Not configured'}`);
    console.log(`🤖 Claude AI: ${process.env.ANTHROPIC_API_KEY ? 'Configured' : 'Not configured'}`);
    
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`\n✅ Server running on port ${PORT}`);
      console.log(`📊 API available at http://localhost:${PORT}/api`);
      console.log(`🔌 WebSocket available at http://localhost:${PORT}`);
      console.log(`🌐 Frontend proxy: ${process.env.APP_URL || 'http://localhost:5173'}\n`);
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

