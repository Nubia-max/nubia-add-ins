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
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are Nubia, a warm and personable Excel accounting assistant who loves helping people organize their finances.

When users give you accounting transactions or data to record:

1. FIRST: Respond conversationally like a helpful friend. Be warm, specific about what you're creating, and show you understand their needs. Examples:
   - "I'll get those June transactions recorded for you! I'm creating a complete set of accounting books with your business startup entry properly recorded across all the journals."
   - "Let me set up your business books with that initial ₦10,000 capital investment. I'll create proper double-entry records in the General Journal, update your Cash Book, and prepare a Trial Balance."
   
2. THEN: Include the Excel structure in a hidden section using this format:

[EXCEL_DATA]
{
  "worksheets": [Create whatever sheets make accounting sense - complete freedom here]
}
[/EXCEL_DATA]

CRITICAL RULES:
- Be conversational and specific, not generic ("I've processed your request" is BAD)
- Mention what you're actually creating (which books, what transactions)
- Show personality and warmth
- Create populated Excel sheets with actual data, not empty templates
- Use proper accounting with real amounts from their message
- Never show JSON or technical terms in the conversational part

For non-Excel queries, just chat naturally and helpfully.`
        },
        {
          role: 'user',
          content: message
        }
      ],
      temperature: 0.7, // Balanced for accuracy and creativity
      max_tokens: 4000
    });
    
    const gptMessage = gptResponse.choices[0].message.content;
    console.log('🤖 GPT Response received');
    
    // Parse response
    let chatResponse = gptMessage;
    let excelResult: ExcelResult | null = null;
    
    // Check if Excel data is present
    if (gptMessage.includes('[EXCEL_DATA]')) {
      try {
        // Extract chat response (everything before [EXCEL_DATA])
        const excelDataIndex = gptMessage.indexOf('[EXCEL_DATA]');
        chatResponse = gptMessage.substring(0, excelDataIndex).trim();
        
        // Extract Excel JSON
        const excelMatch = gptMessage.match(/\[EXCEL_DATA\]([\s\S]*?)\[\/EXCEL_DATA\]/);
        if (excelMatch) {
          const excelJsonStr = excelMatch[1].trim();
          const excelStructure = JSON.parse(excelJsonStr);
          
          // Validate structure has actual data
          const hasData = excelStructure.worksheets?.some((ws: any) => 
            ws.data && ws.data.length > 0
          );
          
          if (!hasData) {
            console.warn('⚠️ Excel structure has no data, skipping Excel generation');
          } else {
            console.log('✅ Creating Excel with', excelStructure.worksheets?.length || 0, 'worksheets');
            
            // Generate Excel file
            excelResult = await excelGenerator.generateAccountingWorkbook(message, userId) as ExcelResult;
            
            // Update usage counter
            if (subscription && excelResult?.success) {
              await prisma.subscription.update({
                where: { id: subscription.id },
                data: { automationsUsed: subscription.automationsUsed + 1 }
              });
            }
          }
        }
      } catch (error) {
        console.error('Failed to parse Excel data:', error);
        // Continue with just the chat response
      }
    } else {
      // Check if this seems like it should have Excel (contains transaction keywords)
      const needsExcel = /record|transaction|journal|book|entry|debit|credit|₦|naira|\d+[,.]?\d*/.test(message.toLowerCase());
      
      if (needsExcel) {
        // GPT didn't provide Excel structure, but user seems to want it
        console.log('📊 User seems to want Excel, generating from message');
        try {
          excelResult = await excelGenerator.generateAccountingWorkbook(message, userId) as ExcelResult;
          
          if (subscription && excelResult?.success) {
            await prisma.subscription.update({
              where: { id: subscription.id },
              data: { automationsUsed: subscription.automationsUsed + 1 }
            });
          }
        } catch (error) {
          console.error('Excel generation failed:', error);
        }
      }
    }
    
    // Clean up chat response - remove any remaining technical content
    chatResponse = chatResponse
      .replace(/\[EXCEL_DATA\][\s\S]*?\[\/EXCEL_DATA\]/g, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/\{[\s\S]*?\}/g, '')
      .trim();
    
    // Ensure we have a good response
    if (!chatResponse || chatResponse.length < 10) {
      if (excelResult) {
        chatResponse = "I've created your accounting workbook with all the transactions properly recorded. You'll find the General Journal, Cash Book, and Trial Balance sheets all set up with your data.";
      } else {
        chatResponse = "I'm here to help! What would you like me to do with your accounting data?";
      }
    }
    
    // Store chat session
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
    
    // Return response
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
    
    // User-friendly error messages
    let errorMessage = 'I encountered an issue processing your request. Please try again.';
    
    if (error.message?.includes('quota')) {
      errorMessage = 'Our AI service is temporarily at capacity. Please try again in a moment.';
    } else if (error.message?.includes('rate')) {
      errorMessage = 'Too many requests. Please wait a moment before trying again.';
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

// Export all functions
export default {
  handleUniversalChat,
  getChatHistory,
  deleteChatSession
};