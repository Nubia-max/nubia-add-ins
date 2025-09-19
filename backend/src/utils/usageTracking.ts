// Usage tracking utilities for automations and resources

export interface UsageMetrics {
  totalAutomations: number;
  successfulAutomations: number;
  failedAutomations: number;
  totalTokensUsed: number;
  averageExecutionTime: number;
  lastUsed?: Date;
  analytics?: {
    totalAutomations: number;
    successfulAutomations: number;
    totalChatQueries: number;
    totalTokensUsed: number;
    averageExecutionTime: number;
  };
}

export interface UsageRecord {
  userId: string;
  automationType: string;
  command: string;
  success: boolean;
  executionTimeMs?: number;
  tokensUsed?: number;
  timestamp?: Date;
  metadata?: any;
  errorMessage?: string;
}

class UsageTrackerClass {
  private metrics: Map<string, UsageMetrics> = new Map();
  private records: UsageRecord[] = [];

  // Record usage with detailed information
  async recordUsage(record: UsageRecord) {
    // Add timestamp if not provided
    record.timestamp = record.timestamp || new Date();

    // Store the record
    this.records.push(record);

    // Update aggregated metrics
    const existing = this.metrics.get(record.userId) || {
      totalAutomations: 0,
      successfulAutomations: 0,
      failedAutomations: 0,
      totalTokensUsed: 0,
      averageExecutionTime: 0
    };

    existing.totalAutomations++;
    if (record.success) {
      existing.successfulAutomations++;
    } else {
      existing.failedAutomations++;
    }
    existing.totalTokensUsed += record.tokensUsed || 0;
    existing.averageExecutionTime = (existing.averageExecutionTime + (record.executionTimeMs || 0)) / 2;
    existing.lastUsed = record.timestamp;

    this.metrics.set(record.userId, existing);
  }

  // Get usage metrics for a user
  getUserUsage(userId: string, subscription?: any): UsageMetrics {
    const metrics = this.metrics.get(userId) || {
      totalAutomations: 0,
      successfulAutomations: 0,
      failedAutomations: 0,
      totalTokensUsed: 0,
      averageExecutionTime: 0
    };

    // Add analytics property
    metrics.analytics = {
      totalAutomations: metrics.totalAutomations,
      successfulAutomations: metrics.successfulAutomations,
      totalChatQueries: 0, // Could be tracked separately
      totalTokensUsed: metrics.totalTokensUsed,
      averageExecutionTime: metrics.averageExecutionTime
    };

    return metrics;
  }

  // Get usage metrics for a user (alias)
  getMetrics(userId: string): UsageMetrics {
    return this.getUserUsage(userId);
  }

  // Get usage records for a user
  getUserRecords(userId: string): UsageRecord[] {
    return this.records.filter(record => record.userId === userId);
  }

  // Reset metrics for a user
  resetMetrics(userId: string) {
    this.metrics.delete(userId);
    this.records = this.records.filter(record => record.userId !== userId);
  }

  // Get all user metrics (for admin)
  getAllMetrics(): Map<string, UsageMetrics> {
    return new Map(this.metrics);
  }
}

// Export the singleton instance as UsageTracker (with capital U to match import)
export const UsageTracker = new UsageTrackerClass();

// Global usage tracker instance (for backwards compatibility)
export const usageTracker = UsageTracker;

// Helper functions
export const trackSuccess = (userId: string, tokensUsed?: number, executionTime?: number) => {
  UsageTracker.recordUsage({
    userId,
    automationType: 'general',
    command: 'success',
    success: true,
    executionTimeMs: executionTime || 0,
    tokensUsed
  });
};

export const trackFailure = (userId: string, tokensUsed?: number, executionTime?: number) => {
  UsageTracker.recordUsage({
    userId,
    automationType: 'general',
    command: 'failure',
    success: false,
    executionTimeMs: executionTime || 0,
    tokensUsed
  });
};

export const getUserMetrics = (userId: string): UsageMetrics => {
  return UsageTracker.getMetrics(userId);
};

// Usage middleware for Express routes
export const checkUsageMiddleware = (automationType: string) => {
  return async (req: any, res: any, next: any) => {
    try {
      const userId = req.user?.id || req.user?.uid;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Get current usage metrics
      const metrics = UsageTracker.getMetrics(userId);

      // For now, we'll allow all requests and just track them
      // Future implementations can add subscription-based limits here

      next();
    } catch (error) {
      console.error('Usage tracking middleware error:', error);
      // Don't block the request on tracking errors
      next();
    }
  };
};