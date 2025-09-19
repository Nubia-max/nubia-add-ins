import { Request, Response } from 'express';
import { firebaseService } from '../services/firebase';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth';

// Simple chat controller - complex file processing now handled by imageUploadController
// This controller only handles basic text-only chat requests

// Initialize services with clean dependencies
const FinancialIntelligenceService = require('../services/financialIntelligence');
const DynamicExcelGenerator = require('../services/dynamicExcelGenerator');
const financialIntelligence = new FinancialIntelligenceService();
const excelGenerator = new DynamicExcelGenerator(financialIntelligence);

// Helper function to generate unique message IDs
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Simple text-only chat endpoint (no files)
export const handleChat = async (req: AuthenticatedRequest, res: Response) => {
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

    logger.info(`Processing text-only chat for user: ${userId}`);

    // Check usage limits with Firebase
    const subscription = await firebaseService.getSubscriptionByUserId(userId);
    if (subscription && subscription.automationsLimit !== -1) {
      if (subscription.automationsUsed >= subscription.automationsLimit) {
        return res.status(429).json({
          error: 'Usage limit exceeded',
          message: `You've reached your monthly limit of ${subscription.automationsLimit} automations. Please upgrade your plan.`
        });
      }
    }

    // Process message with financial intelligence (no files)
    const result = await financialIntelligence.processWithSmartContext(message, userId);

    // Generate message ID
    const messageId = generateMessageId();

    // Simple response - no Excel generation for text-only requests
    return res.json({
      success: true,
      type: 'chat',
      message: result.chatResponse,
      conversationId: messageId,
      smartContext: {
        contextUsed: result.contextUsed,
        enhanced: result.enhanced,
        tokensUsed: result.tokensUsed
      }
    });

  } catch (error) {
    logger.error('Chat controller error:', error);
    return res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
};

// Clear conversation endpoint
export const clearConversation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Clear conversation history in Firebase
    await firebaseService.clearConversationHistory(userId);

    logger.info(`Conversation cleared for user: ${userId}`);

    return res.json({
      success: true,
      message: 'Conversation history cleared'
    });

  } catch (error) {
    logger.error('Clear conversation error:', error);
    return res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
};

// Get document context endpoint (simplified)
export const getDocumentContext = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get conversation history from Firebase
    const history = await firebaseService.getConversationHistory(userId);

    return res.json({
      success: true,
      data: {
        messageCount: history?.messages?.length || 0,
        documentCount: history?.uploadedDocuments?.length || 0,
        hasExcelStructure: !!history?.lastExcelStructure
      }
    });

  } catch (error) {
    logger.error('Get document context error:', error);
    return res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
};

// Test endpoint
export const testNubia = async (req: Request, res: Response) => {
  try {
    return res.json({
      success: true,
      message: 'NUBIA backend is running! Use /api/chat/with-files for file uploads.',
      timestamp: new Date().toISOString(),
      version: '2.0 - Direct Pipeline'
    });
  } catch (error) {
    logger.error('Test endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
};