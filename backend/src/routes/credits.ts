// Credit Management API Routes
import express, { Router } from 'express';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth';
import SimpleCreditSystem from '../services/creditSystem';
import { logger } from '../utils/logger';

const router: Router = express.Router();

// Get user's credit balance (works for anonymous and logged-in users)
router.get('/balance', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.uid;
    const balance = await SimpleCreditSystem.getCreditBalance(userId);

    res.json({
      success: true,
      data: balance
    });

  } catch (error) {
    logger.error('Error fetching credit balance:', error);
    res.status(500).json({
      error: 'Failed to fetch credit balance',
      message: (error as Error).message
    });
  }
});

// Purchase credits (requires authentication)
router.post('/purchase', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.uid;
    const { amount, paymentDetails } = req.body;

    if (!amount || typeof amount !== 'number') {
      return res.status(400).json({
        error: 'Invalid amount',
        message: 'Amount must be a number'
      });
    }

    const result = await SimpleCreditSystem.purchaseCredits(userId, amount, paymentDetails);

    res.json({
      success: true,
      data: result,
      message: `Successfully purchased ${result.creditsPurchased} credits`
    });

  } catch (error) {
    logger.error('Error purchasing credits:', error);
    res.status(400).json({
      error: 'Purchase failed',
      message: (error as Error).message
    });
  }
});

// Get pricing information
router.get('/pricing', async (req, res) => {
  try {
    const pricing = SimpleCreditSystem.getPricingInfo();

    res.json({
      success: true,
      data: pricing
    });

  } catch (error) {
    logger.error('Error fetching pricing info:', error);
    res.status(500).json({
      error: 'Failed to fetch pricing information'
    });
  }
});

// Estimate credits for a command
router.post('/estimate', async (req, res) => {
  try {
    const { command } = req.body;

    if (!command || typeof command !== 'string') {
      return res.status(400).json({
        error: 'Invalid command',
        message: 'Command must be a non-empty string'
      });
    }

    const estimatedCredits = SimpleCreditSystem.estimateCreditsForCommand(command);

    res.json({
      success: true,
      data: {
        estimatedCredits,
        command: command.substring(0, 100)
      }
    });

  } catch (error) {
    logger.error('Error estimating credits:', error);
    res.status(500).json({
      error: 'Failed to estimate credits'
    });
  }
});

// Transfer anonymous credits when user signs in
router.post('/transfer-anonymous', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.uid;

    await SimpleCreditSystem.transferAnonymousCredits(userId);

    const newBalance = await SimpleCreditSystem.getCreditBalance(userId);

    res.json({
      success: true,
      message: 'Anonymous credits transferred successfully',
      data: newBalance
    });

  } catch (error) {
    logger.error('Error transferring anonymous credits:', error);
    res.status(500).json({
      error: 'Failed to transfer credits',
      message: (error as Error).message
    });
  }
});

export default router;