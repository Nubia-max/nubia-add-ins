// Security Middleware for Production
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { logger } from '../utils/logger';

// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Content Security Policy
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://appsforoffice.microsoft.com https://www.gstatic.com; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' https://api.paystack.co https://identitytoolkit.googleapis.com; " +
    "frame-src 'none'; " +
    "object-src 'none';"
  );

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // XSS Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // HTTPS only (in production)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  next();
};

// Request size limits
export const requestSizeLimits = (req: Request, res: Response, next: NextFunction) => {
  const maxSizes = {
    '/api/chat': 50 * 1024 * 1024, // 50MB for file uploads
    '/api/credits': 1 * 1024 * 1024, // 1MB for payment data
    default: 10 * 1024 * 1024 // 10MB default
  };

  const path = req.path;
  let maxSize = maxSizes.default;

  for (const [routePath, size] of Object.entries(maxSizes)) {
    if (path.startsWith(routePath)) {
      maxSize = size;
      break;
    }
  }

  if (req.headers['content-length']) {
    const contentLength = parseInt(req.headers['content-length']);
    if (contentLength > maxSize) {
      return res.status(413).json({
        success: false,
        error: 'Request entity too large',
        code: 'REQUEST_TOO_LARGE',
        maxSize: `${Math.floor(maxSize / 1024 / 1024)}MB`,
        receivedSize: `${Math.floor(contentLength / 1024 / 1024)}MB`,
        timestamp: new Date().toISOString()
      });
    }
  }

  next();
};

// Suspicious activity detection
const suspiciousActivity = new Map<string, {
  requests: number[];
  patterns: string[];
  blocked: boolean;
  blockUntil?: number;
}>();

export const detectSuspiciousActivity = (req: Request, res: Response, next: NextFunction) => {
  const clientId = (req.ip || 'unknown') + (req.headers['x-anonymous-id'] || '');
  const now = Date.now();
  const suspiciousPatterns = [
    /(\.\.|\/\/|<script|javascript:|eval\(|document\.|window\.|alert\()/i,
    /(union\s+select|drop\s+table|insert\s+into|delete\s+from)/i,
    /(base64|atob|btoa|fromcharcode)/i
  ];

  let activity = suspiciousActivity.get(clientId);
  if (!activity) {
    activity = { requests: [], patterns: [], blocked: false };
    suspiciousActivity.set(clientId, activity);
  }

  // Check if currently blocked
  if (activity.blocked && activity.blockUntil && now < activity.blockUntil) {
    return res.status(403).json({
      success: false,
      error: 'Temporarily blocked due to suspicious activity',
      code: 'TEMPORARILY_BLOCKED',
      retryAfter: Math.ceil((activity.blockUntil - now) / 1000),
      timestamp: new Date().toISOString()
    });
  }

  // Reset if block period expired
  if (activity.blocked && activity.blockUntil && now >= activity.blockUntil) {
    activity.blocked = false;
    activity.blockUntil = undefined;
    activity.requests = [];
    activity.patterns = [];
  }

  // Clean old requests (keep last 5 minutes)
  const fiveMinutesAgo = now - 5 * 60 * 1000;
  activity.requests = activity.requests.filter(time => time > fiveMinutesAgo);

  activity.requests.push(now);

  // Check for suspicious patterns in request
  const requestText = JSON.stringify({
    url: req.url,
    body: req.body,
    query: req.query
  }).toLowerCase();

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestText)) {
      activity.patterns.push(pattern.source);
      logger.warn('Suspicious pattern detected:', {
        clientId,
        pattern: pattern.source,
        url: req.url,
        userAgent: req.get('User-Agent')
      });
      break;
    }
  }

  // Block if too many requests or suspicious patterns
  if (activity.requests.length > 100 || activity.patterns.length > 5) {
    activity.blocked = true;
    activity.blockUntil = now + 15 * 60 * 1000; // Block for 15 minutes

    logger.error('Client blocked for suspicious activity:', {
      clientId,
      requestCount: activity.requests.length,
      patternCount: activity.patterns.length,
      patterns: activity.patterns
    });

    return res.status(403).json({
      success: false,
      error: 'Blocked due to suspicious activity',
      code: 'BLOCKED_SUSPICIOUS_ACTIVITY',
      timestamp: new Date().toISOString()
    });
  }

  next();
};

// Anonymous user limits
export const anonymousLimits = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user || !req.user.isAnonymous) {
    return next(); // Skip for authenticated users
  }

  // Stricter limits for anonymous users
  const anonymousLimits = {
    '/api/chat': 20, // 20 requests per hour
    '/api/credits/balance': 100, // 100 requests per hour
    default: 50 // 50 requests per hour
  };

  const clientId = 'anon_' + (req.ip || 'unknown');
  const hourStart = Date.now() - 60 * 60 * 1000; // 1 hour ago

  // This would typically use Redis in production
  const key = `${clientId}:${req.path}:${Date.now()}`;

  // For now, use simple in-memory tracking
  // In production, implement with Redis or database

  next();
};

// Prevent credit manipulation
export const preventCreditManipulation = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // Only allow credit changes through proper endpoints
  const creditEndpoints = ['/api/credits/purchase/init', '/api/credits/purchase/complete', '/api/credits/webhook/paystack'];

  if (req.body && typeof req.body === 'object') {
    const suspiciousFields = ['credits', 'balance', 'totalPurchased', 'isAnonymous'];

    for (const field of suspiciousFields) {
      if (req.body.hasOwnProperty(field) && !creditEndpoints.includes(req.path)) {
        logger.warn('Attempt to manipulate credit fields:', {
          clientId: (req.ip || 'unknown') + (req.user?.uid || ''),
          field,
          value: req.body[field],
          path: req.path,
          userAgent: req.get('User-Agent')
        });

        return res.status(403).json({
          success: false,
          error: 'Forbidden field manipulation',
          code: 'FIELD_MANIPULATION_DETECTED',
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  next();
};

// Clean up security tracking data periodically
setInterval(() => {
  const now = Date.now();
  const cleanupTime = now - 24 * 60 * 60 * 1000; // 24 hours ago

  for (const [clientId, activity] of suspiciousActivity.entries()) {
    if (!activity.blocked && activity.requests.every(time => time < cleanupTime)) {
      suspiciousActivity.delete(clientId);
    }
  }

  logger.debug(`Security cleanup: ${suspiciousActivity.size} clients being tracked`);
}, 60 * 60 * 1000); // Clean up every hour

export default {
  securityHeaders,
  requestSizeLimits,
  detectSuspiciousActivity,
  anonymousLimits,
  preventCreditManipulation
};