import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { generateDirectExcelCode } from '../services/directExcelAI';
import { contextCache } from '../services/contextCache';

/**
 * Simplified chat controller using Excel GPT for all operations
 */
export const handleChat = async (req: Request, res: Response) => {
  try {
    const { message, context, source } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    logger.info(`Processing chat from ${source || 'unknown'}: ${message.substring(0, 100)}...`);

    // Enhance context with smart analysis
    const sessionId = req.headers['x-session-id'] as string || 'default';
    const enhancedContext = contextCache.enhanceContext(context || {});

    // Cache the enhanced context
    contextCache.cacheContext(sessionId, enhancedContext);

    logger.info('🚀 Processing with Direct Excel AI - UNLIMITED POWER MODE', {
      contextType: enhancedContext.selectionType,
      semanticTags: enhancedContext.semanticTags,
      suggestions: enhancedContext.suggestedOperations
    });

    const directResponse = await generateDirectExcelCode({
      userCommand: message,
      excelContext: enhancedContext
    });

    logger.info('🧠 Direct Excel AI Response:', {
      understanding: directResponse.understanding?.substring(0, 100),
      codeLength: directResponse.code?.length,
      confidence: directResponse.confidence
    });

    // Add processing time info for debugging
    const processingTime = Date.now() - Date.now();

    return res.json({
      success: true,
      type: 'direct-excel',
      understanding: directResponse.understanding,
      code: directResponse.code,
      message: directResponse.message,
      confidence: directResponse.confidence,
      timestamp: new Date().toISOString(),
      processingTimeMs: processingTime
    });

  } catch (error) {
    logger.error('Chat controller error:', error);
    return res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
};

/**
 * Test endpoint
 */
export const testEndpoint = async (req: Request, res: Response) => {
  try {
    return res.json({
      success: true,
      message: 'Nubia Excel Add-in backend is running!',
      timestamp: new Date().toISOString(),
      version: 'Excel Add-in v2.0 with Excel GPT'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
};