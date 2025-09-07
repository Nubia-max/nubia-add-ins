import { Router } from 'express';
import { body } from 'express-validator';
import {
  getCurrentSubscription,
  getSubscriptionTiers
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
router.get('/current', auth, getCurrentSubscription);
router.get('/tiers', getSubscriptionTiers);

export { router as subscriptionRoutes };