import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface CustomError extends Error {
  statusCode?: number;
  status?: number;
}

export const errorHandler = (
  error: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error('Error caught by error handler:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  // Default error
  let statusCode = error.statusCode || error.status || 500;
  let message = error.message || 'Internal Server Error';

  // Prisma errors
  if (error.message.includes('Unique constraint failed')) {
    statusCode = 400;
    message = 'Resource already exists';
  }

  if (error.message.includes('Record to update not found')) {
    statusCode = 404;
    message = 'Resource not found';
  }

  // JWT errors
  if (error.message.includes('jwt expired')) {
    statusCode = 401;
    message = 'Token expired';
  }

  if (error.message.includes('jwt malformed')) {
    statusCode = 401;
    message = 'Invalid token';
  }

  // Validation errors
  if (error.message.includes('validation failed')) {
    statusCode = 400;
  }

  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Internal Server Error';
  }

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { 
      stack: error.stack 
    })
  });
};