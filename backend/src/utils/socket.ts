import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

const prisma = new PrismaClient();

interface SocketWithAuth extends Socket {
  userId?: string;
}

interface JwtPayload {
  userId: string;
}

export const setupSocketHandlers = (io: Server) => {
  // Authentication middleware for Socket.IO
  io.use(async (socket: any, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'fallback-secret'
      ) as JwtPayload;

      // Verify user exists
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true }
      });

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.userId = decoded.userId;
      socket.userEmail = user.email;
      next();
    } catch (error) {
      logger.error('Socket authentication error:', error);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: any) => {
    logger.info(`User connected: ${socket.userEmail} (${socket.userId})`);

    // Join user to their own room for private messages
    socket.join(`user-${socket.userId}`);

    // Handle incoming messages
    socket.on('send-message', async (messageData: any) => {
      try {
        logger.info(`Message received from ${socket.userEmail}: ${messageData.content}`);
        
        // Emit typing indicator
        io.to(`user-${socket.userId}`).emit('typing');
        
        // Simulate AI processing time
        setTimeout(() => {
          // Generate AI response
          const aiResponse = {
            id: Date.now().toString(),
            content: generateAIResponse(messageData.content),
            sender: 'assistant',
            timestamp: new Date(),
            userId: socket.userId
          };

          // Stop typing indicator
          io.to(`user-${socket.userId}`).emit('stop-typing');
          
          // Send AI response
          io.to(`user-${socket.userId}`).emit('message', aiResponse);
          
          logger.info(`AI response sent to ${socket.userEmail}`);
        }, 1000 + Math.random() * 2000); // 1-3 second delay
        
      } catch (error) {
        logger.error('Error handling message:', error);
        socket.emit('error', { message: 'Failed to process message' });
      }
    });

    // Handle automation requests
    socket.on('automation-request', async (taskData: any) => {
      try {
        logger.info(`Automation request from ${socket.userEmail}: ${taskData.task}`);
        
        // Emit task started
        socket.emit('automation-started', { 
          taskId: taskData.taskId,
          status: 'processing'
        });

        // TODO: Send request to Python automation service
        // For now, simulate automation completion
        setTimeout(() => {
          socket.emit('automation-completed', {
            taskId: taskData.taskId,
            status: 'completed',
            result: 'Task completed successfully'
          });
        }, 5000);
        
      } catch (error) {
        logger.error('Error handling automation request:', error);
        socket.emit('automation-failed', {
          taskId: taskData.taskId,
          status: 'failed',
          error: 'Failed to process automation request'
        });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${socket.userEmail} (${socket.userId})`);
    });

    // Handle errors
    socket.on('error', (error: any) => {
      logger.error(`Socket error for user ${socket.userEmail}:`, error);
    });
  });
};

// Simple AI response generator (same as in chatController)
function generateAIResponse(userMessage: string): string {
  const message = userMessage.toLowerCase();
  
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