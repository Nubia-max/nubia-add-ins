import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { 
  stripe, 
  createStripeCustomer, 
  createSubscription, 
  updateSubscription,
  cancelSubscription,
  SUBSCRIPTION_TIERS,
  getTierFromPriceId,
  constructWebhookEvent
} from '../utils/stripe';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// Get user's current subscription
export const getSubscription = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const subscription = await prisma.subscription.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    if (!subscription) {
      // Create trial subscription if none exists
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 30); // 30-day trial

      const newSubscription = await prisma.subscription.create({
        data: {
          userId,
          status: 'TRIAL',
          tier: 'TRIAL',
          automationsLimit: 10,
          billingPeriodEnd: trialEnd
        }
      });

      return res.json(newSubscription);
    }

    res.json(subscription);
  } catch (error) {
    logger.error('Get subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create new subscription (upgrade from trial)
export const createSubscriptionPlan = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { tier } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const tierConfig = SUBSCRIPTION_TIERS[tier];
    if (!tierConfig || tier === 'TRIAL') {
      return res.status(400).json({ error: 'Invalid subscription tier' });
    }

    // Get or create user
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create or get Stripe customer
    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const stripeCustomer = await createStripeCustomer(user.email);
      stripeCustomerId = stripeCustomer.id;
      
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId }
      });
    }

    // Create Stripe subscription
    const stripeSubscription = await createSubscription(stripeCustomerId, tierConfig.priceId);

    // Update database subscription
    const subscription = await prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        stripeSubscriptionId: stripeSubscription.id,
        stripePriceId: tierConfig.priceId,
        status: 'INCOMPLETE',
        tier,
        automationsLimit: tierConfig.automationsLimit
      },
      update: {
        stripeSubscriptionId: stripeSubscription.id,
        stripePriceId: tierConfig.priceId,
        status: 'INCOMPLETE',
        tier,
        automationsLimit: tierConfig.automationsLimit
      }
    });

    res.json({
      subscription,
      clientSecret: (stripeSubscription.latest_invoice as any)?.payment_intent?.client_secret
    });
  } catch (error) {
    logger.error('Create subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update subscription (upgrade/downgrade)
export const updateSubscriptionPlan = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { tier } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const tierConfig = SUBSCRIPTION_TIERS[tier];
    if (!tierConfig || tier === 'TRIAL') {
      return res.status(400).json({ error: 'Invalid subscription tier' });
    }

    const subscription = await prisma.subscription.findFirst({
      where: { userId }
    });

    if (!subscription?.stripeSubscriptionId) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    // Update Stripe subscription
    const stripeSubscription = await updateSubscription(
      subscription.stripeSubscriptionId,
      tierConfig.priceId
    );

    // Update database
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        stripePriceId: tierConfig.priceId,
        tier,
        automationsLimit: tierConfig.automationsLimit
      }
    });

    res.json(updatedSubscription);
  } catch (error) {
    logger.error('Update subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Cancel subscription
export const cancelSubscriptionPlan = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { cancelAtPeriodEnd = true } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const subscription = await prisma.subscription.findFirst({
      where: { userId }
    });

    if (!subscription?.stripeSubscriptionId) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    // Cancel Stripe subscription
    await cancelSubscription(subscription.stripeSubscriptionId, cancelAtPeriodEnd);

    // Update database
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelAtPeriodEnd,
        canceledAt: new Date()
      }
    });

    res.json(updatedSubscription);
  } catch (error) {
    logger.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get available subscription tiers
export const getSubscriptionTiers = async (req: Request, res: Response) => {
  res.json(SUBSCRIPTION_TIERS);
};

// Handle Stripe webhooks
export const handleStripeWebhook = async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature'] as string;
  
  try {
    const event = constructWebhookEvent(req.body, signature);
    logger.info('Stripe webhook event:', { type: event.type });

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object as any);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as any);
        break;
        
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as any);
        break;
        
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as any);
        break;
        
      default:
        logger.info('Unhandled webhook event type:', event.type);
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Webhook error:', error);
    res.status(400).json({ error: 'Webhook error' });
  }
};

// Helper functions for webhook handling
const handleSubscriptionUpdate = async (subscription: any) => {
  const tierConfig = getTierFromPriceId(subscription.items.data[0].price.id);
  if (!tierConfig) return;

  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      status: subscription.status.toUpperCase(),
      tier: tierConfig.tier,
      automationsLimit: tierConfig.automationsLimit,
      billingPeriodStart: new Date(subscription.current_period_start * 1000),
      billingPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    }
  });
};

const handleSubscriptionDeleted = async (subscription: any) => {
  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      status: 'CANCELED',
      canceledAt: new Date()
    }
  });
};

const handlePaymentSucceeded = async (invoice: any) => {
  // Reset monthly usage counter
  const subscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: invoice.subscription }
  });

  if (subscription) {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { automationsUsed: 0 }
    });
  }
};

const handlePaymentFailed = async (invoice: any) => {
  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: invoice.subscription },
    data: { status: 'PAST_DUE' }
  });
};