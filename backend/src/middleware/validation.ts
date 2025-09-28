// Request Validation Middleware
import { Request, Response, NextFunction } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { logger } from '../utils/logger';

// Validation error handler
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation failed:', {
      url: req.url,
      method: req.method,
      errors: errors.array(),
      body: req.body
    });

    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errors.array().map(error => ({
        field: error.type === 'field' ? error.path : 'unknown',
        message: error.msg,
        value: error.type === 'field' ? error.value : undefined
      })),
      timestamp: new Date().toISOString()
    });
  }
  next();
};

// Common validation rules
export const validateCommand = [
  body('userCommand')
    .notEmpty()
    .withMessage('Command is required')
    .isString()
    .withMessage('Command must be a string')
    .isLength({ min: 1, max: 5000 })
    .withMessage('Command must be between 1 and 5000 characters')
    .trim(),

  body('model')
    .optional()
    .isString()
    .withMessage('Model must be a string')
    .isIn(['deepseek-chat', 'deepseek-reasoner', 'gpt-4'])
    .withMessage('Invalid model selected'),

  body('files')
    .optional()
    .isArray()
    .withMessage('Files must be an array'),

  handleValidationErrors
];

export const validateCreditPurchase = [
  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isFloat({ min: 2, max: 100 })
    .withMessage('Amount must be between $2 and $100'),

  handleValidationErrors
];

export const validatePaymentReference = [
  body('reference')
    .notEmpty()
    .withMessage('Payment reference is required')
    .isString()
    .withMessage('Reference must be a string')
    .matches(/^moose_[a-zA-Z0-9_]+$/)
    .withMessage('Invalid payment reference format'),

  handleValidationErrors
];

export const validateCreditEstimate = [
  body('command')
    .notEmpty()
    .withMessage('Command is required')
    .isString()
    .withMessage('Command must be a string')
    .isLength({ min: 1, max: 1000 })
    .withMessage('Command must be between 1 and 1000 characters')
    .trim(),

  handleValidationErrors
];

// File upload validation
export const validateFileUpload = (req: Request, res: Response, next: NextFunction) => {
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'text/plain'
  ];

  if (req.files && Array.isArray(req.files)) {
    for (const file of req.files) {
      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(415).json({
          success: false,
          error: `File type ${file.mimetype} not supported`,
          code: 'UNSUPPORTED_FILE_TYPE',
          supportedTypes: allowedTypes,
          timestamp: new Date().toISOString()
        });
      }

      if (file.size > 10 * 1024 * 1024) { // 10MB
        return res.status(413).json({
          success: false,
          error: 'File size exceeds 10MB limit',
          code: 'FILE_TOO_LARGE',
          maxSize: '10MB',
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  next();
};

// Sanitize user input
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  // Remove potentially dangerous HTML/script tags from string fields
  const sanitizeString = (str: string) => {
    if (typeof str !== 'string') return str;
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed[^>]*>/gi, '')
      .trim();
  };

  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      return sanitizeString(obj);
    } else if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    } else if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value);
      }
      return sanitized;
    }
    return obj;
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  next();
};

// Rate limiting validation
export const validateRateLimit = (windowMs: number, max: number, message?: string) => {
  const attempts = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const clientId = (req.ip || 'unknown') + (req.headers['x-anonymous-id'] || '');
    const now = Date.now();
    const windowStart = now - windowMs;

    let clientAttempts = attempts.get(clientId);

    // Clean up expired entries
    if (!clientAttempts || clientAttempts.resetTime < now) {
      clientAttempts = { count: 0, resetTime: now + windowMs };
      attempts.set(clientId, clientAttempts);
    }

    clientAttempts.count++;

    if (clientAttempts.count > max) {
      const timeUntilReset = Math.ceil((clientAttempts.resetTime - now) / 1000);

      return res.status(429).json({
        success: false,
        error: message || 'Too many requests',
        code: 'RATE_LIMITED',
        retryAfter: timeUntilReset,
        limit: max,
        windowMs,
        timestamp: new Date().toISOString()
      });
    }

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - clientAttempts.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(clientAttempts.resetTime / 1000));

    next();
  };
};

export default {
  handleValidationErrors,
  validateCommand,
  validateCreditPurchase,
  validatePaymentReference,
  validateCreditEstimate,
  validateFileUpload,
  sanitizeInput,
  validateRateLimit
};