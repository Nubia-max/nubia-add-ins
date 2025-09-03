import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  userId?: string;
}

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  userId?: string;
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
  try {
    const { content } = req.body;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ 
        error: 'User not authenticated' 
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
      messages = Array.isArray(chat.messages) ? chat.messages as Message[] : [];
      messages.push(userMessage);
    } else {
      // Create new chat
      messages = [userMessage];
    }

    // Generate AI response (simplified for now)
    const aiMessage: Message = {
      id: (Date.now() + 1).toString(),
      content: generateAIResponse(content),
      sender: 'assistant',
      timestamp: new Date(),
      userId
    };
    
    messages.push(aiMessage);

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

    logger.info(`Message sent by user: ${userId}`);

    res.json({
      message: 'Message sent successfully',
      chatId: chat.id,
      userMessage,
      aiMessage
    });
  } catch (error) {
    logger.error('Send message error:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
};

// Simplified AI response generator
function generateAIResponse(userMessage: string): string {
  const message = userMessage.toLowerCase();
  
  // Simple keyword-based responses for Excel automation
  if (message.includes('excel') || message.includes('spreadsheet')) {
    return "I can help you automate Excel tasks! What specific operation would you like to perform? I can help with data entry, formatting, calculations, charts, and more.";
  }
  
  if (message.includes('formula') || message.includes('function')) {
    return "I can help you create Excel formulas. Could you describe what calculation or operation you need? For example, SUM, VLOOKUP, IF statements, etc.";
  }
  
  if (message.includes('chart') || message.includes('graph')) {
    return "I can help you create charts and graphs in Excel. What type of data do you want to visualize? Bar charts, line graphs, pie charts, or something else?";
  }
  
  if (message.includes('data') || message.includes('import')) {
    return "I can help you work with data in Excel. Do you need to import data from another source, clean existing data, or organize it in a specific way?";
  }
  
  if (message.includes('hello') || message.includes('hi')) {
    return "Hello! I'm Nubia, your Excel automation assistant. I can help you automate spreadsheet tasks, create formulas, format data, and much more. What would you like to work on?";
  }
  
  return "I understand you need help with Excel automation. Could you provide more specific details about the task you'd like to accomplish? I can help with formulas, data manipulation, formatting, charts, and many other Excel operations.";
}