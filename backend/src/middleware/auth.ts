// Firebase Authentication Middleware
import { Request, Response, NextFunction } from 'express';
import { verifyIdToken } from '../config/firebase';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    id: string; // For backwards compatibility
    email: string;
    name?: string;
    picture?: string;
  };
}

// Middleware to verify Firebase ID token (allows anonymous access)
export const auth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

    if (!token) {
      // Allow anonymous usage (they get 10 free credits)
      logger.info('Request without authentication token - allowing anonymous access');
      return next();
    }

    // Verify the Firebase ID token
    const decodedToken = await verifyIdToken(token);

    if (!decodedToken) {
      return res.status(401).json({
        error: 'Invalid authentication token',
        message: 'Please sign in again'
      });
    }

    // Attach user info to request
    req.user = {
      uid: decodedToken.uid,
      id: decodedToken.uid, // For backwards compatibility
      email: decodedToken.email || '',
      name: decodedToken.name,
      picture: decodedToken.picture,
    };

    logger.info(`Authenticated user: ${req.user.uid} (${req.user.email})`);
    next();

  } catch (error) {
    logger.error('Authentication middleware error:', error);
    return res.status(401).json({
      error: 'Authentication failed',
      message: 'Please sign in again'
    });
  }
};

// Middleware that requires authentication (no anonymous access)
export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please sign in to access this feature'
    });
  }
  next();
};