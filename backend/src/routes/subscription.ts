import { Router } from 'express';
import { body } from 'express-validator';
import {
  getSubscription,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  cancelSubscriptionPlan,
  getSubscriptionTiers,
  handleStripeWebhook
} from '../controllers/subscriptionController';
import { auth } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';

const router = Router();

// Validation rules
const subscriptionTierValidation = [
  body('tier')
    .isIn(['STARTER', 'PRO', 'ENTERPRISE'])
    .withMessage('Invalid subscription tier')
];

// Routes
router.get('/current', auth, getSubscription);
router.get('/tiers', getSubscriptionTiers);
router.post('/create', auth, subscriptionTierValidation, validateRequest, createSubscriptionPlan);
router.put('/update', auth, subscriptionTierValidation, validateRequest, updateSubscriptionPlan);
router.post('/cancel', auth, cancelSubscriptionPlan);

// Stripe webhook (no auth needed)
router.post('/webhook', handleStripeWebhook);

export { router as subscriptionRoutes };