import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class ExcelService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async processTransactions(userId: string, transactions: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const activeSubscription = user.subscriptions[0];
    
    if (!activeSubscription) {
      const trialEndsAt = user.trialEndsAt;
      if (!trialEndsAt || new Date() > trialEndsAt) {
        throw new Error('Trial expired. Please upgrade to continue.');
      }
    } else {
      if (activeSubscription.automationsUsed >= activeSubscription.automationsLimit) {
        throw new Error(`Monthly limit of ${activeSubscription.automationsLimit} automations exceeded. Please upgrade.`);
      }
    }

    const startTime = Date.now();
    
    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [{
          role: "system",
          content: `You are a financial Excel automation expert. Convert transaction data into structured Excel format.
          Return a JSON object with:
          - columns: Array of column definitions [{name, type, width}]
          - rows: Array of data rows
          - formulas: Array of Excel formulas to apply
          - formatting: Formatting rules for cells
          - summary: Brief summary of the data processed`
        }, {
          role: "user",
          content: transactions
        }],
        temperature: 0.3,
        response_format: { type: "json_object" }
      });

      const executionTime = Date.now() - startTime;
      const tokensUsed = completion.usage?.total_tokens || 0;
      const result = JSON.parse(completion.choices[0].message.content || '{}');

      await prisma.usageRecord.create({
        data: {
          userId,
          subscriptionId: activeSubscription?.id,
          automationType: 'excel_automation',
          command: transactions.substring(0, 500),
          success: true,
          tokensUsed,
          executionTimeMs: executionTime,
          metadata: result
        }
      });

      if (activeSubscription) {
        await prisma.subscription.update({
          where: { id: activeSubscription.id },
          data: { automationsUsed: { increment: 1 } }
        });
      }

      return result;
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      
      await prisma.usageRecord.create({
        data: {
          userId,
          subscriptionId: activeSubscription?.id,
          automationType: 'excel_automation',
          command: transactions.substring(0, 500),
          success: false,
          executionTimeMs: executionTime,
          errorMessage: error.message
        }
      });

      throw error;
    }
  }

  async generateExcelFormulas(userId: string, description: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const activeSubscription = user.subscriptions[0];
    
    if (!activeSubscription) {
      const trialEndsAt = user.trialEndsAt;
      if (!trialEndsAt || new Date() > trialEndsAt) {
        throw new Error('Trial expired. Please upgrade to continue.');
      }
    }

    const startTime = Date.now();

    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [{
          role: "system",
          content: `You are an Excel formula expert. Generate Excel formulas based on user requirements.
          Return a JSON object with:
          - formulas: Array of {cell, formula, description}
          - explanation: Step-by-step explanation
          - alternatives: Alternative approaches if applicable`
        }, {
          role: "user",
          content: description
        }],
        temperature: 0.3,
        response_format: { type: "json_object" }
      });

      const executionTime = Date.now() - startTime;
      const tokensUsed = completion.usage?.total_tokens || 0;
      const result = JSON.parse(completion.choices[0].message.content || '{}');

      await prisma.usageRecord.create({
        data: {
          userId,
          subscriptionId: activeSubscription?.id,
          automationType: 'formula_generation',
          command: description.substring(0, 500),
          success: true,
          tokensUsed,
          executionTimeMs: executionTime,
          metadata: result
        }
      });

      return result;
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      
      await prisma.usageRecord.create({
        data: {
          userId,
          subscriptionId: activeSubscription?.id,
          automationType: 'formula_generation',
          command: description.substring(0, 500),
          success: false,
          executionTimeMs: executionTime,
          errorMessage: error.message
        }
      });

      throw error;
    }
  }

  async getUserUsageStats(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const activeSubscription = user.subscriptions[0];
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const monthlyUsage = await prisma.usageRecord.count({
      where: {
        userId,
        createdAt: { gte: currentMonth }
      }
    });

    const monthlyTokens = await prisma.usageRecord.aggregate({
      where: {
        userId,
        createdAt: { gte: currentMonth }
      },
      _sum: { tokensUsed: true }
    });

    return {
      subscription: activeSubscription ? {
        tier: activeSubscription.tier,
        automationsUsed: activeSubscription.automationsUsed,
        automationsLimit: activeSubscription.automationsLimit,
        status: activeSubscription.status
      } : {
        tier: 'TRIAL',
        trialEndsAt: user.trialEndsAt,
        isExpired: user.trialEndsAt ? new Date() > user.trialEndsAt : false
      },
      usage: {
        monthlyAutomations: monthlyUsage,
        monthlyTokens: monthlyTokens._sum.tokensUsed || 0
      }
    };
  }
}

export const excelService = new ExcelService();