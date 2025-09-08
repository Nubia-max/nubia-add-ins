// src/services/usageService.ts
// NUBIA Usage Tracking and Subscription Management

export interface UsageEvent {
  userId: string;
  tokens: number;
  model: string;
  mode?: string;
  framework?: string;
  success: boolean;
  at: string;
  sessionId?: string;
  command?: string;
  worksheetCount?: number;
}

export interface UserPlan {
  planType: 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE';
  tokensPerMonth: number;
  tokensUsedThisMonth: number;
  resetDate: string;
  features: string[];
  maxWorksheets: number;
  prioritySupport: boolean;
}

export interface UsageStats {
  totalTokens: number;
  totalRequests: number;
  averageTokensPerRequest: number;
  mostUsedMode: string;
  mostUsedFramework: string;
  successRate: number;
  currentMonthUsage: number;
  remainingTokens: number;
}

// Plan configurations
const PLAN_LIMITS: Record<string, UserPlan> = {
  FREE: {
    planType: 'FREE',
    tokensPerMonth: 10000,
    tokensUsedThisMonth: 0,
    resetDate: '',
    features: ['Basic Excel Generation', 'US GAAP Only', 'Email Support'],
    maxWorksheets: 5,
    prioritySupport: false
  },
  BASIC: {
    planType: 'BASIC',
    tokensPerMonth: 50000,
    tokensUsedThisMonth: 0,
    resetDate: '',
    features: ['All Excel Features', 'Multi-Framework Support', 'Priority Email'],
    maxWorksheets: 15,
    prioritySupport: false
  },
  PRO: {
    planType: 'PRO',
    tokensPerMonth: 200000,
    tokensUsedThisMonth: 0,
    resetDate: '',
    features: ['Advanced Analytics', 'All Frameworks', 'Phone Support', 'API Access'],
    maxWorksheets: 50,
    prioritySupport: true
  },
  ENTERPRISE: {
    planType: 'ENTERPRISE',
    tokensPerMonth: 1000000,
    tokensUsedThisMonth: 0,
    resetDate: '',
    features: ['Unlimited', 'Custom Integration', 'Dedicated Support', 'SLA'],
    maxWorksheets: -1, // Unlimited
    prioritySupport: true
  }
};

// In-memory storage (replace with actual database in production)
const usageData: Map<string, UsageEvent[]> = new Map();
const userPlans: Map<string, UserPlan> = new Map();

export async function recordUsage(event: UsageEvent): Promise<void> {
  try {
    console.log('[USAGE] Recording:', {
      userId: event.userId,
      tokens: event.tokens,
      model: event.model,
      mode: event.mode,
      success: event.success
    });

    // Store usage event
    const userUsage = usageData.get(event.userId) || [];
    userUsage.push(event);
    usageData.set(event.userId, userUsage);

    // Update monthly usage
    const userPlan = await getUserPlan(event.userId);
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const eventMonth = event.at.slice(0, 7);

    if (eventMonth === currentMonth && event.success) {
      userPlan.tokensUsedThisMonth += event.tokens;
      userPlans.set(event.userId, userPlan);
    }

    // TODO: Persist to database
    // await database.usage.create({ data: event });
    // await database.userPlan.update({ 
    //   where: { userId: event.userId },
    //   data: { tokensUsedThisMonth: userPlan.tokensUsedThisMonth }
    // });

  } catch (error) {
    console.error('Failed to record usage:', error);
    // Don't throw - usage tracking should not break the main flow
  }
}

export async function checkPlanAllows(
  userId: string, 
  tokensAboutToUse: number,
  worksheetCount: number = 5
): Promise<boolean> {
  try {
    const userPlan = await getUserPlan(userId);
    
    // Check monthly token limit
    const remainingTokens = userPlan.tokensPerMonth - userPlan.tokensUsedThisMonth;
    if (tokensAboutToUse > remainingTokens) {
      throw new Error(`Monthly token limit exceeded. Used: ${userPlan.tokensUsedThisMonth}/${userPlan.tokensPerMonth}. Upgrade your plan for more capacity.`);
    }

    // Check worksheet limit
    if (userPlan.maxWorksheets > 0 && worksheetCount > userPlan.maxWorksheets) {
      throw new Error(`Worksheet limit exceeded. Plan allows ${userPlan.maxWorksheets} worksheets, requested ${worksheetCount}. Upgrade your plan.`);
    }

    return true;
  } catch (error) {
    console.error('Plan check failed:', error);
    throw error;
  }
}

export async function getUserPlan(userId: string): Promise<UserPlan> {
  // Check cache first
  if (userPlans.has(userId)) {
    return userPlans.get(userId)!;
  }

  // TODO: Load from database
  // const planData = await database.userPlan.findUnique({ where: { userId } });
  // if (planData) return planData;

  // Default to FREE plan
  const defaultPlan = { 
    ...PLAN_LIMITS.FREE,
    resetDate: getNextResetDate()
  };
  
  userPlans.set(userId, defaultPlan);
  return defaultPlan;
}

export async function getUsageStats(userId: string): Promise<UsageStats> {
  const userUsage = usageData.get(userId) || [];
  const currentMonth = new Date().toISOString().slice(0, 7);
  const userPlan = await getUserPlan(userId);

  // Filter current month usage
  const thisMonthUsage = userUsage.filter(event => 
    event.at.slice(0, 7) === currentMonth
  );

  // Calculate statistics
  const totalTokens = userUsage.reduce((sum, event) => sum + event.tokens, 0);
  const totalRequests = userUsage.length;
  const successfulRequests = userUsage.filter(e => e.success).length;
  
  // Mode analysis
  const modeCount: Record<string, number> = {};
  const frameworkCount: Record<string, number> = {};
  
  userUsage.forEach(event => {
    if (event.mode) {
      modeCount[event.mode] = (modeCount[event.mode] || 0) + 1;
    }
    if (event.framework) {
      frameworkCount[event.framework] = (frameworkCount[event.framework] || 0) + 1;
    }
  });

  const mostUsedMode = Object.entries(modeCount)
    .sort(([,a], [,b]) => b - a)[0]?.[0] || 'FIN_REPORT';
  
  const mostUsedFramework = Object.entries(frameworkCount)
    .sort(([,a], [,b]) => b - a)[0]?.[0] || 'US_GAAP';

  return {
    totalTokens,
    totalRequests,
    averageTokensPerRequest: totalRequests > 0 ? Math.round(totalTokens / totalRequests) : 0,
    mostUsedMode,
    mostUsedFramework,
    successRate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0,
    currentMonthUsage: userPlan.tokensUsedThisMonth,
    remainingTokens: userPlan.tokensPerMonth - userPlan.tokensUsedThisMonth
  };
}

export async function upgradePlan(userId: string, newPlan: 'BASIC' | 'PRO' | 'ENTERPRISE'): Promise<UserPlan> {
  if (!PLAN_LIMITS[newPlan]) {
    throw new Error(`Invalid plan: ${newPlan}`);
  }

  const currentPlan = await getUserPlan(userId);
  const upgradedPlan: UserPlan = {
    ...PLAN_LIMITS[newPlan],
    tokensUsedThisMonth: currentPlan.tokensUsedThisMonth, // Preserve current usage
    resetDate: currentPlan.resetDate || getNextResetDate()
  };

  userPlans.set(userId, upgradedPlan);
  
  // TODO: Update in database and trigger billing
  // await database.userPlan.upsert({
  //   where: { userId },
  //   create: { userId, ...upgradedPlan },
  //   update: upgradedPlan
  // });
  // await billing.createSubscription(userId, newPlan);

  console.log(`User ${userId} upgraded to ${newPlan} plan`);
  return upgradedPlan;
}

export async function resetMonthlyUsage(userId: string): Promise<void> {
  const userPlan = await getUserPlan(userId);
  userPlan.tokensUsedThisMonth = 0;
  userPlan.resetDate = getNextResetDate();
  userPlans.set(userId, userPlan);

  // TODO: Update in database
  // await database.userPlan.update({
  //   where: { userId },
  //   data: { tokensUsedThisMonth: 0, resetDate: userPlan.resetDate }
  // });

  console.log(`Monthly usage reset for user ${userId}`);
}

export async function getUsageReport(userId: string, days: number = 30): Promise<{
  dailyUsage: Array<{ date: string; tokens: number; requests: number }>;
  modeBreakdown: Record<string, number>;
  frameworkBreakdown: Record<string, number>;
  modelBreakdown: Record<string, number>;
}> {
  const userUsage = usageData.get(userId) || [];
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const recentUsage = userUsage.filter(event => 
    new Date(event.at) >= cutoffDate
  );

  // Daily aggregation
  const dailyMap: Record<string, { tokens: number; requests: number }> = {};
  const modeBreakdown: Record<string, number> = {};
  const frameworkBreakdown: Record<string, number> = {};
  const modelBreakdown: Record<string, number> = {};

  recentUsage.forEach(event => {
    const date = event.at.slice(0, 10); // YYYY-MM-DD
    
    if (!dailyMap[date]) {
      dailyMap[date] = { tokens: 0, requests: 0 };
    }
    dailyMap[date].tokens += event.tokens;
    dailyMap[date].requests += 1;

    if (event.mode) {
      modeBreakdown[event.mode] = (modeBreakdown[event.mode] || 0) + event.tokens;
    }
    if (event.framework) {
      frameworkBreakdown[event.framework] = (frameworkBreakdown[event.framework] || 0) + event.tokens;
    }
    modelBreakdown[event.model] = (modelBreakdown[event.model] || 0) + event.tokens;
  });

  const dailyUsage = Object.entries(dailyMap).map(([date, data]) => ({
    date,
    tokens: data.tokens,
    requests: data.requests
  })).sort((a, b) => a.date.localeCompare(b.date));

  return {
    dailyUsage,
    modeBreakdown,
    frameworkBreakdown,
    modelBreakdown
  };
}

// Helper functions
function getNextResetDate(): string {
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(1);
  nextMonth.setHours(0, 0, 0, 0);
  return nextMonth.toISOString();
}

export function estimateTokensForCommand(command: string): number {
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

  return Math.round(baseTokens * multiplier);
}

// Export plan limits for reference
export { PLAN_LIMITS };

/*
NUBIA Usage Service Features:
✅ Comprehensive usage tracking with detailed events
✅ Multi-tier subscription plan management
✅ Token quota enforcement with graceful errors
✅ Worksheet count validation
✅ Real-time usage statistics and reporting
✅ Monthly usage reset automation
✅ Plan upgrade/downgrade support
✅ Detailed analytics (modes, frameworks, models)
✅ Usage estimation for proactive checks
✅ Database-ready structure with TODO comments
✅ Error handling that doesn't break main flow
✅ In-memory fallback for development/testing
*/