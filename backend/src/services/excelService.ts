import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class ExcelService {
  private openai: OpenAI;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    
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
        model: "gpt-4o",
        messages: [{
          role: "system",
          content: `You are Nubia, an expert financial analyst and accountant with COMPLETE FREEDOM to design optimal Excel structures.

Create whatever makes most sense for the user's request:
- Unlimited worksheets (Journal, Ledgers, Cash Book, Bank Book, Trial Balance, P&L, Balance Sheet, or anything else)
- Any column structure that makes accounting or business sense
- Include formulas, calculations, pivot tables, charts - whatever is needed
- Handle any type of data - financial, personal, creative, anything

You decide the best structure. Be creative and comprehensive.`
        }, {
          role: "user",
          content: transactions
        }],
        temperature: 0.7,
        max_tokens: 4000, // Maximum allowed for gpt-4-turbo-preview
        // REMOVED: response_format restriction for natural language + JSON freedom
      });

      const executionTime = Date.now() - startTime;
      const tokensUsed = completion.usage?.total_tokens || 0;
      
      const gptResponse = completion.choices[0].message.content || '';
      
      // Parse JSON from GPT's natural language response
      let result;
      try {
        const jsonStart = gptResponse.indexOf('{');
        const jsonEnd = gptResponse.lastIndexOf('}') + 1;
        
        if (jsonStart !== -1 && jsonEnd > jsonStart) {
          let jsonStr = gptResponse.substring(jsonStart, jsonEnd);
          
          // Clean up markdown code blocks
          if (jsonStr.includes('```json')) {
            jsonStr = jsonStr.split('```json')[1].split('```')[0];
          } else if (jsonStr.includes('```')) {
            jsonStr = jsonStr.split('```')[1].split('```')[0];
          }
          
          result = JSON.parse(jsonStr.trim());
        } else {
          throw new Error('No JSON structure found');
        }
      } catch (error) {
        throw new Error('Failed to parse Excel structure from GPT response');
      }

      // Accept whatever structure GPT created (much more flexible)
      if (!result || typeof result !== 'object') {
        throw new Error('GPT did not provide a valid Excel structure');
      }
      
      // Store the full GPT response for richer context
      result._gptResponse = gptResponse;

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
        model: "gpt-4o",
        messages: [{
          role: "system",
          content: `You are an Excel expert with complete freedom to create any formulas, calculations, or structures needed.

Create whatever formulas and structures make most sense for the request.
Be creative and comprehensive. You can suggest entire worksheet structures if beneficial.`
        }, {
          role: "user",
          content: description
        }],
        temperature: 0.7,
        max_tokens: 2000,
        // REMOVED: response_format restriction for natural language + JSON freedom
      });

      const executionTime = Date.now() - startTime;
      const tokensUsed = completion.usage?.total_tokens || 0;
      
      const gptResponse = completion.choices[0].message.content || '';
      
      // Parse JSON from GPT's natural language response
      let result;
      try {
        const jsonStart = gptResponse.indexOf('{');
        const jsonEnd = gptResponse.lastIndexOf('}') + 1;
        
        if (jsonStart !== -1 && jsonEnd > jsonStart) {
          let jsonStr = gptResponse.substring(jsonStart, jsonEnd);
          
          // Clean up markdown code blocks
          if (jsonStr.includes('```json')) {
            jsonStr = jsonStr.split('```json')[1].split('```')[0];
          } else if (jsonStr.includes('```')) {
            jsonStr = jsonStr.split('```')[1].split('```')[0];
          }
          
          result = JSON.parse(jsonStr.trim());
        } else {
          throw new Error('No JSON structure found');
        }
      } catch (error) {
        throw new Error('Failed to parse formula structure from GPT response');
      }
      
      // Store the full GPT response for context
      result._gptResponse = gptResponse;

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