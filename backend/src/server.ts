import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import multer from 'multer';

import { chatRoutes } from './routes/chatRoutes';
import creditRoutes, { publicCreditRoutes } from './routes/credits';
import authRoutes from './routes/auth';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { sanitizeInput } from './middleware/validation';
import { securityHeaders, requestSizeLimits, detectSuspiciousActivity } from './middleware/security';
import { setupSocketHandlers } from './utils/socket';
import { logger } from './utils/logger';
import { initializeFirebase } from './config/firebase';
import { authWrapper } from './middleware/wrappers';
import { ENV } from './config/environment';

dotenv.config();

// Initialize Firebase
try {
  initializeFirebase();
} catch (error) {
  logger.error('Failed to initialize Firebase:', error);
}

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: ENV.CORS_ORIGIN,
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.BACKEND_PORT || 3001;

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP'
});

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not supported') as any, false);
    }
  }
});

// Security middleware (must come first)
app.use(securityHeaders);
app.use(requestSizeLimits);
app.use(detectSuspiciousActivity);

// Basic middleware
app.use(helmet({
  contentSecurityPolicy: false, // We handle CSP in securityHeaders
  crossOriginEmbedderPolicy: false // Excel add-ins need this disabled
}));

// CORS configuration for Excel add-ins
app.use(cors({
  origin: function (origin, callback) {
    // Allow Excel add-in origins and production
    const allowedOrigins = [
      'https://aibun-ai.web.app',
      'https://aibun-ai.firebaseapp.com',
      'https://excel.officeapps.live.com',
      'https://outlook.office.com',
      'https://outlook-web.office.com',
      ENV.CORS_ORIGIN
    ].filter(Boolean);

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked origin:', origin);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-anonymous-id']
}));

app.use(limiter);
app.use(express.json({ limit: '50mb' })); // Increased for file uploads
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Input sanitization
app.use(sanitizeInput);

// Request logging
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Root health endpoint
app.get('/', (_req, res) => {
  res.send('🔥 Excel Stream AI Backend Active');
});

// Health check
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'Moose Excel Stream AI API',
    version: '2.0.0',
    features: ['streaming_ai', 'anonymous_auth', 'paystack_payments', 'credit_system'],
    endpoints: {
      'POST /api/chat/stream': 'Excel AI streaming endpoint'
    }
  });
});

// Test route
app.get('/api/test', (_req, res) => {
  res.json({
    message: 'Moose Excel Add-in Streaming API is working!',
    timestamp: new Date().toISOString(),
    service: 'Excel Streaming AI Backend',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes with middleware
// STREAMING-ONLY ARCHITECTURE: All Excel AI operations use real-time streaming

// PUBLIC ROUTES (NO AUTH) - External services, webhooks, callbacks
// These MUST come before any authenticated routes to prevent middleware conflicts
app.use('/api/credits', publicCreditRoutes);

// Authentication routes (minimal middleware)
app.use('/api/auth', authWrapper, authRoutes);

// MAIN FEATURE: Streaming AI chat routes
// All Excel AI operations now use /api/chat/stream for real-time responses
app.use('/api/chat', chatRoutes);

// Credit purchase and management routes (with auth)
app.use('/api/credits/purchase', authWrapper, creditRoutes); // Auth required for init

// Credit management routes (with auth) - comes last to avoid conflicts
app.use('/api/credits', authWrapper, creditRoutes);

// 404 handler
app.use('*', notFoundHandler);

// Error handling
app.use(errorHandler);

// Socket.IO setup
setupSocketHandlers(io);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

// Configure server timeouts for file uploads and AI processing
server.timeout = 300000; // 5 minutes
server.keepAliveTimeout = 61000; // 61 seconds (must be > proxy timeout)
server.headersTimeout = 62000; // 62 seconds (must be > keepAliveTimeout)

server.listen(Number(PORT), '0.0.0.0', () => {
  logger.info(`🔥 Excel Stream AI Backend Active`);
  logger.info(`📡 Streaming API available at http://localhost:${PORT}/api`);
  logger.info(`🌐 Main endpoint: POST /api/chat/stream`);
  logger.info(`📊 Service: Excel Streaming AI Backend`);
  logger.info(`🌍 Environment: ${ENV.NODE_ENV}`);
  logger.info(`⏱️ Server timeout: 5 minutes for AI operations`);
});

export { app, server, io };