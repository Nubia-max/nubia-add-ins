import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import FileProcessingService from '../services/fileProcessingService';

const prisma = new PrismaClient();

// Import services - use correct names
const FinancialIntelligenceService = require('../services/financialIntelligence');
const DynamicExcelGenerator = require('../services/dynamicExcelGenerator');
const LLMService = require('../services/llmService');

// Initialize with prompt-native registry
const llmService = new LLMService();
const financialIntelligence = new FinancialIntelligenceService();
const excelGenerator = new DynamicExcelGenerator(llmService);
const fileProcessingService = new FileProcessingService();

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

// Universal chat endpoint - Rules-First Accounting Engine
export const handleUniversalChat = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { message } = req.body;
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
    console.log('📏 Full message length:', message.length);
    
    // Debug: Log complete message if it contains bookkeeping keywords
    if (message.toLowerCase().includes('record') || message.toLowerCase().includes('june')) {
      console.log('📋 Complete bookkeeping message:', message);
    }

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

    // Call financial intelligence with rules-first
    const result = await financialIntelligence.processFinancialCommand(message);
    
    // Declare variables
    let excelResult: ExcelResult | null = null;
    
    // Check if it's accounting (has structure) or just chat
    if (result.structure) {
      // Generate Excel for accounting queries
      excelResult = await excelGenerator.generateWithCompleteFreedom(
        result.structure, 
        userId
      );
      
      // Update usage if successful
      if (subscription && excelResult?.success) {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { 
            automationsUsed: subscription.automationsUsed + 1
          }
        });
      }
      
      // Store chat session for accounting
      await prisma.chatSession.create({
        data: {
          userId,
          messages: JSON.stringify([
            { role: 'user', content: message },
            { role: 'assistant', content: result.chatResponse }
          ]) as any,
          tokensUsed: result.tokensUsed
        }
      });
      
      return res.json({
        success: true,
        type: 'excel',
        message: result.chatResponse,
        excelData: {
          filename: excelResult?.filename || 'unknown.xlsx',
          filepath: excelResult?.filepath || '',
          summary: excelResult?.structure || 'Excel workbook generated',
          worksheets: excelResult?.worksheets || []
        }
      });
    } else {
      // Just chat response, no Excel
      await prisma.chatSession.create({
        data: {
          userId,
          messages: JSON.stringify([
            { role: 'user', content: message },
            { role: 'assistant', content: result.chatResponse }
          ]) as any,
          tokensUsed: result.tokensUsed
        }
      });
      
      return res.json({
        success: true,
        type: 'chat',
        message: result.chatResponse
      });
    }
    
  } catch (error: any) {
    logger.error('Chat processing error:', error);
    
    // Detailed error messages for debugging
    let errorMessage = 'Processing error occurred';
    let statusCode = 500;
    
    if (error.message?.includes('quota')) {
      errorMessage = 'OpenAI quota exceeded. Please try again later.';
      statusCode = 429;
    } else if (error.message?.includes('API key')) {
      errorMessage = 'API configuration error.';
      statusCode = 503;
    } else if (error.message?.includes('timeout')) {
      errorMessage = 'Request timed out. Please try again.';
      statusCode = 504;
    }
    
    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      type: 'error'
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

// Test endpoint for Nubia verification
export const testNubia = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const testMessage = "record june 1 started business with cash 10000";
    
    // Call the main handler with test data
    req.body = { message: testMessage };
    
    // Process through main handler
    await handleUniversalChat(req, res);
    
  } catch (error) {
    console.error('Test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Test failed',
      details: error.message
    });
  }
};

// Universal chat endpoint with file uploads
export const handleUniversalChatWithFiles = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { message } = req.body;
    const files = req.files as Express.Multer.File[];
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!message && (!files || files.length === 0)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Message or files are required' 
      });
    }

    console.log('💬 Processing message with files:', message?.substring(0, 100));
    console.log('📎 Files uploaded:', files?.length || 0);

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

    let enhancedMessage = message || '';

    // Process uploaded files if any
    if (files && files.length > 0) {
      try {
        console.log('🔄 Processing uploaded files...');
        const processedFiles = await fileProcessingService.processUploadedFiles(files);
        
        // Generate enhanced prompt with file content
        enhancedMessage = fileProcessingService.generateEnhancedPrompt(message || '', processedFiles);
        
        console.log('✅ Files processed successfully, enhanced message length:', enhancedMessage.length);
      } catch (error) {
        console.error('❌ File processing error:', error);
        return res.status(400).json({
          success: false,
          error: `File processing failed: ${error.message}`,
          type: 'file_error'
        });
      }
    }

    // Call financial intelligence with enhanced message (includes file content)
    const result = await financialIntelligence.processFinancialCommand(enhancedMessage);
    
    // Declare variables
    let excelResult: ExcelResult | null = null;
    
    // Check if it's accounting (has structure) or just chat
    if (result.structure) {
      // Generate Excel for accounting queries
      excelResult = await excelGenerator.generateWithCompleteFreedom(
        result.structure, 
        userId
      );
      
      // Update usage if successful
      if (subscription && excelResult?.success) {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { 
            automationsUsed: subscription.automationsUsed + 1
          }
        });
      }
      
      // Store chat session for accounting
      await prisma.chatSession.create({
        data: {
          userId,
          messages: JSON.stringify([
            { role: 'user', content: message || '[Files uploaded]' },
            { role: 'assistant', content: result.chatResponse }
          ]) as any,
          tokensUsed: result.tokensUsed
        }
      });
      
      return res.json({
        success: true,
        type: 'excel',
        message: result.chatResponse,
        filesProcessed: files?.length || 0,
        excelData: {
          filename: excelResult?.filename || 'unknown.xlsx',
          filepath: excelResult?.filepath || '',
          summary: excelResult?.structure || 'Excel workbook generated',
          worksheets: excelResult?.worksheets || []
        }
      });
    } else {
      // Just chat response, no Excel
      await prisma.chatSession.create({
        data: {
          userId,
          messages: JSON.stringify([
            { role: 'user', content: message || '[Files uploaded]' },
            { role: 'assistant', content: result.chatResponse }
          ]) as any,
          tokensUsed: result.tokensUsed
        }
      });
      
      return res.json({
        success: true,
        type: 'chat',
        message: result.chatResponse,
        filesProcessed: files?.length || 0
      });
    }
    
  } catch (error: any) {
    logger.error('Chat with files processing error:', error);
    
    // Detailed error messages for debugging
    let errorMessage = 'Processing error occurred';
    let statusCode = 500;
    
    if (error.message?.includes('quota')) {
      errorMessage = 'OpenAI quota exceeded. Please try again later.';
      statusCode = 429;
    } else if (error.message?.includes('API key')) {
      errorMessage = 'API configuration error.';
      statusCode = 503;
    } else if (error.message?.includes('timeout')) {
      errorMessage = 'Request timed out. Please try again.';
      statusCode = 504;
    } else if (error.message?.includes('File size') || error.message?.includes('File type')) {
      errorMessage = error.message;
      statusCode = 400;
    }
    
    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      type: 'error'
    });
  }
};

export default {
  handleUniversalChat,
  handleUniversalChatWithFiles,
  getChatHistory,
  deleteChatSession,
  testNubia
};