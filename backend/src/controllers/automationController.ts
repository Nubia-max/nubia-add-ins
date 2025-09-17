import { Request, Response } from 'express';
import { firebaseService } from '../services/firebase';
import { UsageTracker } from '../utils/usageTracking';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth';

// Import unified services
const FinancialIntelligenceService = require('../services/financialIntelligence');
const DynamicExcelGenerator = require('../services/dynamicExcelGenerator');

// Initialize services
const financialIntelligence = new FinancialIntelligenceService();
const excelGenerator = new DynamicExcelGenerator();

// Prisma replaced with Firebase Firestore for all database operations

// Process Excel automation request from desktop client
export const processAutomation = async (req: AuthenticatedRequest, res: Response) => {
  const startTime = Date.now();
  const userId = req.user?.id;
  
  try {
    const { command, context, options } = req.body;

    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }

    logger.info('Processing automation request:', {
      userId,
      command: command.substring(0, 100) // Log first 100 chars
    });

    // TODO: Integrate with your existing LLM service
    // This is where you'd call your Python automation service or LLM
    const automationResult = await executeAutomation(command, context, options);

    // Record successful usage
    await UsageTracker.recordUsage({
      userId: userId!,
      automationType: 'excel_automation',
      command,
      success: true,
      executionTimeMs: Date.now() - startTime,
      metadata: {
        context,
        options,
        resultType: automationResult.type
      }
    });

    res.json({
      success: true,
      result: automationResult,
      executionTime: Date.now() - startTime,
      subscription: req.subscription
    });

  } catch (error) {
    logger.error('Automation processing error:', error);

    // Record failed usage
    await UsageTracker.recordUsage({
      userId: userId!,
      automationType: 'excel_automation',
      command: req.body.command,
      success: false,
      executionTimeMs: Date.now() - startTime,
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      error: 'Automation processing failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get user's automation history
export const getAutomationHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { limit = 50, offset = 0 } = req.query;

    // Get usage records from Firebase - simplified for now
    // TODO: Implement pagination in Firebase service if needed
    const allRecords = await firebaseService.getUserUsageRecords(userId, 'excel_automation');
    const history = allRecords.slice(Number(offset), Number(offset) + Number(limit));
    const totalCount = allRecords.length;

    res.json({
      history,
      pagination: {
        total: totalCount,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: totalCount > Number(offset) + Number(limit)
      }
    });

  } catch (error) {
    logger.error('Get automation history error:', error);
    res.status(500).json({ error: 'Failed to retrieve automation history' });
  }
};

// Get usage analytics for the user
export const getUsageAnalytics = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { days = 30 } = req.query;

    // Get subscription from Firebase
    const subscription = await firebaseService.getSubscriptionByUserId(userId!);
    const { analytics } = await UsageTracker.getUserUsage(userId!, Number(days));

    res.json({
      analytics,
      subscription,
      period: {
        days: Number(days),
        startDate: new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000),
        endDate: new Date()
      }
    });

  } catch (error) {
    logger.error('Get usage analytics error:', error);
    res.status(500).json({ error: 'Failed to retrieve usage analytics' });
  }
};

// Save automation template
export const saveAutomationTemplate = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { name, description, commands, category, isPublic = false } = req.body;

    if (!name || !commands || !Array.isArray(commands)) {
      return res.status(400).json({ error: 'Name and commands array are required' });
    }

    const template = await firebaseService.createAutomationTemplate({
      userId,
      name,
      description,
      commands: JSON.stringify(commands),
      category,
      isPublic,
      usageCount: 0
    });

    // Record template creation
    await UsageTracker.recordUsage({
      userId: userId!,
      automationType: 'template_creation',
      command: name,
      success: true,
      metadata: { category, isPublic }
    });

    res.json(template);

  } catch (error) {
    logger.error('Save template error:', error);
    res.status(500).json({ error: 'Failed to save automation template' });
  }
};

// Get automation templates (user's own + public)
export const getAutomationTemplates = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { category, isPublic } = req.query;

    const templates = await firebaseService.getAutomationTemplates({
      userId: userId!,
      category: category as string,
      isPublic: isPublic ? isPublic === 'true' : undefined
    });

    res.json(templates);

  } catch (error) {
    logger.error('Get templates error:', error);
    res.status(500).json({ error: 'Failed to retrieve automation templates' });
  }
};

// Use automation template (increment usage counter)
export const useAutomationTemplate = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { templateId } = req.params;

    const template = await firebaseService.getAutomationTemplateById(templateId);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Check if user has access to this template
    if (!template.isPublic && template.userId !== req.user?.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Increment usage counter
    await firebaseService.updateAutomationTemplate(templateId, {
      usageCount: template.usageCount + 1
    });

    res.json(template);

  } catch (error) {
    logger.error('Use template error:', error);
    res.status(500).json({ error: 'Failed to use automation template' });
  }
};

// LLM-powered automation execution using unified financial intelligence
async function executeAutomation(command: string, context: any, options: any) {
  try {
    // Use unified financial intelligence service
    const result = await financialIntelligence.processFinancialCommand(command);

    let excelResult = null;
    if (result.structure) {
      // Generate Excel using unified generator
      excelResult = await excelGenerator.generateWithCompleteFreedom(result.structure, 'automation-user');
    }

    return {
      type: 'excel_creation',
      structure: result.structure,
      explanation: result.chatResponse,
      success: true,
      excelResult: excelResult,
      metadata: {
        tokensUsed: result.tokensUsed || 0,
        processingTime: '0.8s',
        worksheetCount: result.structure?.workbook?.length || 0
      }
    };
  } catch (error) {
    logger.error('Automation generation failed:', error);

    // Fallback to basic response
    return {
      type: 'chat_response',
      structure: null,
      explanation: `I apologize, but I encountered an error processing your automation request: ${command}. Please try again or contact support.`,
      success: false,
      metadata: {
        error: error.message,
        processingTime: '0.1s',
        fallback: true
      }
    };
  }
}