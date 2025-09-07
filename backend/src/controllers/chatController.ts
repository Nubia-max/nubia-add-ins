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

// Universal chat endpoint - Complete GPT freedom
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

    // Single GPT call with complete freedom
    const gptResponse = await llmService.createCompletion({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `You are Nubia, an expert in Excel and accounting. 
          
When users ask you to record transactions, create spreadsheets, or handle accounting tasks, you should:
1. Respond conversationally about what you'll create
2. Include a JSON structure for the Excel file (can be anywhere in your response)

You have complete freedom to design any Excel structure that makes sense.`
        },
        {
          role: 'user',
          content: message
        }
      ],
      temperature: 0.9,
      max_tokens: 4000
    });
    
    const gptMessage = gptResponse.choices[0].message.content;
    console.log('🤖 GPT Response received');
    
    // Check if GPT included JSON for Excel creation
    let excelCreated = false;
    let excelResult: ExcelResult | null = null;
    
    // Look for JSON in the response
    if (gptMessage.includes('{') && gptMessage.includes('worksheets')) {
      console.log('📊 Detected Excel structure in response');
      
      try {
        // Extract JSON from the response
        let jsonStr = gptMessage;
        
        // Try to find JSON boundaries
        const jsonStart = jsonStr.indexOf('{');
        const jsonEnd = jsonStr.lastIndexOf('}') + 1;
        
        if (jsonStart !== -1 && jsonEnd > jsonStart) {
          jsonStr = jsonStr.substring(jsonStart, jsonEnd);
        }
        
        // Clean up if wrapped in markdown
        if (jsonStr.includes('```json')) {
          jsonStr = jsonStr.split('```json')[1].split('```')[0];
        } else if (jsonStr.includes('```')) {
          jsonStr = jsonStr.split('```')[1].split('```')[0];
        }
        
        // Parse the JSON structure
        const excelStructure = JSON.parse(jsonStr);
        
        // Generate Excel file using the structure
        excelResult = await excelGenerator.generateAccountingWorkbook(message, userId) as ExcelResult;
        excelCreated = true;
        
        // Increment usage counter
        if (subscription && excelResult && excelResult.success) {
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { automationsUsed: subscription.automationsUsed + 1 }
          });
        }
        
      } catch (parseError) {
        console.log('📝 No valid Excel JSON found, treating as chat only');
      }
    }
    
    // Store chat session
    await prisma.chatSession.create({
      data: {
        userId,
        messages: JSON.stringify([
          { role: 'user', content: message },
          { role: 'assistant', content: gptMessage }
        ]),
        tokensUsed: gptResponse.usage?.total_tokens || 0
      }
    });
    
    // Return response
    if (excelCreated && excelResult) {
      // Remove JSON from the message for cleaner display
      let cleanMessage = gptMessage;
      const jsonStart = cleanMessage.indexOf('{');
      const jsonEnd = cleanMessage.lastIndexOf('}') + 1;
      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        cleanMessage = cleanMessage.substring(0, jsonStart) + cleanMessage.substring(jsonEnd);
      }
      
      return res.json({
        success: true,
        type: 'excel',
        message: cleanMessage.trim(),
        excelData: {
          filename: excelResult.filename,
          filepath: excelResult.filepath,
          summary: excelResult.structure,
          worksheets: excelResult.worksheets
        }
      });
    } else {
      // Just a chat response
      return res.json({ 
        success: true,
        type: 'chat', 
        message: gptMessage
      });
    }

  } catch (error: any) {
    console.error('❌ Chat API error:', error);
    res.status(500).json({
      success: false,
      error: error.message
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

// Export all functions
export default {
  handleUniversalChat,
  getChatHistory,
  deleteChatSession
};