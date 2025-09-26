import { Router } from 'express';
import { body } from 'express-validator';
import { handleChat, handleChatStream, testEndpoint } from '../controllers/chatController';
import { validateRequest } from '../middleware/validateRequest';

const router = Router();

// Main chat endpoint for Excel GPT
router.post('/', [
  body('userCommand').notEmpty().withMessage('User command is required')
], validateRequest, handleChat);

// SSE streaming endpoint for complex operations
router.post('/stream', [
  body('userCommand').notEmpty().withMessage('User command is required')
], validateRequest, handleChatStream);

// Test endpoint
router.get('/test', testEndpoint);

export { router as chatRoutes };