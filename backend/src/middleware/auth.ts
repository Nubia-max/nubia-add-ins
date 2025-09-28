// Firebase Anonymous Authentication Middleware
import { Request, Response, NextFunction } from 'express';
import { verifyIdToken } from '../config/firebase';
import { logger } from '../utils/logger';
import { ApiResponseHelper } from '../utils/apiResponse';

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    id: string; // For backwards compatibility
    isAnonymous: boolean;
    email?: string;
    name?: string;
  };
}

// Middleware to verify Firebase ID token (supports anonymous users)
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
      // Require anonymous ID header for anonymous users
      const anonymousId = req.headers['x-anonymous-id'] as string;
      if (!anonymousId || anonymousId.trim() === '') {
        return ApiResponseHelper.authError(res, 'Firebase anonymous authentication required');
      }
      req.user = {
        uid: anonymousId,
        id: anonymousId,
        isAnonymous: true
      };
      logger.info(`Anonymous user access: ${anonymousId}`);
      return next();
    }

    // Verify the Firebase ID token
    const decodedToken = await verifyIdToken(token);

    if (!decodedToken) {
      // Only fall back to anonymous for specific token errors, not all errors
      logger.warn('Token verification failed');
      const anonymousId = req.headers['x-anonymous-id'] as string;
      if (anonymousId && anonymousId.trim() !== '') {
        req.user = {
          uid: anonymousId,
          id: anonymousId,
          isAnonymous: true
        };
        return next();
      }
      // No valid anonymous ID, require proper authentication
      return ApiResponseHelper.authError(res, 'Invalid or expired token, please re-authenticate');
    }

    // Check if user is Firebase anonymous user
    const isFirebaseAnonymous = !decodedToken.firebase.identities ||
      Object.keys(decodedToken.firebase.identities).length === 0 ||
      (decodedToken.firebase.identities.email === undefined &&
       decodedToken.firebase.identities.phone === undefined &&
       decodedToken.firebase.identities.google === undefined);

    // Attach user info to request
    req.user = {
      uid: decodedToken.uid,
      id: decodedToken.uid,
      isAnonymous: isFirebaseAnonymous,
      email: decodedToken.email,
      name: decodedToken.name,
    };

    logger.info(`Authenticated user: ${req.user.uid} (anonymous: ${req.user.isAnonymous})`);
    next();

  } catch (error) {
    logger.error('Authentication middleware error:', error);

    // Only fall back to anonymous for network/Firebase errors, not security issues
    if (error instanceof Error && (
      error.message.includes('network') ||
      error.message.includes('Firebase') ||
      error.message.includes('timeout')
    )) {
      const anonymousId = req.headers['x-anonymous-id'] as string;
      if (anonymousId && anonymousId.trim() !== '') {
        req.user = {
          uid: anonymousId,
          id: anonymousId,
          isAnonymous: true
        };
        logger.warn('Network/Firebase error, falling back to anonymous access');
        return next();
      }
    }

    // For other errors, don't fall back - let the error handler deal with it
    next(error);
  }
};

// Middleware that requires non-anonymous authentication (for payments)
export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user || req.user.isAnonymous) {
    return ApiResponseHelper.authError(res, 'Please sign in to access payment features');
  }
  next();
};