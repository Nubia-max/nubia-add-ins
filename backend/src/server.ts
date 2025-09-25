import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import multer from 'multer';

import { chatRoutes } from './routes/chat';
import creditRoutes from './routes/credits';
import { errorHandler } from './middleware/errorHandler';
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
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
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

// Middleware
app.use(helmet());
// Temporarily disable CORS completely for debugging Excel add-in connectivity
app.use(cors({
  origin: true,  // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'Nubia Excel Add-in API'
  });
});

// Test route
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Nubia Excel Add-in API is working!',
    timestamp: new Date().toISOString(),
    service: 'Excel Add-in Backend'
  });
});

// API Routes with middleware
// Apply credit checking middleware to chat routes
app.use('/api/chat', authWrapper, creditCheckWrapper(), chatRoutes);

// Credit management routes
app.use('/api/credits', authWrapper, creditRoutes);

// 404 handler
app.use('*', (_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

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
  logger.info(`🚀 Nubia Excel Add-in Server running on http://localhost:${PORT}`);
  logger.info(`📡 API available at http://localhost:${PORT}/api`);
  logger.info(`🌐 Also accessible via network IP on port ${PORT}`);
  logger.info(`📊 Service: Excel Add-in Backend`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`⏱️ Server timeout: 5 minutes for AI processing`);
});

export { app, server, io };