/**
 * Chat Routes - Streaming Only
 * Standardized backend routes for Excel AI operations
 * All requests now use streaming endpoint for real-time responses
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import { authWrapper } from '../middleware/wrappers';
import { validateRequest } from '../middleware/validateRequest';
import { AuthenticatedRequest } from '../middleware/auth';
import { streamExcelResponse } from '../services/excelOrchestrator';
import { logger } from '../utils/logger';

// Create router instance
const router = Router();

/**
 * Middleware to add debug logging for stream requests
 */
const streamDebugMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.uid || 'anonymous';
  const userAgent = req.get('User-Agent') || 'unknown';
  const origin = req.get('Origin') || 'unknown';

  console.log('[stream] Incoming Excel AI request from user:', userId);
  logger.debug('Stream request details:', {
    userId,
    userAgent: userAgent.substring(0, 100),
    origin,
    timestamp: new Date().toISOString()
  });

  next();
};

/**
 * CORS middleware for streaming requests (if not applied globally)
 */
const streamCorsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Set streaming-specific CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-session-id, x-anonymous-id');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  next();
};

/**
 * Main streaming endpoint for Excel AI operations
 * Handles all Excel taskpane requests with real-time streaming
 */
router.post('/stream', [
  body('message').notEmpty().withMessage('Message is required'),
  body('context').optional().isObject().withMessage('Context must be an object')
],
  validateRequest,
  streamCorsMiddleware,
  authWrapper,
  streamDebugMiddleware,
  streamExcelResponse
);

// Legacy endpoint redirect (for backward compatibility)
router.post('/', (req: Request, res: Response) => {
  logger.warn('Legacy /api/chat endpoint called - redirecting to streaming');
  res.status(301).json({
    error: 'ENDPOINT_MOVED',
    message: 'This endpoint has been moved to /api/chat/stream for real-time responses',
    redirectTo: '/api/chat/stream',
    timestamp: new Date().toISOString()
  });
});

// Health check for chat routes
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    service: 'Excel Chat Routes - Streaming Only',
    endpoints: {
      'POST /api/chat/stream': 'active - real-time streaming',
      'POST /api/chat': 'deprecated - redirects to stream'
    },
    timestamp: new Date().toISOString()
  });
});

/*
 * REMOVED ENDPOINTS - Now using streaming only
 *
 * The following endpoints have been removed in favor of streaming:
 * - router.post('/api/chat', ...) - Direct chat without streaming
 * - router.post('/api/generate', ...) - Code generation endpoint
 * - router.post('/api/direct', ...) - Direct Excel operations
 * - router.post('/api/execute', ...) - Execute operations endpoint
 *
 * All Excel AI operations now go through /api/chat/stream for:
 * - Real-time progress updates
 * - Better user experience
 * - Consistent credit management
 * - Unified error handling
 */

// Export the router using the existing convention
export { router as chatRoutes };

// Export types for use in other modules
export type { AuthenticatedRequest };