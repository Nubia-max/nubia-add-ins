// Simple Credit System for Nubia
// Users buy credits directly: $2 = 200 credits, 1 credit = 1000 tokens

import { getFirestore, COLLECTIONS } from '../config/firebase';
import { logger } from '../utils/logger';
import admin from 'firebase-admin';

export interface UserCredits {
  userId: string; // Firebase UID or 'anonymous' for non-logged users
  credits: number;
  isAnonymous: boolean;
  createdAt: Date;
  lastUsed: Date;
  totalPurchased: number; // Total credits ever purchased
  totalUsed: number; // Total credits ever used
}

export interface CreditTransaction {
  userId: string;
  type: 'purchase' | 'usage' | 'free_credits';
  credits: number;
  amount?: number; // USD for purchases
  tokens?: number; // For usage transactions
  command?: string; // What command used the credits
  timestamp: Date;
  success: boolean;
}

// Credit pricing: $2 = 200 credits, so $1 = 100 credits
export const CREDITS_PER_DOLLAR = 100;
export const TOKENS_PER_CREDIT = 1000;
export const FREE_CREDITS = 10; // Free credits for all users
export const MIN_PURCHASE = 2; // Minimum $2
export const MAX_PURCHASE = 100; // Maximum $100

// In-memory cache for performance (synced with Firestore)
const userCreditsCache: Map<string, UserCredits> = new Map();

// Lazy Firestore initialization
function getDB() {
  try {
    return getFirestore();
  } catch (error) {
    logger.warn('Firestore not available, using in-memory cache only');
    return null;
  }
}

export class SimpleCreditSystem {

  // Get or create user credits
  static async getUserCredits(userId?: string): Promise<UserCredits> {
    const id = userId || 'anonymous';

    // Check cache first
    if (userCreditsCache.has(id)) {
      return userCreditsCache.get(id)!;
    }

    try {
      // Try to load from Firestore
      const firestoreInstance = getDB();
      if (firestoreInstance) {
        const userDoc = await firestoreInstance.collection(COLLECTIONS.CREDITS).doc(id).get();

        if (userDoc.exists) {
          const userData = userDoc.data() as UserCredits;
          userCreditsCache.set(id, userData);
          return userData;
        }
      }

      // Create new user with free credits
      const newUser: UserCredits = {
        userId: id,
        credits: FREE_CREDITS,
        isAnonymous: id === 'anonymous',
        createdAt: new Date(),
        lastUsed: new Date(),
        totalPurchased: 0,
        totalUsed: 0
      };

      // Save to Firestore
      const firestoreInstance2 = getDB();
      if (firestoreInstance2) {
        await firestoreInstance2.collection(COLLECTIONS.CREDITS).doc(id).set({
          ...newUser,
          createdAt: admin.firestore.Timestamp.fromDate(newUser.createdAt),
          lastUsed: admin.firestore.Timestamp.fromDate(newUser.lastUsed)
        });
      }

      userCreditsCache.set(id, newUser);

      // Log free credits transaction
      await this.recordTransaction({
        userId: id,
        type: 'free_credits',
        credits: FREE_CREDITS,
        timestamp: new Date(),
        success: true
      });

      logger.info(`[CREDITS] New user ${id} created with ${FREE_CREDITS} free credits`);
      return newUser;

    } catch (error) {
      logger.error('Error accessing Firestore, using cache:', error);

      // Fallback to cache/memory if Firestore fails
      const fallbackUser: UserCredits = {
        userId: id,
        credits: FREE_CREDITS,
        isAnonymous: id === 'anonymous',
        createdAt: new Date(),
        lastUsed: new Date(),
        totalPurchased: 0,
        totalUsed: 0
      };

      userCreditsCache.set(id, fallbackUser);
      return fallbackUser;
    }
  }

  // Check if user can perform action (has enough credits)
  static async canPerformAction(userId: string | undefined, estimatedTokens: number): Promise<{
    canProceed: boolean;
    requiredCredits: number;
    availableCredits: number;
    needsLogin: boolean;
    needsPurchase: boolean;
    message?: string;
  }> {
    const requiredCredits = Math.ceil(estimatedTokens / TOKENS_PER_CREDIT);
    const userAccount = await this.getUserCredits(userId);

    const canProceed = userAccount.credits >= requiredCredits;
    const needsLogin = !userId && userAccount.credits <= 0;
    const needsPurchase = !!userId && userAccount.credits < requiredCredits;

    let message: string | undefined;

    if (!canProceed) {
      if (!userId) {
        message = `You've used your ${FREE_CREDITS} free credits. Please sign in with Google to purchase more credits and continue.`;
      } else {
        message = `Insufficient credits. Required: ${requiredCredits}, Available: ${userAccount.credits}. Please purchase more credits.`;
      }
    }

    return {
      canProceed,
      requiredCredits,
      availableCredits: userAccount.credits,
      needsLogin,
      needsPurchase,
      message
    };
  }

  // Deduct credits after successful operation
  static async deductCredits(
    userId: string | undefined,
    tokensUsed: number,
    command: string,
    success: boolean = true
  ): Promise<{ success: boolean; creditsDeducted: number; remainingCredits: number }> {

    if (!success) {
      // Don't deduct credits for failed operations
      return {
        success: false,
        creditsDeducted: 0,
        remainingCredits: 0
      };
    }

    const creditsToDeduct = Math.ceil(tokensUsed / TOKENS_PER_CREDIT);
    const userAccount = await this.getUserCredits(userId);

    // Verify sufficient credits
    if (userAccount.credits < creditsToDeduct) {
      throw new Error(`Insufficient credits. Required: ${creditsToDeduct}, Available: ${userAccount.credits}`);
    }

    // Deduct credits
    userAccount.credits -= creditsToDeduct;
    userAccount.totalUsed += creditsToDeduct;
    userAccount.lastUsed = new Date();

    const id = userId || 'anonymous';

    // Update cache
    userCreditsCache.set(id, userAccount);

    // Update Firestore
    try {
      const firestoreDB = getDB();
      if (firestoreDB) {
        await firestoreDB.collection(COLLECTIONS.CREDITS).doc(id).update({
        credits: userAccount.credits,
        totalUsed: userAccount.totalUsed,
        lastUsed: admin.firestore.Timestamp.fromDate(userAccount.lastUsed)
        });
      }
    } catch (error) {
      logger.error('Failed to update Firestore, using cache only:', error);
    }

    // Record transaction
    await this.recordTransaction({
      userId: id,
      type: 'usage',
      credits: -creditsToDeduct,
      tokens: tokensUsed,
      command: command.substring(0, 100),
      timestamp: new Date(),
      success: true
    });

    logger.info(`[CREDITS] Deducted ${creditsToDeduct} credits from ${id}. Remaining: ${userAccount.credits}`);

    return {
      success: true,
      creditsDeducted: creditsToDeduct,
      remainingCredits: userAccount.credits
    };
  }

  // Purchase credits (requires authentication)
  static async purchaseCredits(
    userId: string,
    amountUSD: number,
    _paymentDetails?: any
  ): Promise<{ success: boolean; creditsPurchased: number; newBalance: number; transactionId?: string }> {

    if (!userId || userId === 'anonymous') {
      throw new Error('Must be logged in to purchase credits');
    }

    // Validate purchase amount
    if (amountUSD < MIN_PURCHASE || amountUSD > MAX_PURCHASE) {
      throw new Error(`Purchase amount must be between $${MIN_PURCHASE} and $${MAX_PURCHASE}`);
    }

    const creditsToPurchase = amountUSD * CREDITS_PER_DOLLAR;

    // TODO: Process payment with Stripe
    // const paymentResult = await processStripePayment(amountUSD, paymentDetails);
    // if (!paymentResult.success) throw new Error('Payment failed');

    const userAccount = await this.getUserCredits(userId);

    // Add credits
    userAccount.credits += creditsToPurchase;
    userAccount.totalPurchased += creditsToPurchase;

    // Update cache
    userCreditsCache.set(userId, userAccount);

    // Update Firestore
    try {
      const firestoreDB = getDB();
      if (firestoreDB) {
        await firestoreDB.collection(COLLECTIONS.CREDITS).doc(userId).update({
        credits: userAccount.credits,
        totalPurchased: userAccount.totalPurchased
        });
      }
    } catch (error) {
      logger.error('Failed to update Firestore after purchase:', error);
    }

    // Record transaction
    const transactionId = `txn_${Date.now()}`;
    await this.recordTransaction({
      userId,
      type: 'purchase',
      credits: creditsToPurchase,
      amount: amountUSD,
      timestamp: new Date(),
      success: true
    });

    logger.info(`[CREDITS] User ${userId} purchased ${creditsToPurchase} credits for $${amountUSD}`);

    return {
      success: true,
      creditsPurchased: creditsToPurchase,
      newBalance: userAccount.credits,
      transactionId
    };
  }

  // Get user's credit balance and stats
  static async getCreditBalance(userId?: string): Promise<{
    credits: number;
    isAnonymous: boolean;
    totalPurchased: number;
    totalUsed: number;
    recentTransactions: CreditTransaction[];
    freeCreditsRemaining?: number;
  }> {
    const userAccount = await this.getUserCredits(userId);
    const id = userId || 'anonymous';

    try {
      // Get recent transactions from Firestore
      const firestoreDB = getDB();
      if (!firestoreDB) {
        return {
          credits: userAccount.credits,
          isAnonymous: userAccount.isAnonymous,
          totalPurchased: userAccount.totalPurchased,
          totalUsed: userAccount.totalUsed,
          recentTransactions: [],
          freeCreditsRemaining: userAccount.isAnonymous ? userAccount.credits : undefined
        };
      }

      const transactionsSnapshot = await firestoreDB.collection(COLLECTIONS.TRANSACTIONS)
        .where('userId', '==', id)
        .orderBy('timestamp', 'desc')
        .limit(10)
        .get();

      const recentTransactions = transactionsSnapshot.docs.map((doc: any) => {
        const data = doc.data();
        return {
          ...data,
          timestamp: data.timestamp.toDate()
        } as CreditTransaction;
      });

      return {
        credits: userAccount.credits,
        isAnonymous: userAccount.isAnonymous,
        totalPurchased: userAccount.totalPurchased,
        totalUsed: userAccount.totalUsed,
        recentTransactions,
        freeCreditsRemaining: userAccount.isAnonymous ? userAccount.credits : undefined
      };
    } catch (error) {
      logger.error('Failed to load recent transactions:', error);

      // Fallback without transactions
      return {
        credits: userAccount.credits,
        isAnonymous: userAccount.isAnonymous,
        totalPurchased: userAccount.totalPurchased,
        totalUsed: userAccount.totalUsed,
        recentTransactions: [],
        freeCreditsRemaining: userAccount.isAnonymous ? userAccount.credits : undefined
      };
    }
  }

  // Estimate credits needed for a command
  static estimateCreditsForCommand(command: string): number {
    // Simple estimation based on command length and complexity
    const baseTokens = Math.max(2000, command.length * 3); // Minimum 2000 tokens

    // Add complexity multipliers
    let multiplier = 1;

    if (command.toLowerCase().includes('comprehensive') || command.toLowerCase().includes('detailed')) {
      multiplier += 0.5;
    }
    if (command.toLowerCase().includes('dashboard') || command.toLowerCase().includes('analysis')) {
      multiplier += 0.3;
    }
    if (command.toLowerCase().includes('multiple') || command.toLowerCase().includes('several')) {
      multiplier += 0.4;
    }

    const estimatedTokens = Math.round(baseTokens * multiplier);
    return Math.ceil(estimatedTokens / TOKENS_PER_CREDIT);
  }

  // Transfer anonymous credits to logged-in user
  static async transferAnonymousCredits(newUserId: string): Promise<void> {
    const anonymousAccount = userCreditsCache.get('anonymous');

    if (!anonymousAccount || anonymousAccount.credits <= 0) {
      return; // No credits to transfer
    }

    const loggedInAccount = await this.getUserCredits(newUserId);
    const creditsToTransfer = anonymousAccount.credits;

    // Transfer remaining credits
    loggedInAccount.credits += creditsToTransfer;
    userCreditsCache.set(newUserId, loggedInAccount);

    // Update Firestore
    try {
      const firestoreDB = getDB();
      if (firestoreDB) {
        await firestoreDB.collection(COLLECTIONS.CREDITS).doc(newUserId).update({
        credits: loggedInAccount.credits
        });
      }
    } catch (error) {
      logger.error('Failed to update Firestore during credit transfer:', error);
    }

    // Clear anonymous credits
    anonymousAccount.credits = 0;
    userCreditsCache.set('anonymous', anonymousAccount);

    logger.info(`[CREDITS] Transferred ${creditsToTransfer} credits from anonymous to ${newUserId}`);
  }

  // Record transaction for audit trail
  private static async recordTransaction(transaction: CreditTransaction): Promise<void> {
    try {
      // Save to Firestore
      const firestoreDB = getDB();
      if (firestoreDB) {
        await firestoreDB.collection(COLLECTIONS.TRANSACTIONS).add({
        ...transaction,
        timestamp: admin.firestore.Timestamp.fromDate(transaction.timestamp)
        });
      }

      logger.debug('Transaction recorded to Firestore:', transaction.type);
    } catch (error) {
      logger.error('Failed to record transaction to Firestore:', error);
      // Continue execution even if transaction logging fails
    }
  }

  // Get pricing info for UI
  static getPricingInfo(): {
    creditsPerDollar: number;
    tokensPerCredit: number;
    minPurchase: number;
    maxPurchase: number;
    freeCredits: number;
    examples: Array<{ amount: number; credits: number; automations: string }>;
  } {
    return {
      creditsPerDollar: CREDITS_PER_DOLLAR,
      tokensPerCredit: TOKENS_PER_CREDIT,
      minPurchase: MIN_PURCHASE,
      maxPurchase: MAX_PURCHASE,
      freeCredits: FREE_CREDITS,
      examples: [
        { amount: 2, credits: 200, automations: '40-100 automations' },
        { amount: 5, credits: 500, automations: '100-250 automations' },
        { amount: 10, credits: 1000, automations: '200-500 automations' },
        { amount: 25, credits: 2500, automations: '500-1,250 automations' },
        { amount: 50, credits: 5000, automations: '1,000-2,500 automations' },
      ]
    };
  }
}

// Express middleware for credit checking
export const checkCreditsMiddleware = () => {
  return async (req: any, res: any, next: any) => {
    try {
      const userId = req.user?.uid; // Firebase UID
      const command = req.body?.command || req.body?.userCommand;

      if (!command) {
        return next(); // No command to validate
      }

      const estimatedTokens = SimpleCreditSystem.estimateCreditsForCommand(command) * TOKENS_PER_CREDIT;
      const validation = await SimpleCreditSystem.canPerformAction(userId, estimatedTokens);

      if (!validation.canProceed) {
        return res.status(402).json({
          error: 'CREDITS_EXHAUSTED',
          type: 'INSUFFICIENT_CREDITS',
          message: validation.message,
          requiredCredits: validation.requiredCredits,
          availableCredits: validation.availableCredits,
          needsLogin: validation.needsLogin,
          needsPurchase: validation.needsPurchase,
          pricing: SimpleCreditSystem.getPricingInfo(),
          action: validation.needsLogin ? 'SHOW_LOGIN' : 'SHOW_PURCHASE'
        });
      }

      // Add validation info to request
      req.creditValidation = validation;
      next();

    } catch (error) {
      logger.error('Credit validation middleware error:', error);
      // Don't block the request on validation errors
      next();
    }
  };
};

export default SimpleCreditSystem;

/*
SIMPLE CREDIT SYSTEM FEATURES:
✅ $2 = 200 credits, 1 credit = 1000 tokens
✅ 10 free credits for all users (anonymous + logged in)
✅ Anonymous users can use 10 credits before login required
✅ Purchase range: $2 - $100
✅ Credits deducted based on actual token usage
✅ Failed operations don't consume credits
✅ Firebase authentication integration ready
✅ Anonymous credit transfer to logged-in account
✅ Audit trail for all transactions
✅ Express middleware for easy integration
✅ Pricing examples for UI
*/