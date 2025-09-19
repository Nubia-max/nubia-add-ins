// Socket.IO setup and handlers
import { Server } from 'socket.io';
import { logger } from './logger';

export const setupSocketHandlers = (io: Server) => {
  io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    // Handle chat message events
    socket.on('chat:message', (data) => {
      logger.info(`Chat message from ${socket.id}:`, data);
      // Echo back or broadcast to other clients
      socket.emit('chat:response', {
        id: `msg_${Date.now()}`,
        message: 'Message received',
        timestamp: new Date().toISOString()
      });
    });

    // Handle automation events
    socket.on('automation:start', (data) => {
      logger.info(`Automation started by ${socket.id}:`, data);
      socket.emit('automation:status', {
        status: 'processing',
        message: 'Automation is being processed...'
      });
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info(`Client disconnected: ${socket.id}, reason: ${reason}`);
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error(`Socket error for ${socket.id}:`, error);
    });
  });

  logger.info('Socket.IO handlers initialized');
};