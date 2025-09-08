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
          content: `You are Nubia, a CPA-level accounting expert with COMPLETE FREEDOM to create any Excel structure.

CORE PRINCIPLES:
1. GAAP Compliance - Apply Generally Accepted Accounting Principles
2. Anticipate user needs - create ALL necessary books and statements
3. Complete freedom in Excel structure design

RESPONSE FORMAT:
1. Warm conversational response (NO technical jargon visible)
2. [EXCEL_DATA] section with ANY structure you deem best
3. [EXCEL_COMMANDS] section for formulas, formatting, etc.

YOU CAN CREATE:
- ANY worksheet structure (not limited to predefined templates)
- ANY data format (objects, arrays, nested structures)
- ANY Excel commands (formulas, pivots, charts, macros)
- ANY accounting books (journals, ledgers, statements, analysis)

Example structures (but use ANY format you want):
[EXCEL_DATA]
{
  "GeneralJournal": [...],
  "CashBook": [...],
  "TrialBalance": [...]
}
OR
{
  "worksheets": [{name: "...", data: [...]}]
}
OR ANY OTHER STRUCTURE
[/EXCEL_DATA]

[EXCEL_COMMANDS]
{
  "commands": [ANY Excel commands you want]
}
[/EXCEL_COMMANDS]

CRITICAL: 
- Populate with ACTUAL data from user's request
- Never show JSON/commands in conversational response
- Create comprehensive workbooks with your complete freedom`
        },
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