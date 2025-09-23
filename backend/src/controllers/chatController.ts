import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { generateDirectExcelCode } from '../services/directExcelAI';
import { contextCache } from '../services/contextCache';

/**
 * SSE endpoint for streaming complex operations
 */
export const handleChatStream = async (req: Request, res: Response) => {
  const { message, context, source } = req.body;

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    sendEvent('progress', { status: 'Starting AI analysis...', progress: 10 });

    const sessionId = req.headers['x-session-id'] as string || 'default';
    const enhancedContext = contextCache.enhanceContext(context || {});
    contextCache.cacheContext(sessionId, enhancedContext);

    sendEvent('progress', { status: 'Context enhanced, generating code...', progress: 30 });

    const directResponse = await generateDirectExcelCode({
      userCommand: message,
      excelContext: enhancedContext
    });

    sendEvent('progress', { status: 'Code generated, finalizing...', progress: 90 });

    sendEvent('complete', {
      success: true,
      type: 'direct-excel',
      understanding: directResponse.understanding,
      code: directResponse.code,
      message: directResponse.message,
      confidence: directResponse.confidence,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    sendEvent('error', {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    res.end();
  }
};

/**
 * Main chat controller - now redirects all operations to streaming
 */
export const handleChat = async (req: Request, res: Response) => {
  const { message, context, source } = req.body;

  if (!message) {
    return res.status(400).json({
      success: false,
      error: 'Message is required'
    });
  }

  try {
    logger.info(`Processing chat from ${source || 'unknown'}: ${message.substring(0, 100)}...`);

    const sessionId = req.headers['x-session-id'] as string || 'default';
    const enhancedContext = contextCache.enhanceContext(context || {});
    contextCache.cacheContext(sessionId, enhancedContext);

    const directResponse = await generateDirectExcelCode({
      userCommand: message,
      excelContext: enhancedContext
    });

    logger.info('🧠 Direct Excel AI Response:', {
      understanding: directResponse.understanding?.substring(0, 100),
      codeLength: directResponse.code?.length,
      confidence: directResponse.confidence
    });

    return res.json({
      success: true,
      type: 'direct-excel',
      understanding: directResponse.understanding,
      code: directResponse.code,
      message: directResponse.message,
      confidence: directResponse.confidence,
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