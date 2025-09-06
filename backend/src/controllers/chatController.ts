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

    // Get all chats for the user with messages
    const chats = await (prisma.chat as any).findMany({
      where: { 
        userId,
        isActive: true 
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        chatMessages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            metadata: true,
            createdAt: true
          }
        }
      },
      take: 20 // Limit to recent 20 chats
    });

    // Transform the data
    const chatHistory = chats.map((chat: any) => ({
      id: chat.id,
      title: chat.title || 'New Chat',
      messages: chat.chatMessages,
      messageCount: chat.chatMessages.length,
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

export const getChatById = async (req: AuthRequest, res: Response) => {
  try {
    const { chatId } = req.params;
    const userId = req.userId;

    const chat = await (prisma.chat as any).findFirst({
      where: { 
        id: chatId,
        userId 
      },
      include: {
        chatMessages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!chat) {
      return res.status(404).json({ 
        error: 'Chat not found' 
      });
    }

    res.json(chat);
  } catch (error) {
    logger.error('Get chat error:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
};

export const createNewChat = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ 
        error: 'User not authenticated' 
      });
    }

    // Deactivate old chats if needed
    await (prisma.chat as any).updateMany({
      where: { 
        userId,
        isActive: true,
        chatMessages: {
          none: {}
        }
      },
      data: { isActive: false }
    });

    const chat = await (prisma.chat as any).create({
      data: {
        userId,
        title: 'New Chat',
        isActive: true
      }
    });

    res.json(chat);
  } catch (error) {
    logger.error('Create chat error:', error);
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
    const { content, chatId } = req.body;
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

    // Process user message (no need to create object since we save directly to DB)

    // Get or create chat session
    let chat = chatId ? 
      await (prisma.chat as any).findFirst({
        where: { id: chatId, userId },
        include: {
          chatMessages: {
            orderBy: { createdAt: 'desc' },
            take: 10 // Get last 10 messages for context
          }
        }
      }) : null;

    if (!chat) {
      // Create new chat session
      chat = await (prisma.chat as any).create({
        data: {
          userId,
          title: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
          isActive: true
        },
        include: {
          chatMessages: true
        }
      });
    }

    // Build conversation history for context
    const conversationHistory = (chat.chatMessages || [])
      .reverse()
      .map((msg: any) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }));

    // Process message with LLM service including conversation history
    let aiResponse: string;
    let excelGenerated = false;
    try {
      const llmResult = await llmService.processExcelCommand(content, conversationHistory);
      let response = llmResult.response;
      cost = llmResult.cost;
      
      // Check if GPT wants to create Excel
      if (response.includes('[EXCEL_STRUCTURE]')) {
        logger.info('GPT requested Excel creation');
        
        try {
          // Extract JSON structure
          const jsonStart = response.indexOf('{');
          const jsonEnd = response.lastIndexOf('}');
          const jsonStr = response.substring(jsonStart, jsonEnd + 1);
          JSON.parse(jsonStr); // Validate JSON structure
          
          // TODO: Create Excel file using existing generator
          // For now, just indicate that Excel would be created
          aiResponse = `I'll create that Excel file for you right now!\n\n${response.split('[EXCEL_STRUCTURE]')[0].trim()}`;
          excelGenerated = true;
          
        } catch (parseError) {
          logger.error('Excel parsing error:', parseError);
          aiResponse = 'I wanted to create an Excel file for you, but had trouble with the format. Could you try rephrasing your request?';
        }
      } else {
        aiResponse = response;
      }
      
      success = true;
    } catch (error) {
      logger.error('LLM processing failed:', error);
      aiResponse = "I apologize, but I'm having trouble processing your request right now. Please try again in a moment.";
      errorMessage = error instanceof Error ? error.message : 'LLM processing failed';
    }

    // Save user message to database
    const userChatMessage = await (prisma as any).chatMessage.create({
      data: {
        chatId: chat.id,
        role: 'user',
        content,
        metadata: {
          timestamp: new Date()
        }
      }
    });

    // Save AI response to database
    const aiChatMessage = await (prisma as any).chatMessage.create({
      data: {
        chatId: chat.id,
        role: 'assistant',
        content: aiResponse,
        metadata: {
          cost,
          automationType: 'chat_query',
          excelGenerated,
          timestamp: new Date()
        }
      }
    });

    // Update chat's updated timestamp and title if it's the first message
    const messageCount = await (prisma as any).chatMessage.count({
      where: { chatId: chat.id }
    });

    if (messageCount <= 2) {
      // Update title based on first user message
      await (prisma.chat as any).update({
        where: { id: chat.id },
        data: {
          title: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
          updatedAt: new Date()
        }
      });
    } else {
      await (prisma.chat as any).update({
        where: { id: chat.id },
        data: { updatedAt: new Date() }
      });
    }

    // Create backward-compatible message objects
    const userMessage: Message = {
      id: userChatMessage.id,
      content,
      sender: 'user',
      timestamp: new Date(),
      userId
    };

    const aiMessage: Message = {
      id: aiChatMessage.id,
      content: aiResponse,
      sender: 'assistant',
      timestamp: new Date(),
      userId,
      metadata: {
        cost,
        automationType: 'chat_query'
      }
    };

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

