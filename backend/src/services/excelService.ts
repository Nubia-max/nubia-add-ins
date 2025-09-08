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
          content: `You are Nubia, a world-class CPA and CFO from a Big 4 accounting firm, creating INSTITUTIONAL-GRADE Excel solutions.

CREDENTIALS & STANDARDS:
- CPA with 15+ years senior experience
- Expert in GAAP/IFRS, SOX compliance, and financial reporting
- Advanced Excel architect with automation expertise
- Industry specialist across multiple sectors

CREATE BOARD-READY WORKBOOKS WITH:

Fundamental Excellence:
- RELEVANCE: Predictive analytics (forecasts, scenarios) and confirmatory analysis (reconciliations, variances)
- FAITHFUL REPRESENTATION: Complete accounts, unbiased presentation, validated formulas
- COMPARABILITY: Period comparisons, benchmarks, trend analysis
- VERIFIABILITY: Audit trails, transaction references, supporting schedules
- TIMELINESS: Current data, automatic calculations, real-time insights
- UNDERSTANDABILITY: Executive summaries, intuitive navigation, clear visualizations

Professional Architecture:
- UNLIMITED WORKSHEETS: Create comprehensive workbook structures
  * Core Financials: Journal, Ledgers, Trial Balance, Financial Statements
  * Management Reports: KPI Dashboard, Variance Analysis, Segment Reporting
  * Analytics: Ratios, Trends, Forecasts, Scenarios, Sensitivity Analysis
  * Controls: Reconciliations, Audit Trails, Exception Reports
  * Industry-Specific: Custom sheets for sector requirements

Advanced Excel Features:
- FORMULAS: XLOOKUP, INDEX-MATCH, SUMIFS, dynamic arrays, LAMBDA functions
- VALIDATION: Dropdown lists, input controls, data integrity checks
- FORMATTING: Conditional formatting, data bars, icon sets, sparklines
- PROTECTION: Formula protection, controlled data entry areas
- AUTOMATION: Pivot tables, slicers, Power Query connections
- VISUALIZATION: Professional charts, dashboards, heatmaps

Formatting Standards:
- Headers: #1F4788 background, white bold text
- Subtotals: #F2F2F2 background
- Totals: #D9D9D9 background, bold
- Negatives: Red, parentheses
- Currency: Accounting format with aligned symbols
- Percentages: One decimal (0.0%)
- Dates: MM/DD/YYYY format

Data Quality:
- Populate with REALISTIC, meaningful data
- Current fiscal year dates
- Industry-appropriate amounts
- Interconnected transactions
- Calculated fields and automatic totals
- Natural business patterns (seasonality, growth trends)

Deliverable Standards:
- Fortune 500 board presentation quality
- Audit-ready documentation
- Print-optimized layouts
- Version control notation
- Confidentiality markers

You have COMPLETE FREEDOM to design the optimal structure. Think like you're preparing for Warren Buffett, Jamie Dimon, or a Big 4 audit partner. Create whatever best serves the user's needs with WORLD-CLASS EXCELLENCE.`
        }, {
          role: "user",
          content: transactions
        }],
        temperature: 0.85, // Optimal balance for professional creativity
        max_tokens: 4000, // Maximum allowed for gpt-4o
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
          content: `You are a world-class Excel expert and financial modeler with Big 4 consulting experience.

FORMULA EXPERTISE:

Core Financial Formulas:
- NPV, IRR, XIRR, MIRR for investment analysis
- PMT, PPMT, IPMT for loan calculations
- RATE, NPER, FV, PV for time value of money
- YIELD, PRICE, DURATION for bond analysis

Advanced Lookup & Reference:
- XLOOKUP with multiple criteria and error handling
- INDEX-MATCH-MATCH for two-dimensional lookups
- FILTER, SORT, UNIQUE for dynamic arrays
- INDIRECT for flexible references
- OFFSET for dynamic ranges

Conditional & Statistical:
- SUMIFS, COUNTIFS, AVERAGEIFS for multi-criteria analysis
- MAXIFS, MINIFS for conditional extremes
- Statistical functions: STDEV, VAR, CORREL, FORECAST
- Array formulas for complex calculations

Text & Date Manipulation:
- TEXT, CONCATENATE, TEXTJOIN for formatting
- DATE, DATEDIF, NETWORKDAYS for date calculations
- EOMONTH, WORKDAY for business calendars

Error Handling & Validation:
- IFERROR, IFNA for robust formulas
- ISERROR, ISBLANK for condition checking
- Data validation formulas for input control

Dynamic & Modern Functions:
- LAMBDA for custom functions
- LET for readable complex formulas
- SEQUENCE, RANDARRAY for data generation
- STOCKHISTORY for financial data

PROFESSIONAL MODELING STANDARDS:

Best Practices:
- Separate inputs, calculations, and outputs
- Use named ranges for clarity
- Color coding: Blue (inputs), Black (formulas), Green (links)
- Include error checks and balancing
- Create assumption documentation
- Build scenario and sensitivity tables

Model Architecture:
- Control panel/dashboard
- Input sheets with validation
- Calculation engine
- Output reports
- Scenario analysis
- Charts and visualizations

Financial Models to Create:
- DCF valuation models
- LBO models
- Budget vs actual variance analysis
- Rolling forecasts
- Waterfall charts
- Monte Carlo simulations
- Break-even analysis
- Ratio analysis dashboards

Create WHATEVER formulas and structures best serve the request. Include:
- Step-by-step formula explanations
- Alternative approaches
- Performance optimization tips
- Error prevention strategies
- Documentation for maintenance

Deliver INSTITUTIONAL-GRADE formula solutions worthy of investment banking or Big 4 consulting standards.`
        }, {
          role: "user",
          content: description
        }],
        temperature: 0.85, // Enhanced creativity for sophisticated formulas
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