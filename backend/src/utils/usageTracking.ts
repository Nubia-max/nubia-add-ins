import { firebaseService } from '../services/firebase';
import { logger } from './logger';

export interface UsageParams {
  userId: string;
  automationType: 'excel_automation' | 'chat_query' | 'template_creation';
  command?: string;
  success: boolean;
  tokensUsed?: number;
  executionTimeMs?: number;
  errorMessage?: string | undefined;
  metadata?: any;
}

export class UsageTracker {
  // Record usage for billing and analytics
  static async recordUsage(params: UsageParams): Promise<void> {
    try {
      // Get current subscription
      const subscription = await firebaseService.getSubscriptionByUserId(params.userId);

      // Create usage record
      await firebaseService.createUsageRecord({
        userId: params.userId,
        subscriptionId: subscription?.id,
        automationType: params.automationType,
        command: params.command || '',
        success: params.success,
        tokensUsed: params.tokensUsed || 0,
        executionTimeMs: params.executionTimeMs || 0,
        errorMessage: params.errorMessage,
        metadata: params.metadata ? JSON.stringify(params.metadata) : undefined
      });

      // Increment usage counter for automations
      if (params.automationType === 'excel_automation' && params.success && subscription) {
        await firebaseService.updateSubscription(subscription.id, {
          automationsUsed: subscription.automationsUsed + 1
        });
      }

      logger.info('Usage recorded:', {
        userId: params.userId,
        type: params.automationType,
        success: params.success
      });
    } catch (error) {
      logger.error('Failed to record usage:', error);
      // Don't throw error to avoid breaking main functionality
    }
  }

  // Check if user has reached their usage limits
  static async checkUsageLimit(userId: string, automationType: string): Promise<{
    allowed: boolean;
    subscription: any;
    usage: number;
    limit: number;
    message?: string;
  }> {
    try {
      const subscription = await firebaseService.getSubscriptionByUserId(userId);

      if (!subscription) {
        return {
          allowed: false,
          subscription: null,
          usage: 0,
          limit: 0,
          message: 'No active subscription found. Please subscribe to continue using Nubia.'
        };
      }

      // Check subscription status
      if (subscription.status !== 'active' && subscription.status !== 'trial') {
        return {
          allowed: false,
          subscription,
          usage: subscription.automationsUsed,
          limit: subscription.automationsLimit,
          message: `Subscription is ${subscription.status.toLowerCase()}. Please update your payment method.`
        };
      }

      // Check trial expiry
      if (subscription.status === 'trial' && subscription.billingPeriodEnd) {
        const now = new Date();
        if (now > subscription.billingPeriodEnd) {
          // Update subscription status
          await firebaseService.updateSubscription(subscription.id, {
            status: 'canceled'
          });

          return {
            allowed: false,
            subscription,
            usage: subscription.automationsUsed,
            limit: subscription.automationsLimit,
            message: 'Your free trial has expired. Please upgrade to continue using Nubia.'
          };
        }
      }

      // Check automation limits (unlimited = -1)
      if (automationType === 'excel_automation') {
        if (subscription.automationsLimit !== -1 &&
            subscription.automationsUsed >= subscription.automationsLimit) {
          return {
            allowed: false,
            subscription,
            usage: subscription.automationsUsed,
            limit: subscription.automationsLimit,
            message: `You've reached your monthly limit of ${subscription.automationsLimit} automations. Please upgrade your plan.`
          };
        }
      }

      return {
        allowed: true,
        subscription,
        usage: subscription.automationsUsed,
        limit: subscription.automationsLimit
      };
    } catch (error) {
      logger.error('Failed to check usage limit:', error);
      return {
        allowed: false,
        subscription: null,
        usage: 0,
        limit: 0,
        message: 'Unable to verify subscription status. Please try again.'
      };
    }
  }

  // Get usage analytics for user
  static async getUserUsage(userId: string, days: number = 30) {
    try {
      const usage = await firebaseService.getUserUsageRecords(userId);

      // Filter by date range
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const filteredUsage = usage.filter(u => u.createdAt >= startDate);

      const analytics = {
        totalAutomations: filteredUsage.filter(u => u.automationType === 'excel_automation').length,
        successfulAutomations: filteredUsage.filter(u => u.automationType === 'excel_automation' && u.success).length,
        totalChatQueries: filteredUsage.filter(u => u.automationType === 'chat_query').length,
        totalTokensUsed: filteredUsage.reduce((sum, u) => sum + (u.tokensUsed || 0), 0),
        averageExecutionTime: filteredUsage.length > 0
          ? filteredUsage.reduce((sum, u) => sum + (u.executionTimeMs || 0), 0) / filteredUsage.length
          : 0,
        dailyUsage: this.groupUsageByDay(filteredUsage),
        automationsByType: this.groupUsageByType(filteredUsage)
      };

      return { usage: filteredUsage, analytics };
    } catch (error) {
      logger.error('Failed to get user usage:', error);
      throw error;
    }
  }

  private static groupUsageByDay(usage: any[]) {
    const grouped: Record<string, number> = {};
    usage.forEach(u => {
      const date = u.createdAt.toISOString().split('T')[0];
      grouped[date] = (grouped[date] || 0) + 1;
    });
    return grouped;
  }

  private static groupUsageByType(usage: any[]) {
    const grouped: Record<string, number> = {};
    usage.forEach(u => {
      grouped[u.automationType] = (grouped[u.automationType] || 0) + 1;
    });
    return grouped;
  }
}

// Middleware to check usage limits before API calls
export const checkUsageMiddleware = (automationType: string) => {
  return async (req: any, res: any, next: any) => {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const usageCheck = await UsageTracker.checkUsageLimit(userId, automationType);

    if (!usageCheck.allowed) {
      return res.status(429).json({
        error: 'Usage limit exceeded',
        message: usageCheck.message,
        subscription: usageCheck.subscription,
        usage: usageCheck.usage,
        limit: usageCheck.limit
      });
    }

    // Attach subscription info to request
    req.subscription = usageCheck.subscription;
    next();
  };
};