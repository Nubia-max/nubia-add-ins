import { Request, Response } from 'express';
import { firebaseService } from '../services/firebase';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth';

// Get user's current subscription
export const getCurrentSubscription = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    let subscription = await firebaseService.getSubscriptionByUserId(userId);

    if (!subscription) {
      // Create free tier subscription if none exists
      subscription = await firebaseService.createSubscription({
        userId,
        status: 'active',
        tier: 'free',
        automationsLimit: 10,
        automationsUsed: 0,
        billingPeriodStart: new Date(),
        billingPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      });
      logger.info(`Created free subscription for user: ${userId}`);
    }

    res.json(subscription);
  } catch (error) {
    logger.error('Get subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get available subscription tiers
export const getSubscriptionTiers = async (req: Request, res: Response) => {
  res.json({
    free: {
      tier: 'free',
      name: 'Free',
      priceId: '',
      automationsLimit: 10,
      monthlyPrice: 0,
      features: ['10 Excel automations', 'Basic templates', 'Email support']
    },
    starter: {
      tier: 'starter',
      name: 'Starter',
      priceId: 'price_starter',
      automationsLimit: 100,
      monthlyPrice: 9,
      features: ['100 Excel automations', 'All templates', 'Priority email support', 'Custom macros']
    },
    pro: {
      tier: 'pro',
      name: 'Pro',
      priceId: 'price_pro',
      automationsLimit: -1,
      monthlyPrice: 29,
      features: ['Unlimited automations', 'Advanced templates', '24/7 chat support', 'API access', 'Team collaboration']
    },
    enterprise: {
      tier: 'enterprise',
      name: 'Enterprise',
      priceId: 'price_enterprise',
      automationsLimit: -1,
      monthlyPrice: 99,
      features: ['Everything in Pro', 'Dedicated support', 'SSO integration', 'Custom integrations', 'SLA guarantee']
    }
  });
};