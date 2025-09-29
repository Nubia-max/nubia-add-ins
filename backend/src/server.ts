import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import multer from 'multer';

import { chatRoutes } from './routes/chat';
import creditRoutes, { publicCreditRoutes } from './routes/credits';
import authRoutes from './routes/auth';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { sanitizeInput } from './middleware/validation';
import { securityHeaders, requestSizeLimits, detectSuspiciousActivity } from './middleware/security';
import { setupSocketHandlers } from './utils/socket';
import { logger } from './utils/logger';
import { initializeFirebase } from './config/firebase';
import { authWrapper, creditCheckWrapper } from './middleware/wrappers';

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
    origin: process.env.CORS_ORIGIN || "https://aibun-ai.web.app",
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
      process.env.CORS_ORIGIN
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

// Health check
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'Moose Excel Add-in API',
    version: '2.0.0',
    features: ['anonymous_auth', 'paystack_payments', 'credit_system']
  });
});

// Test route
app.get('/api/test', (_req, res) => {
  res.json({
    message: 'Moose Excel Add-in API is working!',
    timestamp: new Date().toISOString(),
    service: 'Excel Add-in Backend',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes with middleware

// PUBLIC ROUTES (NO AUTH) - External services, webhooks, callbacks
// These MUST come before any authenticated routes to prevent middleware conflicts
app.use('/api/credits', publicCreditRoutes);

// Authentication routes (minimal middleware)
app.use('/api/auth', authWrapper, authRoutes);

// Apply credit checking middleware to chat routes
app.use('/api/chat', authWrapper, creditCheckWrapper(), chatRoutes);

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
  logger.info(`🚀 Moose Excel Add-in Server running on http://localhost:${PORT}`);
  logger.info(`📡 API available at http://localhost:${PORT}/api`);
  logger.info(`🌐 Also accessible via network IP on port ${PORT}`);
  logger.info(`📊 Service: Excel Add-in Backend`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`⏱️ Server timeout: 5 minutes for AI processing`);
});

export { app, server, io };