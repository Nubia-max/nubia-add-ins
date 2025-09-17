import { Request, Response } from 'express';
import { firebaseService } from '../services/firebase';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth';

// These endpoints guide the frontend to use Firebase client SDK for authentication
export const register = async (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Use Firebase client SDK for user registration',
    authMethod: 'firebase',
    config: {
      projectId: process.env.FIREBASE_PROJECT_ID,
      authDomain: `${process.env.FIREBASE_PROJECT_ID}.firebaseapp.com`
    }
  });
};

export const login = async (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Use Firebase client SDK for authentication',
    authMethod: 'firebase',
    config: {
      projectId: process.env.FIREBASE_PROJECT_ID,
      authDomain: `${process.env.FIREBASE_PROJECT_ID}.firebaseapp.com`
    }
  });
};

export const getProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const user = await firebaseService.getUserById(userId);

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        settings: user.settings,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    return res.status(500).json({
      error: 'Internal server error'
    });
  }
};