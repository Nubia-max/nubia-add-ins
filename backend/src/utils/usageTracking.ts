import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

const prisma = new PrismaClient();

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
      const subscription = await prisma.subscription.findFirst({
        where: { userId: params.userId },
        orderBy: { createdAt: 'desc' }
      });

      await prisma.usageRecord.create({
        data: {
          userId: params.userId,
          subscriptionId: subscription?.id,
          automationType: params.automationType,
          command: params.command || '',
          success: params.success,
          tokensUsed: params.tokensUsed,
          executionTimeMs: params.executionTimeMs,
          errorMessage: params.errorMessage,
          metadata: params.metadata ? JSON.stringify(params.metadata) : null
        }
      });

      // Increment usage counter for automations
      if (params.automationType === 'excel_automation' && params.success && subscription) {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            automationsUsed: {
              increment: 1
            }
          }
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
      const subscription = await prisma.subscription.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });

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
      if (subscription.status !== 'ACTIVE' && subscription.status !== 'TRIAL') {
        return {
          allowed: false,
          subscription,
          usage: subscription.automationsUsed,
          limit: subscription.automationsLimit,
          message: `Subscription is ${subscription.status.toLowerCase()}. Please update your payment method.`
        };
      }

      // Check trial expiry
      if (subscription.status === 'TRIAL' && subscription.billingPeriodEnd) {
        const now = new Date();
        if (now > subscription.billingPeriodEnd) {
          // Update subscription status
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { status: 'CANCELED' }
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
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const usage = await prisma.usageRecord.findMany({
        where: {
          userId,
          createdAt: {
            gte: startDate
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      const analytics = {
        totalAutomations: usage.filter(u => u.automationType === 'excel_automation').length,
        successfulAutomations: usage.filter(u => u.automationType === 'excel_automation' && u.success).length,
        totalChatQueries: usage.filter(u => u.automationType === 'chat_query').length,
        totalTokensUsed: usage.reduce((sum, u) => sum + (u.tokensUsed || 0), 0),
        averageExecutionTime: usage.length > 0 
          ? usage.reduce((sum, u) => sum + (u.executionTimeMs || 0), 0) / usage.length 
          : 0,
        dailyUsage: this.groupUsageByDay(usage),
        automationsByType: this.groupUsageByType(usage)
      };

      return { usage, analytics };
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