// Authentication Routes for User Session Management
import express, { Router } from 'express';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth';
import SimpleCreditSystem from '../services/creditSystem';
import { logger } from '../utils/logger';
import { ApiResponseHelper } from '../utils/apiResponse';

const router: Router = express.Router();

// Get current user session info
router.get('/session', async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user;

    if (!user) {
      return ApiResponseHelper.authError(res, 'No active session');
    }

    // Get user credit balance
    const creditBalance = await SimpleCreditSystem.getCreditBalance(user.uid);

    const sessionInfo = {
      user: {
        uid: user.uid,
        isAnonymous: user.isAnonymous,
        email: user.email,
        name: user.name
      },
      credits: {
        balance: creditBalance.credits,
        totalPurchased: creditBalance.totalPurchased,
        totalUsed: creditBalance.totalUsed,
        freeCreditsRemaining: creditBalance.freeCreditsRemaining
      },
      sessionActive: true,
      lastActivity: new Date().toISOString()
    };

    return ApiResponseHelper.success(res, sessionInfo, 'Session information retrieved successfully');

  } catch (error) {
    logger.error('Error fetching session info:', error);
    return ApiResponseHelper.serverError(res, 'Failed to fetch session information');
  }
});

// Refresh user session and transfer anonymous credits if needed
router.post('/refresh', async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user;

    if (!user) {
      return ApiResponseHelper.authError(res, 'No active session to refresh');
    }

    // If user just signed in (not anonymous) and there might be anonymous credits
    if (!user.isAnonymous && req.body.transferAnonymousCredits) {
      try {
        await SimpleCreditSystem.transferAnonymousCredits(user.uid);
        logger.info(`Anonymous credits transferred for user: ${user.uid}`);
      } catch (error) {
        logger.warn('Failed to transfer anonymous credits:', error);
        // Don't fail the session refresh for this
      }
    }

    // Get updated credit balance
    const creditBalance = await SimpleCreditSystem.getCreditBalance(user.uid);

    const refreshedSession = {
      user: {
        uid: user.uid,
        isAnonymous: user.isAnonymous,
        email: user.email,
        name: user.name
      },
      credits: {
        balance: creditBalance.credits,
        totalPurchased: creditBalance.totalPurchased,
        totalUsed: creditBalance.totalUsed,
        freeCreditsRemaining: creditBalance.freeCreditsRemaining
      },
      sessionRefreshed: true,
      timestamp: new Date().toISOString()
    };

    return ApiResponseHelper.success(res, refreshedSession, 'Session refreshed successfully');

  } catch (error) {
    logger.error('Error refreshing session:', error);
    return ApiResponseHelper.serverError(res, 'Failed to refresh session');
  }
});

// Validate authentication token
router.post('/validate', async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user;

    if (!user) {
      return ApiResponseHelper.authError(res, 'Invalid or expired token');
    }

    const validationResult = {
      valid: true,
      user: {
        uid: user.uid,
        isAnonymous: user.isAnonymous,
        email: user.email,
        name: user.name
      },
      tokenValid: !user.isAnonymous, // Anonymous users don't have real tokens
      timestamp: new Date().toISOString()
    };

    return ApiResponseHelper.success(res, validationResult, 'Token validation successful');

  } catch (error) {
    logger.error('Error validating token:', error);
    return ApiResponseHelper.serverError(res, 'Token validation failed');
  }
});

// Initialize anonymous session
router.post('/anonymous', async (req, res) => {
  try {
    const anonymousId = req.headers['x-anonymous-id'] as string || `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Get anonymous user credits
    const creditBalance = await SimpleCreditSystem.getCreditBalance(anonymousId);

    const anonymousSession = {
      user: {
        uid: anonymousId,
        isAnonymous: true
      },
      credits: {
        balance: creditBalance.credits,
        freeCreditsRemaining: creditBalance.freeCreditsRemaining
      },
      sessionCreated: true,
      timestamp: new Date().toISOString()
    };

    // Set the anonymous ID in response header for client to store
    res.setHeader('x-anonymous-id', anonymousId);

    return ApiResponseHelper.success(res, anonymousSession, 'Anonymous session created successfully');

  } catch (error) {
    logger.error('Error creating anonymous session:', error);
    return ApiResponseHelper.serverError(res, 'Failed to create anonymous session');
  }
});

// Sign out (mainly for cleanup)
router.post('/signout', async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user;

    if (user && !user.isAnonymous) {
      logger.info(`User signed out: ${user.uid}`);
    }

    const signoutResult = {
      signedOut: true,
      timestamp: new Date().toISOString()
    };

    return ApiResponseHelper.success(res, signoutResult, 'Signed out successfully');

  } catch (error) {
    logger.error('Error during signout:', error);
    return ApiResponseHelper.serverError(res, 'Signout failed');
  }
});

export default router;