import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface CustomError extends Error {
  statusCode?: number;
  status?: number;
  code?: string;
}

export const errorHandler = (
  error: CustomError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  logger.error('Error caught by error handler:', {
    message: error.message,
    stack: error.stack,
    code: error.code,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Default error
  let statusCode = error.statusCode || error.status || 500;
  let message = error.message || 'Internal Server Error';
  let errorCode = 'INTERNAL_ERROR';

  // Firebase errors
  if (error.message.includes('auth/invalid-id-token')) {
    statusCode = 401;
    message = 'Invalid authentication token';
    errorCode = 'AUTH_INVALID_TOKEN';
  }

  if (error.message.includes('auth/id-token-expired')) {
    statusCode = 401;
    message = 'Authentication token expired';
    errorCode = 'AUTH_TOKEN_EXPIRED';
  }

  // Firebase Admin errors
  if (error.code === 'auth/user-not-found') {
    statusCode = 404;
    message = 'User not found';
    errorCode = 'USER_NOT_FOUND';
  }

  // Credit system errors
  if (error.message.includes('Insufficient credits')) {
    statusCode = 402;
    message = error.message;
    errorCode = 'INSUFFICIENT_CREDITS';
  }

  if (error.message.includes('Must be logged in to purchase credits')) {
    statusCode = 401;
    message = 'Authentication required for purchase';
    errorCode = 'AUTH_REQUIRED_FOR_PURCHASE';
  }

  // Payment errors
  if (error.message.includes('Payment')) {
    statusCode = 402;
    errorCode = 'PAYMENT_ERROR';
  }

  // Validation errors
  if (error.message.includes('validation failed') || error.message.includes('Invalid')) {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
  }

  // Rate limiting
  if (error.message.includes('Too many requests')) {
    statusCode = 429;
    errorCode = 'RATE_LIMITED';
  }

  // External API errors
  if (error.message.includes('API key') || error.message.includes('quota')) {
    statusCode = 503;
    message = 'AI service temporarily unavailable';
    errorCode = 'SERVICE_UNAVAILABLE';
  }

  // Network/timeout errors
  if (error.message.includes('timeout') || error.message.includes('ECONNREFUSED')) {
    statusCode = 503;
    message = 'Service temporarily unavailable';
    errorCode = 'CONNECTION_ERROR';
  }

  // File upload errors
  if (error.message.includes('File too large') || error.message.includes('LIMIT_FILE_SIZE')) {
    statusCode = 413;
    message = 'File size too large';
    errorCode = 'FILE_TOO_LARGE';
  }

  if (error.message.includes('File type not supported')) {
    statusCode = 415;
    message = 'File type not supported';
    errorCode = 'UNSUPPORTED_FILE_TYPE';
  }

  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Internal Server Error';
  }

  const response: any = {
    success: false,
    error: message,
    code: errorCode,
    timestamp: new Date().toISOString()
  };

  // Include additional debug info in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = error.stack;
    response.originalMessage = error.message;
  }

  res.status(statusCode).json(response);
};

// Async error wrapper
export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// 404 handler for unmatched routes
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    code: 'ROUTE_NOT_FOUND',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
};