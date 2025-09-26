// Credit Management API Routes
import express, { Router } from 'express';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth';
import SimpleCreditSystem from '../services/creditSystem';
import { logger } from '../utils/logger';
import { ApiResponseHelper } from '../utils/apiResponse';

const router: Router = express.Router();

// Get user's credit balance (works for anonymous and logged-in users)
router.get('/balance', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.uid;
    const balance = await SimpleCreditSystem.getCreditBalance(userId);

    return ApiResponseHelper.success(res, balance, 'Credit balance retrieved successfully');

  } catch (error) {
    logger.error('Error fetching credit balance:', error);
    return ApiResponseHelper.serverError(res, 'Failed to fetch credit balance');
  }
});

// Initialize credit purchase with Paystack (requires authentication)
router.post('/purchase/init', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.uid;
    const email = req.user!.email;
    const { amount } = req.body;

    if (!amount || typeof amount !== 'number') {
      return ApiResponseHelper.validationError(res, [], 'Amount must be a number');
    }

    if (!email) {
      return ApiResponseHelper.validationError(res, [], 'Email address is required for payment');
    }

    const result = await SimpleCreditSystem.initiateCreditPurchase(userId, email, amount);

    if (result.success) {
      return ApiResponseHelper.success(res, result, 'Payment initiated successfully');
    } else {
      return ApiResponseHelper.error(res, 'PURCHASE_INIT_FAILED', result.message || 'Purchase initialization failed');
    }

  } catch (error) {
    logger.error('Error initiating credit purchase:', error);
    return ApiResponseHelper.error(res, 'PURCHASE_INIT_FAILED', (error as Error).message);
  }
});

// Complete credit purchase after payment verification
router.post('/purchase/complete', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { reference } = req.body;

    if (!reference || typeof reference !== 'string') {
      return ApiResponseHelper.validationError(res, [], 'Payment reference is required');
    }

    const result = await SimpleCreditSystem.completeCreditPurchase(reference);

    if (result.success) {
      return ApiResponseHelper.success(res, result, `Successfully added ${result.creditsPurchased} credits`);
    } else {
      return ApiResponseHelper.error(res, 'PURCHASE_COMPLETION_FAILED', result.message || 'Purchase completion failed');
    }

  } catch (error) {
    logger.error('Error completing credit purchase:', error);
    return ApiResponseHelper.error(res, 'PURCHASE_COMPLETION_FAILED', (error as Error).message);
  }
});

// Get pricing information
router.get('/pricing', async (req, res) => {
  try {
    const pricing = SimpleCreditSystem.getPricingInfo();

    return ApiResponseHelper.success(res, pricing, 'Pricing information retrieved successfully');

  } catch (error) {
    logger.error('Error fetching pricing info:', error);
    return ApiResponseHelper.serverError(res, 'Failed to fetch pricing information');
  }
});

// Estimate credits for a command
router.post('/estimate', async (req, res) => {
  try {
    const { command } = req.body;

    if (!command || typeof command !== 'string') {
      return ApiResponseHelper.validationError(res, [], 'Command must be a non-empty string');
    }

    const estimatedCredits = SimpleCreditSystem.estimateCreditsForCommand(command);

    return ApiResponseHelper.success(res, {
      estimatedCredits,
      command: command.substring(0, 100)
    }, 'Credit estimation completed successfully');

  } catch (error) {
    logger.error('Error estimating credits:', error);
    return ApiResponseHelper.serverError(res, 'Failed to estimate credits');
  }
});

// Transfer anonymous credits when user signs in
router.post('/transfer-anonymous', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.uid;

    await SimpleCreditSystem.transferAnonymousCredits(userId);

    const newBalance = await SimpleCreditSystem.getCreditBalance(userId);

    return ApiResponseHelper.success(res, newBalance, 'Anonymous credits transferred successfully');

  } catch (error) {
    logger.error('Error transferring anonymous credits:', error);
    return ApiResponseHelper.serverError(res, 'Failed to transfer credits');
  }
});

// Paystack webhook for payment notifications
router.post('/webhook/paystack', async (req, res) => {
  try {
    const PaystackService = (await import('../services/paystack')).default;

    // Verify webhook signature
    const signature = req.headers['x-paystack-signature'] as string;
    const payload = JSON.stringify(req.body);

    if (!PaystackService.validateWebhookSignature(payload, signature)) {
      logger.warn('Invalid Paystack webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = req.body;

    if (event.event === 'charge.success') {
      const reference = event.data.reference;
      logger.info(`Paystack webhook: Payment successful for ${reference}`);

      // Auto-complete the purchase
      try {
        const result = await SimpleCreditSystem.completeCreditPurchase(reference);
        if (result.success) {
          logger.info(`Credits automatically added via webhook: ${reference}`);
        }
      } catch (error) {
        logger.error(`Failed to auto-complete purchase via webhook: ${reference}`, error);
      }
    }

    res.status(200).json({ received: true });

  } catch (error) {
    logger.error('Paystack webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;