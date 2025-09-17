import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import multer from 'multer';

// Import Firebase controllers and middleware
import firebaseAuthController from './controllers/firebaseAuthController';
import firebaseChatController from './controllers/firebaseChatController';
import * as subscriptionController from './controllers/subscriptionController';
import * as automationController from './controllers/automationController';
import { auth as firebaseAuth } from './middleware/auth';

// Import middleware and utilities
import { errorHandler } from './middleware/errorHandler';
import { setupSocketHandlers } from './utils/socket';
import { logger } from './utils/logger';

dotenv.config();

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
app.use(cors({
  origin: function(origin: any, callback: any) {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'http://localhost:3000',  // Web frontend
      'http://localhost:3001',  // Backend itself
      'http://localhost:3002',  // Alternative frontend port
      'file://'                 // Electron app
    ];

    // Check if origin starts with any allowed origin
    const isAllowed = allowedOrigins.some(allowed =>
      origin.startsWith(allowed)
    );

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS') as any, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
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
    database: 'Firebase Firestore'
  });
});

// === FIREBASE AUTH ROUTES ===
app.get('/api/auth/profile', firebaseAuth, firebaseAuthController.getProfile);
app.put('/api/auth/profile', firebaseAuth, firebaseAuthController.updateProfile);
app.post('/api/auth/initialize-subscription', firebaseAuth, firebaseAuthController.initializeSubscription);
app.get('/api/auth/verify', firebaseAuth, firebaseAuthController.verifyAuth);

// === FIREBASE SUBSCRIPTION ROUTES ===
app.get('/api/subscription/current', firebaseAuth, subscriptionController.getCurrentSubscription);
app.get('/api/subscription/tiers', subscriptionController.getSubscriptionTiers);

// === FIREBASE AUTOMATION ROUTES ===
app.post('/api/automation/process', firebaseAuth, automationController.processAutomation);
app.get('/api/automation/history', firebaseAuth, automationController.getAutomationHistory);
app.get('/api/automation/analytics', firebaseAuth, automationController.getUsageAnalytics);
app.post('/api/automation/templates', firebaseAuth, automationController.saveAutomationTemplate);
app.get('/api/automation/templates', firebaseAuth, automationController.getAutomationTemplates);
app.post('/api/automation/templates/:templateId/use', firebaseAuth, automationController.useAutomationTemplate);

// === FIREBASE CHAT ROUTES ===
app.post('/api/chat', firebaseAuth, firebaseChatController.handleUniversalChat);
app.post('/api/chat/with-files', upload.array('files', 5), firebaseAuth, firebaseChatController.handleUniversalChatWithFiles);
app.post('/api/chat/clear', firebaseAuth, firebaseChatController.clearConversation);
app.get('/api/chat/history', firebaseAuth, firebaseChatController.getChatHistory);
app.delete('/api/chat/sessions/:sessionId', firebaseAuth, firebaseChatController.deleteChatSession);
app.get('/api/chat/context', firebaseAuth, firebaseChatController.getDocumentContext);

// Test endpoint for Nubia verification
app.post('/api/test/nubia', firebaseAuth, firebaseChatController.testNubia);

// Test route
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Firebase-powered NUBIA API is working!',
    timestamp: new Date().toISOString(),
    auth: 'Firebase Auth',
    database: 'Firebase Firestore',
    storage: 'Firebase Storage'
  });
});

// 404 handler
app.use('*', (req, res) => {
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

server.listen(PORT, () => {
  logger.info(`🚀 Firebase-powered NUBIA Server running on http://localhost:${PORT}`);
  logger.info(`📡 API available at http://localhost:${PORT}/api`);
  logger.info(`🔥 Database: Firebase Firestore`);
  logger.info(`🔐 Auth: Firebase Auth`);
  logger.info(`📦 Storage: Firebase Storage`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export { app, server, io };