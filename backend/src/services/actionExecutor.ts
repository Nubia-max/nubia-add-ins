/**
 * Action Executor Service
 * Handles Excel AI actions with credit checking and deduction
 * Integrates with creditSystem.ts and directExcelAI.ts
 */

import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth';
import { generateExcelCode } from './directExcelAI';
import SimpleCreditSystem, { TOKENS_PER_CREDIT } from './creditSystem';

/**
 * Execute an Excel AI action with credit management
 * Handles the complete flow: credit check -> AI generation -> credit deduction -> response
 */
export async function executeAction(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    // Step 1: Extract request data
    const { message, context, conversationHistory, userPatterns, source } = req.body;
    const userId = req.user?.uid;

    // Validate required fields
    if (!message) {
      res.status(400).json({
        status: 'error',
        message: 'Message is required'
      });
      return;
    }

    if (!userId) {
      res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
      return;
    }

    logger.info(`Processing action for user ${userId}: ${message.substring(0, 100)}...`);

    // Step 2: Generate Excel code using AI (get actual token usage)
    logger.debug('Calling directExcelAI for code generation...');
    const aiResponse = await generateExcelCode({
      command: message,
      context: context || {}
    });

    // Step 3: Calculate credits used based on actual token consumption
    const tokensUsed = aiResponse.tokensUsed.total;
    const creditsUsed = tokensUsed / TOKENS_PER_CREDIT;

    logger.debug(`AI response completed. Tokens: ${tokensUsed}, Credits: ${creditsUsed.toFixed(3)}`);

    // Step 4: Check if user has enough credits for actual usage, then deduct
    const creditResult = await SimpleCreditSystem.deductCredits(
      userId,
      tokensUsed,
      message,
      true // useRealTokens - use actual token count from AI
    );

    // Step 6: Return successful response
    const response = {
      status: 'success',
      thinking: aiResponse.thinking,
      conversation: aiResponse.conversation,
      code: aiResponse.code,
      needsApproval: aiResponse.needsApproval,
      tokensUsed: aiResponse.tokensUsed,
      creditsUsed: creditResult.creditsDeducted,
      remainingCredits: creditResult.remainingCredits
    };

    logger.info(`Action completed successfully for user ${userId}. Credits remaining: ${creditResult.remainingCredits}`);

    res.status(200).json(response);

  } catch (error) {
    // Handle any errors that occur during the process
    logger.error('Action execution error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    res.status(500).json({
      status: 'error',
      message: `Action failed: ${errorMessage}`
    });
  }
}

/**
 * Helper function to validate Excel context
 * Can be extended for more sophisticated validation
 */
function validateExcelContext(context: any): boolean {
  // Basic validation - can be enhanced as needed
  return typeof context === 'object';
}

/**
 * Helper function to sanitize user input
 * Removes potentially harmful content while preserving Excel commands
 */
function sanitizeUserInput(message: string): string {
  if (typeof message !== 'string') {
    throw new Error('Message must be a string');
  }

  // Basic sanitization - remove excessive whitespace and ensure reasonable length
  const sanitized = message.trim();

  if (sanitized.length === 0) {
    throw new Error('Message cannot be empty');
  }

  if (sanitized.length > 1000) {
    throw new Error('Message too long (max 1000 characters)');
  }

  return sanitized;
}

/**
 * Helper function to check if request is from a valid source
 * Can be used for additional security validation
 */
function isValidSource(source?: string): boolean {
  const validSources = [
    'intelligent-add-in',
    'excel-taskpane',
    'web-interface',
    undefined // Allow requests without source
  ];

  return validSources.includes(source);
}

// Export additional utilities for potential future use
export {
  validateExcelContext,
  sanitizeUserInput,
  isValidSource
};