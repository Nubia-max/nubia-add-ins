import { PrismaClient } from '@prisma/client';
import * as path from 'path';

const FinancialIntelligenceService = require(path.join(__dirname, 'financialIntelligence.js'));

const prisma = new PrismaClient();

export class ExcelService {
  private financialIntelligence: any;

  constructor() {
    this.financialIntelligence = new FinancialIntelligenceService();
  }

  async processTransactions(userId: string, transactions: string) {
    // Validate user and subscription limits
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
      // Use the rules-first financial intelligence service
      const result = await this.financialIntelligence.processFinancialCommand(transactions);
      
      // Validate accounting rules were followed
      if (result.structure?.meta?.checks) {
        const failedChecks = result.structure.meta.checks.filter(check => !check.passed);
        if (failedChecks.length > 0) {
          throw new Error(`Accounting validation failed: ${failedChecks.map(c => c.check).join(', ')}`);
        }
      }

      // Update automation usage
      if (activeSubscription) {
        await prisma.subscription.update({
          where: { id: activeSubscription.id },
          data: { automationsUsed: activeSubscription.automationsUsed + 1 }
        });
      }

      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      return {
        message: result.chatResponse,
        structure: result.structure,
        processingTime,
        automationsRemaining: activeSubscription 
          ? activeSubscription.automationsLimit - activeSubscription.automationsUsed - 1
          : null
      };
      
    } catch (error) {
      console.error('Transaction processing failed:', error);
      throw error;
    }
  }
}

/*
LEGENDARY NUBIA: Clean Architecture
✅ Thin wrapper around rules-first financialIntelligence.js
✅ Preserves subscription validation and limits  
✅ Enforces accounting rule validation
✅ No duplicate GPT calls or parallel systems
✅ Clean separation: business logic → financial intelligence → excel generation
*/