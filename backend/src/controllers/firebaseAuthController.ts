import { Request, Response } from 'express';
import { firebaseService } from '../services/firebase';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth';

// Note: User registration and login is now handled client-side by Firebase Auth SDK
// These endpoints are for getting user profile and managing server-side user data

export const getProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userEmail = req.user?.email;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get user data from Firestore
    let user = await firebaseService.getUserById(userId);

    if (!user) {
      // Create user if doesn't exist (first time login)
      user = await firebaseService.createUser({
        email: userEmail || '',
        settings: JSON.stringify({
          automationMode: 'visual',
          notifications: true,
          autoMinimize: false
        })
      });
    }

    // Get subscription data
    const subscription = await firebaseService.getSubscriptionByUserId(userId);

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        settings: user.settings,
        createdAt: user.createdAt
      },
      subscription: subscription ? {
        tier: subscription.tier,
        status: subscription.status,
        automationsLimit: subscription.automationsLimit,
        automationsUsed: subscription.automationsUsed,
        billingPeriodEnd: subscription.billingPeriodEnd
      } : null
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    return res.status(500).json({
      error: 'Internal server error'
    });
  }
};

export const updateProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { settings } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    await firebaseService.updateUser(userId, {
      settings: typeof settings === 'string' ? settings : JSON.stringify(settings)
    });

    logger.info(`Profile updated for user: ${req.user?.email}`);

    return res.json({
      success: true,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    return res.status(500).json({
      error: 'Internal server error'
    });
  }
};

export const initializeSubscription = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if subscription already exists
    const existingSubscription = await firebaseService.getSubscriptionByUserId(userId);

    if (existingSubscription) {
      return res.json({
        subscription: existingSubscription,
        message: 'Subscription already exists'
      });
    }

    // Create default subscription (free tier)
    const subscription = await firebaseService.createSubscription({
      userId,
      status: 'active',
      tier: 'free',
      automationsLimit: 10,
      automationsUsed: 0,
      billingPeriodStart: new Date(),
      billingPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    });

    logger.info(`Default subscription created for user: ${req.user?.email}`);

    return res.json({
      subscription,
      message: 'Default subscription created'
    });
  } catch (error) {
    logger.error('Initialize subscription error:', error);
    return res.status(500).json({
      error: 'Internal server error'
    });
  }
};

// Verification endpoint for client-side auth state
export const verifyAuth = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // If middleware passes, user is authenticated
    return res.json({
      authenticated: true,
      user: {
        id: req.user?.id,
        email: req.user?.email
      }
    });
  } catch (error) {
    logger.error('Verify auth error:', error);
    return res.status(500).json({
      error: 'Internal server error'
    });
  }
};

export default {
  getProfile,
  updateProfile,
  initializeSubscription,
  verifyAuth
};