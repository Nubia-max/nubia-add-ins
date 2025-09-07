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
          content: `You are Nubia, a friendly Excel assistant who helps users with accounting tasks.

IMPORTANT RESPONSE FORMAT:
1. ALWAYS start with a friendly conversational response for the user
2. Then add a special section with Excel data
3. Use this exact format:

[CHAT_RESPONSE]
Your friendly response here (NO technical jargon, NO mention of debits/credits unless asked, NO JSON visible)
[/CHAT_RESPONSE]

[EXCEL_DATA]
{
  "worksheets": [
    {
      "name": "General Journal",
      "columns": [...],
      "data": [ACTUAL populated transaction data with real amounts, dates, descriptions]
    }
  ]
}
[/EXCEL_DATA]

For the EXCEL_DATA section:
- Create multiple interconnected accounting worksheets (General Journal, Cash Book, Ledgers, Trial Balance, etc.)
- POPULATE with the actual transaction data from the user's request
- Include real amounts, proper dates, account names, and descriptions
- Add formulas for running balances and calculations
- Design whatever structure best serves the accounting need

For the CHAT_RESPONSE section:
- Be warm and conversational
- Simply tell them you've recorded their transactions
- Don't mention technical accounting terms unless they ask
- Don't show any JSON or technical details`
        },
        {
          role: 'user',
          content: message
        }
      ],
      temperature: 0.9, // High creativity for rich accounting structures
      max_tokens: 4000 // Maximum allowed for gpt-4-turbo-preview
    });
    
    const gptMessage = gptResponse.choices[0].message.content;
    console.log('🤖 GPT Response received');
    
    // Separate chat response from Excel data
    let chatResponse = '';
    let excelStructure: any = null;
    let excelCreated = false;
    let excelResult: ExcelResult | null = null;
    
    // Parse structured response format
    if (gptMessage.includes('[CHAT_RESPONSE]') && gptMessage.includes('[EXCEL_DATA]')) {
      console.log('📋 Parsing structured response with chat and Excel data');
      
      try {
        // Extract clean chat response
        const chatMatch = gptMessage.match(/\[CHAT_RESPONSE\]([\s\S]*?)\[\/CHAT_RESPONSE\]/);
        if (chatMatch) {
          chatResponse = chatMatch[1].trim();
        }
        
        // Extract Excel data structure
        const excelMatch = gptMessage.match(/\[EXCEL_DATA\]([\s\S]*?)\[\/EXCEL_DATA\]/);
        if (excelMatch) {
          let excelJsonStr = excelMatch[1].trim();
          
          // Clean up markdown if present
          if (excelJsonStr.includes('```json')) {
            excelJsonStr = excelJsonStr.split('```json')[1].split('```')[0];
          } else if (excelJsonStr.includes('```')) {
            excelJsonStr = excelJsonStr.split('```')[1].split('```')[0];
          }
          
          excelStructure = JSON.parse(excelJsonStr.trim()) as any;
          console.log('✅ Parsed Excel structure with', (excelStructure as any)?.worksheets?.length || 0, 'worksheets');
          
          // Generate populated Excel file using the structure
          excelResult = await excelGenerator.generateFromStructure(excelStructure, message, userId) as ExcelResult;
          excelCreated = true;
        }
      } catch (parseError) {
        console.error('❌ Failed to parse structured response:', parseError);
        // Fallback to original message
        chatResponse = gptMessage;
      }
    } else {
      // Fallback: GPT didn't use structured format, clean up the response
      console.log('📝 No structured format detected, cleaning up response');
      
      // Try to extract JSON and clean the message
      let cleanedMessage = gptMessage;
      
      // Remove any JSON structures from the message
      if (cleanedMessage.includes('{') && (cleanedMessage.includes('worksheet') || cleanedMessage.includes('sheet'))) {
        try {
          // Find JSON boundaries
          const jsonStart = cleanedMessage.indexOf('{');
          const jsonEnd = cleanedMessage.lastIndexOf('}') + 1;
          
          if (jsonStart !== -1 && jsonEnd > jsonStart) {
            let jsonStr = cleanedMessage.substring(jsonStart, jsonEnd);
            
            // Clean up markdown if present
            if (jsonStr.includes('```json')) {
              jsonStr = jsonStr.split('```json')[1].split('```')[0];
            } else if (jsonStr.includes('```')) {
              jsonStr = jsonStr.split('```')[1].split('```')[0];
            }
            
            // Try to parse and use the JSON for Excel generation
            const parsedStructure = JSON.parse(jsonStr.trim()) as any;
            console.log('✅ Found and parsed Excel structure from unformatted response');
            
            // Generate Excel file
            excelResult = await excelGenerator.generateFromStructure(parsedStructure, message, userId) as ExcelResult;
            excelCreated = true;
            
            // Clean the message by removing JSON
            cleanedMessage = cleanedMessage.substring(0, jsonStart).trim();
            
            // If nothing is left, provide a default message
            if (!cleanedMessage) {
              cleanedMessage = 'I\'ve recorded your transactions in a comprehensive accounting workbook with multiple sheets including General Journal, Cash Book, and Trial Balance.';
            }
          }
        } catch (error) {
          console.log('⚠️ Could not parse JSON from unformatted response:', error);
          // Remove any JSON-like content manually
          cleanedMessage = cleanedMessage.replace(/\{[\s\S]*\}/g, '').trim();
          if (!cleanedMessage) {
            cleanedMessage = 'I\'ve processed your request. Please check the generated files.';
          }
        }
      }
      
      // Remove any remaining technical markers
      cleanedMessage = cleanedMessage
        .replace(/\[EXCEL_DATA\][\s\S]*?\[\/EXCEL_DATA\]/g, '')
        .replace(/\[CHAT_RESPONSE\][\s\S]*?\[\/CHAT_RESPONSE\]/g, '')
        .replace(/```json[\s\S]*?```/g, '')
        .replace(/```[\s\S]*?```/g, '')
        .trim();
      
      if (!cleanedMessage) {
        cleanedMessage = 'I\'ve processed your request successfully.';
      }
      
      chatResponse = cleanedMessage;
    }
    
    // Increment usage counter if Excel was created
    if (subscription && excelCreated && excelResult && excelResult.success) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { automationsUsed: subscription.automationsUsed + 1 }
      });
    }
    
    // Store chat session (save only the clean response, not raw GPT output)
    await prisma.chatSession.create({
      data: {
        userId,
        messages: JSON.stringify([
          { role: 'user', content: message },
          { role: 'assistant', content: chatResponse || 'Response processed successfully.' }
        ]),
        tokensUsed: gptResponse.usage?.total_tokens || 0
      }
    });
    
    // Return clean response - GUARANTEED no JSON visible to user
    if (excelCreated && excelResult) {
      const cleanMessage = chatResponse || 'I\'ve recorded your transactions in a comprehensive accounting workbook with multiple sheets including General Journal, Cash Book, and Trial Balance.';
      
      return res.json({
        success: true,
        type: 'excel',
        message: cleanMessage,
        excelData: {
          filename: excelResult.filename,
          filepath: excelResult.filepath,
          summary: excelResult.structure,
          worksheets: excelResult.worksheets
        }
      });
    } else {
      // Just a chat response - ensure it's clean
      let cleanMessage = chatResponse;
      
      // Final safety check: remove any JSON that might have slipped through
      if (cleanMessage && (cleanMessage.includes('{') || cleanMessage.includes('[EXCEL_DATA]'))) {
        cleanMessage = cleanMessage
          .replace(/\\{[\\s\\S]*\\}/g, '')
          .replace(/\\[EXCEL_DATA\\][\\s\\S]*?\\[\\/EXCEL_DATA\\]/g, '')
          .replace(/```json[\\s\\S]*?```/g, '')
          .replace(/```[\\s\\S]*?```/g, '')
          .trim();
        
        if (!cleanMessage) {
          cleanMessage = 'I\'ve processed your request successfully.';
        }
      }
      
      return res.json({ 
        success: true,
        type: 'chat', 
        message: cleanMessage || 'Thank you for your message.'
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