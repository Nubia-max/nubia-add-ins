import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { processExcelRequest } from '../services/excelGPT';
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

    logger.info('Processing with Excel GPT - Full Excel API access', {
      contextType: enhancedContext.selectionType,
      semanticTags: enhancedContext.semanticTags,
      suggestions: enhancedContext.suggestedOperations
    });

    const excelResponse = await processExcelRequest(message, enhancedContext);

    return res.json({
      success: true,
      type: 'excel-gpt',
      understanding: excelResponse.understanding,
      actions: excelResponse.actions,
      message: excelResponse.message,
      confidence: excelResponse.confidence,
      timestamp: new Date().toISOString()
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