import { Request, Response, NextFunction } from 'express';
import { firebaseService } from '../services/firebase';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    firebaseUid: string;
  };
}

export const auth = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'No token provided or invalid format'
      });
      return;
    }

    const idToken = authHeader.replace('Bearer ', '');

    try {
      // Verify Firebase ID token
      const decodedToken = await firebaseService.verifyIdToken(idToken);

      // Get or create user in Firestore
      let user = await firebaseService.getUserByFirebaseUid(decodedToken.uid);

      if (!user) {
        // Create new user if they don't exist
        user = await firebaseService.createUser({
          firebaseUid: decodedToken.uid,
          email: decodedToken.email || '',
          settings: {
            automationMode: 'visual',
            notifications: true,
            autoMinimize: false
          }
        });
      }

      // Attach user info to request object
      req.user = {
        id: user.id,
        email: user.email,
        firebaseUid: user.firebaseUid
      };

      next();
    } catch (firebaseError) {
      logger.error('Firebase token verification error:', firebaseError);
      res.status(401).json({
        error: 'Invalid or expired token'
      });
      return;
    }
  } catch (error) {
    logger.error('Auth middleware error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};