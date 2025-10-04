/**
 * Excel Orchestrator Service
 * Core Responsibilities:
 * - Handle /api/chat/stream requests
 * - Build Excel context (summaries of workbook, worksheets, active range)
 * - Stream AI response in real-time
 */

import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { deepSeekStream } from '../utils/deepSeekStream';
import { buildExcelContext } from '../utils/contextBuilder';
import SimpleCreditSystem from './creditSystem';

/**
 * Stream Excel AI response with real-time updates
 * Handles the complete streaming flow with Excel context awareness
 */
export async function streamExcelResponse(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.uid || 'anonymous';
  const { message, context, conversationHistory, source } = req.body;

  console.log(`[Excel Stream] User: ${userId}, Source: ${source || 'unknown'}`);

  try {
    // Validate required fields
    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    logger.info(`Processing Excel stream request for user ${userId}: ${message.substring(0, 100)}...`);

    // Build rich Excel context
    const excelContext = await buildExcelContext(context);
    logger.debug('Excel context built successfully:', {
      workbookName: excelContext.name || excelContext.workbookName,
      worksheetCount: excelContext.sheets?.length || 0,
      activeSheet: excelContext.activeSheet,
      hasSelectedRange: !!excelContext.selectedRange
    });

    // Initialize SSE (Server-Sent Events)
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Handle client disconnect
    req.on('close', () => {
      logger.debug(`Client disconnected for user ${userId}`);
    });

    // Send initial progress event
    res.write(`event: progress\ndata: {"status": "Analyzing Excel context...", "progress": 10}\n\n`);

    // Track actual tokens for credit deduction
    let actualTokensUsed = 0;

    // Stream AI output with Excel context awareness
    await deepSeekStream({
      userId,
      message,
      excelContext,
      history: conversationHistory || [],
      onToken: (token: string) => {
        // Stream each token as it arrives
        res.write(`data: ${token}\n\n`);
      },
      onProgress: (status: string, progress: number) => {
        // Send progress updates
        res.write(`event: progress\ndata: {"status": "${status}", "progress": ${progress}}\n\n`);
      },
      onComplete: (summary: any) => {
        // Capture actual tokens used
        actualTokensUsed = summary.tokensUsed || 1000;
        // Send completion event with summary
        res.write(`event: complete\ndata: ${JSON.stringify(summary)}\n\n`);
      }
    });

    // Close the stream
    res.write('event: done\ndata: [DONE]\n\n');
    res.end();

    // Deduct credits after successful streaming based on actual tokens used
    try {
      await SimpleCreditSystem.deductCredits(userId, actualTokensUsed, 'excel-stream', true);
      logger.info(`Excel streaming completed successfully for user ${userId}, tokens used: ${actualTokensUsed}`);
    } catch (creditError) {
      logger.warn('Credit deduction failed:', creditError);
      // Don't fail the request if credit deduction fails
    }

  } catch (error: any) {
    logger.error('Excel streaming error:', error);

    // Send error event if connection is still open
    try {
      res.write(`event: error\ndata: ${JSON.stringify({ message: error.message })}\n\n`);
      res.end();
    } catch (writeError) {
      logger.warn('Failed to write error to closed connection:', writeError);
    }
  }
}

/**
 * Validate streaming request parameters
 */
function validateStreamRequest(body: any): { isValid: boolean; error?: string } {
  if (!body.message || typeof body.message !== 'string') {
    return { isValid: false, error: 'Message is required and must be a string' };
  }

  if (body.message.length > 2000) {
    return { isValid: false, error: 'Message too long (max 2000 characters)' };
  }

  return { isValid: true };
}

/**
 * Helper function to safely write to SSE stream
 */
function writeSSEData(res: Response, event: string, data: any): void {
  try {
    if (event) {
      res.write(`event: ${event}\n`);
    }
    res.write(`data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`);
  } catch (error) {
    logger.warn('Error writing SSE data:', error);
  }
}

// Export utilities for potential future use
export {
  validateStreamRequest,
  writeSSEData
};