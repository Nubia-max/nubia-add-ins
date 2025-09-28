import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { generateDirectExcelCode } from '../services/directExcelAI';
import { contextCache } from '../services/contextCache';
import SimpleCreditSystem from '../services/creditSystem';
import { AuthenticatedRequest } from '../middleware/auth';
import { ApiResponseHelper } from '../utils/apiResponse';

/**
 * SSE endpoint for streaming complex operations
 */
export const handleChatStream = async (req: AuthenticatedRequest, res: Response) => {
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

    // Deduct credits after successful operation based on actual API token usage
    const tokensUsed = directResponse.tokensUsed.total;
    try {
      const creditResult = await SimpleCreditSystem.deductCredits(
        req.user?.uid,
        tokensUsed,
        message,
        true
      );

      sendEvent('complete', {
        success: true,
        type: 'direct-excel',
        understanding: directResponse.understanding,
        code: directResponse.code,
        message: directResponse.message,
        confidence: directResponse.confidence,
        tokensUsed: tokensUsed,
        creditsUsed: creditResult.creditsDeducted,
        remainingCredits: creditResult.remainingCredits,
        timestamp: new Date().toISOString()
      });

    } catch (creditError) {
      logger.error('Credit deduction failed:', creditError);
      sendEvent('error', {
        success: false,
        error: 'Credit deduction failed: ' + (creditError as Error).message
      });
    }

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
export const handleChat = async (req: AuthenticatedRequest, res: Response) => {
  const { userCommand, message, context, source } = req.body;
  const command = userCommand || message; // Support both field names for compatibility

  if (!command) {
    return ApiResponseHelper.validationError(res, [], 'User command is required');
  }

  try {
    logger.info(`Processing chat from ${source || 'unknown'}: ${command.substring(0, 100)}...`);

    const sessionId = req.headers['x-session-id'] as string || 'default';
    const enhancedContext = contextCache.enhanceContext(context || {});
    contextCache.cacheContext(sessionId, enhancedContext);

    const directResponse = await generateDirectExcelCode({
      userCommand: command,
      excelContext: enhancedContext
    });

    logger.info('🧠 Direct Excel AI Response:', {
      understanding: directResponse.understanding?.substring(0, 100),
      codeLength: directResponse.code?.length,
      confidence: directResponse.confidence
    });

    // Deduct credits after successful operation based on actual API token usage
    const tokensUsed = directResponse.tokensUsed.total;
    const creditResult = await SimpleCreditSystem.deductCredits(
      req.user?.uid,
      tokensUsed,
      command,
      true
    );

    return ApiResponseHelper.success(res, {
      type: 'direct-excel',
      understanding: directResponse.understanding,
      code: directResponse.code,
      message: directResponse.message,
      confidence: directResponse.confidence,
      tokensUsed: tokensUsed,
      creditsUsed: creditResult.creditsDeducted,
      remainingCredits: creditResult.remainingCredits
    }, 'Excel operation completed successfully');

  } catch (error) {
    logger.error('Chat controller error:', error);
    return ApiResponseHelper.serverError(res, (error as Error).message);
  }
};

/**
 * Test endpoint
 */
export const testEndpoint = async (_req: Request, res: Response) => {
  try {
    return ApiResponseHelper.success(res, {
      version: 'Excel Add-in v2.0 with Excel GPT'
    }, 'Moose Excel Add-in backend is running!');
  } catch (error) {
    return ApiResponseHelper.serverError(res, (error as Error).message);
  }
};