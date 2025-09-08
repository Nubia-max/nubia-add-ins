import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// Import services
const FinancialIntelligenceService = require('../services/financialIntelligence');
const DynamicExcelGenerator = require('../services/dynamicExcelGenerator');
const LLMService = require('../services/llmService');

const llmService = new LLMService();
const financialIntelligence = new FinancialIntelligenceService();
const excelGenerator = new DynamicExcelGenerator(llmService);

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

interface ExcelResult {
  success: boolean;
  filename: string;
  filepath: string;
  structure: string;
  worksheets: Array<{
    name: string;
    rowCount: number;
    columnCount: number;
  }>;
}

interface ExcelStructure {
  worksheets?: Array<any>;
  commands?: Array<any>;
  [key: string]: any;
}

interface ExcelCommands {
  commands: Array<any>;
}

// Helper function to clean and parse potentially malformed JSON
function cleanAndParseJSON(jsonString: string): any {
  try {
    // First attempt - direct parse
    return JSON.parse(jsonString);
  } catch (error) {
    // Clean common JSON issues
    let cleaned = jsonString
      .replace(/,\s*([}\]])/g, '$1')  // Remove trailing commas
      .replace(/,\s*,/g, ',')          // Remove double commas
      .replace(/\n\s*\n/g, '\n')       // Remove extra blank lines
      .replace(/\/\/.*$/gm, '')        // Remove comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
      .trim();
    
    try {
      return JSON.parse(cleaned);
    } catch (secondError) {
      // More aggressive cleaning
      cleaned = cleaned
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']')
        .replace(/:\s*,/g, ': null,')
        .replace(/\[\s*,/g, '[')
        .replace(/,\s*,+/g, ',')
        .replace(/"\s*:\s*undefined/g, '": null')
        .trim();
      
      try {
        return JSON.parse(cleaned);
      } catch (finalError) {
        console.error('JSON parsing failed after cleaning:', finalError);
        return null;
      }
    }
  }
}

// Universal chat endpoint - Complete GPT freedom with GAAP
export const handleUniversalChat = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { message, context } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Message is required' 
      });
    }

    console.log('💬 Processing message:', message.substring(0, 100));

    // Check usage limits
    const subscription = await prisma.subscription.findFirst({
      where: { userId }
    });

    if (subscription && subscription.automationsLimit !== -1) {
      if (subscription.automationsUsed >= subscription.automationsLimit) {
        return res.status(429).json({
          error: 'Usage limit exceeded',
          message: `You've reached your monthly limit of ${subscription.automationsLimit} automations. Please upgrade your plan.`
        });
      }
    }

    // GPT call with complete freedom and GAAP
    const gptResponse = await llmService.createCompletion({
      model: 'gpt-4o',
      messages: [
        {
  role: 'system',
  content: `You are NUBIA — a multi-credential accountant (CPA/CA/ACCA/CMA/CIA/CFE/CFA) with expert mastery of IFRS, IPSAS, and all major national GAAPs (US GAAP, UK GAAP/FRS, J-GAAP, Ind AS, ASPE, K-GAAP, CN GAAP, etc.). You must produce outputs in the exact formats most practitioners (>70%) in the applicable specialty would deliver today. You have COMPLETE FREEDOM to design any Excel structure (no templates/fallbacks). The UI will show ONLY your chat summary; JSON stays hidden.

INFERENCE HIERARCHY (apply in order):
1) If the user specifies framework/jurisdiction/industry/role, obey exactly (e.g., “US GAAP manufacturing”, “IPSAS accrual Nigeria”, “J-GAAP insurance”, “Audit working papers”).
2) Otherwise infer from context (country, sector, terminology, currency).
3) Default: IFRS for private sector; IPSAS for public sector. Declare your choice in meta.

ROLE ROUTER (choose the dominant mode; if multiple are required, include all that apply):
- MODE_BOOKKEEPER → journals → ledgers → trial balance → controls
- MODE_MGMT_COST → costing (standard/ABC/process/job), budgets, variances, CVP
- MODE_FIN_REPORT → FS + notes/disclosures per framework (BS/IS/CF/Equity)
- MODE_FIN_ANALYST → ratios, common-size, trend, DCF/multiples, KPIs, dashboards
- MODE_TAX → book→tax adjustments, VAT/GST/WHT, capital allowances, returns
- MODE_AUDIT → risk-based plan, materiality, sampling, TOC/substantive tests, tie-outs, management letter
- MODE_FORENSIC → hypotheses, Benford/anomaly tests, findings, recovery actions

STRICT TWO-BLOCK CONTRACT — ALWAYS RESPOND WITH EXACTLY THESE TWO BLOCKS:

[CHAT_RESPONSE]
Write 1–4 warm, human sentences summarizing what you built and the key integrity checks (e.g., “Debits = Credits passed”). Do NOT include JSON, code, or templates here.
[/CHAT_RESPONSE]

[EXCEL_DATA]
{
  "meta": {
    "mode": "<MODE_*>",
    "framework": "<IFRS|IPSAS|US GAAP|J-GAAP|...>",
    "jurisdiction": "<country/region or 'global'>",
    "industry": "<insurance|manufacturing|government|nonprofit|...>",
    "currency": "<ISO + symbol, e.g., NGN (₦) or USD ($)>",
    "period": {"start":"YYYY-MM-DD","end":"YYYY-MM-DD"},
    "assumptions": ["explicit assumptions if data was missing"],
    "majority_practice_basis": "short note on why the chosen structure reflects common professional practice"
  },
  "workbook": [
    // Populate with ACTUAL data. No empty sheets. Design freely.
    // Minimum for MODE_BOOKKEEPER:
    {"name":"GeneralJournal","columns":["Date","DocNo","Account","Code","Description","Debit","Credit","Counterparty","CostCenter","Project","TaxCode"],"rows":[...]},
    {"name":"Ledgers","subtables":[{"account":"Cash","columns":["Date","DocNo","Description","Ref","Debit","Credit","RunningBalance","DrCr"],"rows":[...]}]},
    {"name":"TrialBalance","columns":["Account","Code","Debit","Credit","Balance","DrCr"],"rows":[...]},
    {"name":"Controls","columns":["Check","Result","Detail"],"rows":[
      ["DebitsEqualCredits", true, "Total Dr = Total Cr"],
      ["TrialBalanceZeroes", true, "Sum(Balance)=0"],
      ["IntegrityDates", true, "All dates in ISO"],
      ["CurrencyConsistency", true, "All amounts in meta.currency"]
    ]},
    // Add role/sector-specific sheets only when relevant (examples):
    {"name":"IncomeStatement","columns":["LineItem","Amount","Notes"],"rows":[...]},
    {"name":"BalanceSheet","columns":["LineItem","Amount","Classification","Notes"],"rows":[...]},
    {"name":"CashFlow","columns":["Activity","LineItem","Amount","Method"],"rows":[...]},
    {"name":"Notes","columns":["Ref","Disclosure","Framework","Detail"],"rows":[...]},
    {"name":"ChartOfAccounts","columns":["AccountCode","AccountName","Type","SubType","NormalBalance","IndustryTag"],"rows":[...]},
    {"name":"COGM_COGS","columns":["Component","Amount","Notes"],"rows":[...]},                    // manufacturing
    {"name":"Insurance_Measurement","columns":["Portfolio","Group","FCF","RiskAdj","CSM","LRC","LIC"],"rows":[...]}, // insurance (IFRS 17/J-GAAP)
    {"name":"Government_Budget","columns":["BudgetLine","Approved","Revised","Actual","Variance","Commitments","Obligations"],"rows":[...]} // IPSAS/public
  ],
  "commands": [
    // Any Excel commands the system can execute after writing data:
    // formatting, number formats, validations, conditional formats, formulas, named ranges,
    // pivots, charts, hyperlinks, protection, slicers. Use plain JSON, no markdown fences.
  ]
}
[/EXCEL_DATA]

HARD RULES:
- Populate every included sheet (no empties). Be deterministic: ISO dates; numeric amounts (currency symbols via formatting only).
- Double-entry integrity where applicable: Debits = Credits; Trial Balance sum = 0 — reflect in Controls.
- Anticipate user needs: include standard artifacts practitioners expect for the selected mode/industry/framework.
- NEVER output [EXCEL_COMMANDS] as a separate block. Put all execution instructions in the "commands" array inside [EXCEL_DATA].
- The UI will hide JSON. Keep all explanations ONLY in [CHAT_RESPONSE].
`
}
,
        {
          role: 'user',
          content: message
        }
      ],
      temperature: 0.5, // Lower for more consistent JSON
      max_tokens: 4000
    });
    
    const gptMessage = gptResponse.choices[0].message.content;
    console.log('🤖 GPT Response received');
    
    // Parse response
    let chatResponse = gptMessage;
    let excelStructure: ExcelStructure | null = null;
    let excelCommands: ExcelCommands | null = null;
    let excelResult: ExcelResult | null = null;
    
    // Extract Excel data with robust parsing
    if (gptMessage.includes('[EXCEL_DATA]')) {
      try {
        const excelDataIndex = gptMessage.indexOf('[EXCEL_DATA]');
        chatResponse = gptMessage.substring(0, excelDataIndex).trim();
        
        const excelMatch = gptMessage.match(/\[EXCEL_DATA\]([\s\S]*?)\[\/EXCEL_DATA\]/);
        if (excelMatch) {
          const jsonStr = excelMatch[1].trim();
          excelStructure = cleanAndParseJSON(jsonStr) as ExcelStructure;
          
          if (!excelStructure) {
            console.warn('Could not parse Excel structure, will generate directly');
          }
        }
        
        // Extract commands
        if (gptMessage.includes('[EXCEL_COMMANDS]')) {
          const commandMatch = gptMessage.match(/\[EXCEL_COMMANDS\]([\s\S]*?)\[\/EXCEL_COMMANDS\]/);
          if (commandMatch) {
            const cmdStr = commandMatch[1].trim();
            excelCommands = cleanAndParseJSON(cmdStr) as ExcelCommands;
          }
        }
        
      } catch (error) {
        console.error('Failed to parse Excel data:', error);
      }
    }
    
    // Generate Excel with complete freedom
    if (excelStructure) {
      try {
        if (excelCommands?.commands) {
          excelStructure.commands = excelCommands.commands;
        }
        
        console.log('✅ Creating Excel with GPT\'s free structure');
        excelResult = await excelGenerator.generateWithCompleteFreeedom(excelStructure, userId) as ExcelResult;
        
        if (subscription && excelResult?.success) {
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { automationsUsed: subscription.automationsUsed + 1 }
          });
        }
      } catch (error) {
        console.error('Excel generation with structure failed:', error);
      }
    }
    
    // Fallback: Generate from message if no structure
    if (!excelResult && /record|journal|book|transaction|account/i.test(message)) {
      try {
        console.log('📊 Generating Excel from message directly');
        excelResult = await excelGenerator.generateAccountingWorkbook(message, userId) as ExcelResult;
        
        if (subscription && excelResult?.success) {
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { automationsUsed: subscription.automationsUsed + 1 }
          });
        }
      } catch (error) {
        console.error('Direct Excel generation failed:', error);
      }
    }
    
    // Clean chat response - remove ALL technical content
    chatResponse = chatResponse
      .replace(/\[EXCEL_DATA\][\s\S]*?\[\/EXCEL_DATA\]/g, '')
      .replace(/\[EXCEL_COMMANDS\][\s\S]*?\[\/EXCEL_COMMANDS\]/g, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/\{[\s\S]*?\}/g, '')
      .replace(/\[.*?\]/g, '')
      .trim();
    
    // Ensure conversational response
    if (!chatResponse || chatResponse.length < 10) {
      if (excelResult) {
        chatResponse = "I've created your comprehensive accounting workbook with all necessary journals and statements. Everything is recorded following GAAP principles with proper double-entry bookkeeping.";
      } else {
        chatResponse = "I'm ready to help with your accounting needs. What would you like me to record?";
      }
    }
    
    // Store session
    await prisma.chatSession.create({
      data: {
        userId,
        messages: JSON.stringify([
          { role: 'user', content: message },
          { role: 'assistant', content: chatResponse }
        ]),
        tokensUsed: gptResponse.usage?.total_tokens || 0
      }
    });
    
    // Return clean response
    if (excelResult && excelResult.success) {
      return res.json({
        success: true,
        type: 'excel',
        message: chatResponse,
        excelData: {
          filename: excelResult.filename,
          filepath: excelResult.filepath,
          summary: excelResult.structure,
          worksheets: excelResult.worksheets
        }
      });
    } else {
      return res.json({ 
        success: true,
        type: 'chat', 
        message: chatResponse
      });
    }

  } catch (error: any) {
    console.error('❌ Chat API error:', error);
    
    let errorMessage = 'I encountered an issue. Please try again.';
    if (error.message?.includes('quota')) {
      errorMessage = 'Service temporarily at capacity. Please try again shortly.';
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
};

// Get chat history
export const getChatHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const sessions = await prisma.chatSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    
    res.json({
      success: true,
      sessions
    });
    
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch chat history'
    });
  }
};

// Delete chat session
export const deleteChatSession = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    await prisma.chatSession.deleteMany({
      where: {
        id: sessionId,
        userId
      }
    });
    
    res.json({
      success: true,
      message: 'Session deleted'
    });
    
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete session'
    });
  }
};

export default {
  handleUniversalChat,
  getChatHistory,
  deleteChatSession
};