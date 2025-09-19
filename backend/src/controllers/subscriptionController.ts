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

// Create/upgrade subscription
export const createSubscription = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { tier, priceId } = req.body;

    if (!tier) {
      return res.status(400).json({ error: 'Subscription tier is required' });
    }

    // Get tier limits
    const tierLimits = {
      free: { limit: 10, price: 0 },
      starter: { limit: 100, price: 9 },
      pro: { limit: -1, price: 29 },
      enterprise: { limit: -1, price: 99 }
    };

    const limits = tierLimits[tier as keyof typeof tierLimits];
    if (!limits) {
      return res.status(400).json({ error: 'Invalid subscription tier' });
    }

    // Get existing subscription
    let subscription = await firebaseService.getSubscriptionByUserId(userId);

    if (subscription) {
      // Update existing subscription
      await firebaseService.updateSubscription(subscription.id, {
        tier,
        status: 'active',
        automationsLimit: limits.limit,
        billingPeriodStart: new Date(),
        billingPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });
      // Get updated subscription
      subscription = await firebaseService.getSubscriptionByUserId(userId);
    } else {
      // Create new subscription
      subscription = await firebaseService.createSubscription({
        userId,
        status: 'active',
        tier,
        automationsLimit: limits.limit,
        automationsUsed: 0,
        billingPeriodStart: new Date(),
        billingPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });
    }

    logger.info(`Created/updated subscription for user: ${userId} to tier: ${tier}`);
    res.json(subscription);
  } catch (error) {
    logger.error('Create subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update subscription
export const updateSubscription = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { tier, status } = req.body;

    const subscription = await firebaseService.getSubscriptionByUserId(userId);
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    const updates: any = {};
    if (tier) {
      const tierLimits = {
        free: 10,
        starter: 100,
        pro: -1,
        enterprise: -1
      };
      updates.tier = tier;
      updates.automationsLimit = tierLimits[tier as keyof typeof tierLimits];
    }
    if (status) updates.status = status;

    const updatedSubscription = await firebaseService.updateSubscription(subscription.id, updates);

    logger.info(`Updated subscription for user: ${userId}`);
    res.json(updatedSubscription);
  } catch (error) {
    logger.error('Update subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Cancel subscription
export const cancelSubscription = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const subscription = await firebaseService.getSubscriptionByUserId(userId);
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    // Downgrade to free tier instead of deleting
    const cancelledSubscription = await firebaseService.updateSubscription(subscription.id, {
      tier: 'free',
      status: 'cancelled',
      automationsLimit: 10,
      billingPeriodStart: new Date(),
      billingPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    logger.info(`Cancelled subscription for user: ${userId}`);
    res.json(cancelledSubscription);
  } catch (error) {
    logger.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Reset automation usage count to 0 (for fixing usage counting issues)
export const resetUsage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get current subscription
    const subscription = await firebaseService.getSubscriptionByUserId(userId);
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    // Reset automations used to 0
    const updatedSubscription = await firebaseService.updateSubscription(subscription.id, {
      automationsUsed: 0
    });

    logger.info(`Reset automation usage for user: ${userId}`);

    res.json({
      success: true,
      message: 'Automation usage reset to 0',
      subscription: updatedSubscription
    });
  } catch (error) {
    logger.error('Reset usage error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};