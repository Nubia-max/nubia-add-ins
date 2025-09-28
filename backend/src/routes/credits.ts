// Credit Management API Routes
import express, { Router } from 'express';
import { AuthenticatedRequest, requireAuth, auth } from '../middleware/auth';
import SimpleCreditSystem from '../services/creditSystem';
import { logger } from '../utils/logger';
import { ApiResponseHelper } from '../utils/apiResponse';

const router: Router = express.Router();

// Create separate router for public routes (webhooks, callbacks)
export const publicCreditRoutes: Router = express.Router();

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

// Initialize credit purchase with Paystack (supports anonymous users)
router.post('/purchase/init', auth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.uid || 'anonymous';
    const email = req.user?.email || `${userId}@anonymous.nubia.app`;
    const { amount, currency = 'NGN' } = req.body;

    if (!amount || typeof amount !== 'number') {
      return ApiResponseHelper.validationError(res, [], 'Amount must be a number');
    }

    // Only NGN supported for unregistered business accounts
    if (currency && currency !== 'NGN') {
      return ApiResponseHelper.validationError(res, [], 'Only NGN currency is supported. International customers can pay in USD and their bank will convert to NGN.');
    }

    const result = await SimpleCreditSystem.initiateCreditPurchase(userId, email, amount, currency);

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

// Complete credit purchase after payment verification (PUBLIC ROUTE for webhooks)
publicCreditRoutes.post('/purchase/complete', async (req, res) => {
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
router.get('/pricing', async (_req, res) => {
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

// Payment success callback page (PUBLIC ROUTE)
publicCreditRoutes.get('/payment-callback', async (req, res) => {
  const { trxref, reference } = req.query;

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payment Successful - Nubia</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 600px;
          margin: 50px auto;
          padding: 20px;
          text-align: center;
          background: #f5f5f5;
        }
        .success-box {
          background: white;
          padding: 40px;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .success-icon { font-size: 60px; color: #28a745; margin-bottom: 20px; }
        .success-title { color: #28a745; font-size: 24px; margin-bottom: 15px; }
        .success-message { color: #666; margin-bottom: 30px; line-height: 1.6; }
        .close-btn {
          background: #007ACC;
          color: white;
          border: none;
          padding: 12px 30px;
          border-radius: 5px;
          cursor: pointer;
          font-size: 16px;
        }
        .close-btn:hover { background: #005a9e; }
      </style>
    </head>
    <body>
      <div class="success-box">
        <div class="success-icon">✅</div>
        <h1 class="success-title">Payment Successful!</h1>
        <p class="success-message">
          Your payment has been processed successfully.<br>
          Credits will be added to your account automatically within a few minutes.<br>
          <small>Reference: ${reference || trxref || 'N/A'}</small>
        </p>
        <button class="close-btn" onclick="window.close()">Close Window</button>
      </div>
      <script>
        // Auto-close after 10 seconds
        setTimeout(() => window.close(), 10000);
      </script>
    </body>
    </html>
  `);
});

// Paystack webhook for payment notifications (PUBLIC ROUTE)
publicCreditRoutes.post('/webhook/paystack', async (req, res) => {
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

// Debug endpoint to clear cache
router.post('/debug/clear-cache', async (req, res) => {
  try {
    const { userId } = req.body;

    if (userId) {
      SimpleCreditSystem.clearUserCache(userId);
      return ApiResponseHelper.success(res, { cleared: userId }, `Cache cleared for user: ${userId}`);
    } else {
      SimpleCreditSystem.clearAllCache();
      return ApiResponseHelper.success(res, { cleared: 'all' }, 'All cache cleared');
    }
  } catch (error) {
    logger.error('Error clearing cache:', error);
    return ApiResponseHelper.serverError(res, 'Failed to clear cache');
  }
});

export default router;