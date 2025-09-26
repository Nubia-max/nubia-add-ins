// Standardized API Response Utilities
import { Response } from 'express';
import { logger } from './logger';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
  requestId?: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  timestamp: string;
  requestId?: string;
  stack?: string; // Only in development
}

/**
 * Standardized API Response Helper Class
 * Provides consistent response formats across all API endpoints
 */
export class ApiResponseHelper {
  /**
   * Send successful response with standardized format
   * @param res - Express Response object
   * @param data - Response data payload
   * @param message - Success message
   * @param statusCode - HTTP status code (default: 200)
   * @returns Express Response
   */
  static success<T>(res: Response, data?: T, message?: string, statusCode = 200): Response {
    const response: ApiResponse<T> = {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId
    };

    return res.status(statusCode).json(response);
  }

  /**
   * Send error response
   */
  static error(
    res: Response,
    error: string,
    message?: string,
    statusCode = 400,
    includeStack = false
  ): Response {
    const response: ErrorResponse = {
      success: false,
      error,
      message: message || error,
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId
    };

    // Include stack trace only in development
    if (includeStack && process.env.NODE_ENV === 'development') {
      response.stack = new Error().stack;
    }

    logger.error('API Error Response:', {
      error,
      message,
      statusCode,
      requestId: res.locals.requestId
    });

    return res.status(statusCode).json(response);
  }

  /**
   * Send validation error response
   */
  static validationError(res: Response, errors: any[], message = 'Validation failed'): Response {
    return this.error(res, 'VALIDATION_ERROR', message, 422);
  }

  /**
   * Send authentication error response
   */
  static authError(res: Response, message = 'Authentication required'): Response {
    return this.error(res, 'AUTH_ERROR', message, 401);
  }

  /**
   * Send authorization error response
   */
  static forbiddenError(res: Response, message = 'Access forbidden'): Response {
    return this.error(res, 'FORBIDDEN_ERROR', message, 403);
  }

  /**
   * Send not found error response
   */
  static notFoundError(res: Response, message = 'Resource not found'): Response {
    return this.error(res, 'NOT_FOUND_ERROR', message, 404);
  }

  /**
   * Send rate limit error response
   */
  static rateLimitError(res: Response, message = 'Rate limit exceeded'): Response {
    return this.error(res, 'RATE_LIMIT_ERROR', message, 429);
  }

  /**
   * Send server error response
   */
  static serverError(res: Response, message = 'Internal server error'): Response {
    return this.error(res, 'SERVER_ERROR', message, 500);
  }

  /**
   * Send credit insufficient error response
   */
  static creditError(
    res: Response,
    required: number,
    available: number,
    message?: string
  ): Response {
    const defaultMessage = `Insufficient credits. Required: ${required}, Available: ${available}`;

    const response = {
      success: false,
      error: 'CREDITS_EXHAUSTED',
      message: message || defaultMessage,
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId,
      requiredCredits: required,
      availableCredits: available,
      action: available === 0 ? 'SHOW_LOGIN' : 'PURCHASE_CREDITS'
    };

    return res.status(402).json(response);
  }
}

// Middleware to add request ID
export const addRequestId = (req: any, res: any, next: any) => {
  res.locals.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  next();
};