import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

const prisma = new PrismaClient();

// Get user's current subscription
export const getCurrentSubscription = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    let subscription = await prisma.subscription.findFirst({
      where: { userId }
    });

    if (!subscription) {
      // Create trial subscription if none exists
      subscription = await prisma.subscription.create({
        data: {
          userId,
          status: 'TRIAL',
          tier: 'TRIAL',
          automationsLimit: 10,
          automationsUsed: 0,
          billingPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        }
      });
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
    TRIAL: {
      tier: 'TRIAL',
      name: 'Free Trial',
      priceId: '',
      automationsLimit: 10,
      monthlyPrice: 0,
      features: ['10 Excel automations', 'Basic templates', 'Email support']
    },
    STARTER: {
      tier: 'STARTER',
      name: 'Starter',
      priceId: 'price_starter',
      automationsLimit: 100,
      monthlyPrice: 9,
      features: ['100 Excel automations', 'All templates', 'Priority email support', 'Custom macros']
    },
    PRO: {
      tier: 'PRO',
      name: 'Pro',
      priceId: 'price_pro',
      automationsLimit: -1,
      monthlyPrice: 29,
      features: ['Unlimited automations', 'Advanced templates', '24/7 chat support', 'API access', 'Team collaboration']
    },
    ENTERPRISE: {
      tier: 'ENTERPRISE',
      name: 'Enterprise',
      priceId: 'price_enterprise',
      automationsLimit: -1,
      monthlyPrice: 99,
      features: ['Everything in Pro', 'Dedicated support', 'SSO integration', 'Custom integrations', 'SLA guarantee']
    }
  });
};