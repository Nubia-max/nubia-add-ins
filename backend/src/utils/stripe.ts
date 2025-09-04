import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is required');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18',
  typescript: true,
});

// Subscription tier configuration
export interface SubscriptionTierConfig {
  tier: string;
  name: string;
  priceId: string;
  automationsLimit: number;
  monthlyPrice: number;
  features: string[];
}

export const SUBSCRIPTION_TIERS: Record<string, SubscriptionTierConfig> = {
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
    priceId: process.env.STRIPE_STARTER_PRICE_ID || '',
    automationsLimit: 100,
    monthlyPrice: 9,
    features: ['100 Excel automations', 'All templates', 'Priority email support', 'Custom macros']
  },
  PRO: {
    tier: 'PRO',
    name: 'Pro',
    priceId: process.env.STRIPE_PRO_PRICE_ID || '',
    automationsLimit: -1, // Unlimited
    monthlyPrice: 29,
    features: ['Unlimited automations', 'Advanced templates', '24/7 chat support', 'API access', 'Team collaboration']
  },
  ENTERPRISE: {
    tier: 'ENTERPRISE',
    name: 'Enterprise',
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || '',
    automationsLimit: -1, // Unlimited
    monthlyPrice: 99,
    features: ['Everything in Pro', 'Dedicated support', 'SSO integration', 'Custom integrations', 'SLA guarantee']
  }
};

// Helper functions
export const createStripeCustomer = async (email: string, name?: string) => {
  return await stripe.customers.create({
    email,
    name,
    metadata: {
      source: 'nubia-app'
    }
  });
};

export const createSubscription = async (customerId: string, priceId: string) => {
  return await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: {
      save_default_payment_method: 'on_subscription'
    },
    expand: ['latest_invoice.payment_intent'],
  });
};

export const updateSubscription = async (subscriptionId: string, newPriceId: string) => {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  
  return await stripe.subscriptions.update(subscriptionId, {
    items: [{
      id: subscription.items.data[0].id,
      price: newPriceId,
    }],
    proration_behavior: 'create_prorations',
  });
};

export const cancelSubscription = async (subscriptionId: string, cancelAtPeriodEnd: boolean = true) => {
  if (cancelAtPeriodEnd) {
    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  } else {
    return await stripe.subscriptions.cancel(subscriptionId);
  }
};

export const createPaymentIntent = async (amount: number, customerId: string, currency: string = 'usd') => {
  return await stripe.paymentIntents.create({
    amount: amount * 100, // Convert to cents
    currency,
    customer: customerId,
    automatic_payment_methods: {
      enabled: true,
    },
  });
};

export const constructWebhookEvent = (payload: string, signature: string) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET environment variable is required');
  }
  
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
};

export const getTierFromPriceId = (priceId: string): SubscriptionTierConfig | null => {
  for (const [key, config] of Object.entries(SUBSCRIPTION_TIERS)) {
    if (config.priceId === priceId) {
      return config;
    }
  }
  return null;
};