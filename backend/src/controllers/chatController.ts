import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { llmService } from '../services/llmService';
import { UsageTracker } from '../utils/usageTracking';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  userId?: string;
  user?: {
    id: string;
    email: string;
  };
  subscription?: any;
}

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  userId?: string;
  metadata?: {
    cost?: number;
    tokensUsed?: number;
    automationType?: string;
  };
}

export const getChatHistory = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const requesterId = req.userId;

    // Ensure user can only access their own chat history
    if (userId !== requesterId) {
      return res.status(403).json({ 
        error: 'Access denied' 
      });
    }

    // Get all chats for the user
    const chats = await prisma.chat.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        messages: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // Transform the data
    const chatHistory = chats.map(chat => ({
      id: chat.id,
      messages: Array.isArray(chat.messages) ? chat.messages : [],
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt
    }));

    res.json({
      chats: chatHistory,
      total: chats.length
    });
  } catch (error) {
    logger.error('Get chat history error:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
};

export const sendMessage = async (req: AuthRequest, res: Response) => {
  const startTime = Date.now();
  let success = false;
  let errorMessage: string | undefined;
  let cost = 0;

  try {
    const { content, context } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ 
        error: 'User not authenticated' 
      });
    }

    // Check usage limits before processing
    const usageCheck = await UsageTracker.checkUsageLimit(userId, 'chat_query');
    if (!usageCheck.allowed) {
      return res.status(429).json({
        error: 'Usage limit exceeded',
        message: usageCheck.message,
        subscription: usageCheck.subscription,
        usage: usageCheck.usage,
        limit: usageCheck.limit,
        upgradeRequired: true
      });
    }

    // Create user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      sender: 'user',
      timestamp: new Date(),
      userId
    };

    // Process message with LLM service (backend owns the API keys)
    let aiResponse: string;
    try {
      const llmResult = await llmService.processExcelCommand(content, context);
      aiResponse = llmResult.response;
      cost = llmResult.cost;
      success = true;
    } catch (error) {
      logger.error('LLM processing failed:', error);
      aiResponse = "I apologize, but I'm having trouble processing your request right now. Please try again in a moment.";
      errorMessage = error instanceof Error ? error.message : 'LLM processing failed';
    }

    // Create AI response message
    const aiMessage: Message = {
      id: (Date.now() + 1).toString(),
      content: aiResponse,
      sender: 'assistant',
      timestamp: new Date(),
      userId,
      metadata: {
        cost,
        automationType: 'chat_query'
      }
    };

    // Find or create a chat for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let chat = await prisma.chat.findFirst({
      where: {
        userId,
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      }
    });

    let messages: Message[] = [];
    
    if (chat) {
      // Add to existing chat
      messages = Array.isArray(chat.messages) ? chat.messages as unknown as Message[] : [];
      messages.push(userMessage, aiMessage);
    } else {
      // Create new chat
      messages = [userMessage, aiMessage];
    }

    // Save to database
    if (chat) {
      await prisma.chat.update({
        where: { id: chat.id },
        data: { 
          messages: messages as any,
          updatedAt: new Date()
        }
      });
    } else {
      chat = await prisma.chat.create({
        data: {
          userId,
          messages: messages as any
        }
      });
    }

    // Record usage for billing and analytics
    await UsageTracker.recordUsage({
      userId,
      automationType: 'chat_query',
      command: content,
      success,
      executionTimeMs: Date.now() - startTime,
      errorMessage: errorMessage || undefined,
      metadata: {
        cost,
        chatId: chat.id,
        messageLength: content.length
      }
    });

    logger.info(`Chat message processed for user: ${userId}, cost: $${cost.toFixed(4)}`);

    res.json({
      message: 'Message sent successfully',
      chatId: chat.id,
      userMessage,
      aiMessage,
      usage: {
        current: usageCheck.usage + (success ? 1 : 0),
        limit: usageCheck.limit,
        subscription: usageCheck.subscription
      }
    });
  } catch (error) {
    logger.error('Send message error:', error);
    
    // Record failed usage
    if (req.user?.id) {
      await UsageTracker.recordUsage({
        userId: req.user.id,
        automationType: 'chat_query',
        command: req.body?.content || '',
        success: false,
        executionTimeMs: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
};

