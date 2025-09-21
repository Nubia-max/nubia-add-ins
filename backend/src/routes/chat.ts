import { Router } from 'express';
import { body } from 'express-validator';
import { handleChat, testEndpoint } from '../controllers/chatController';
import { validateRequest } from '../middleware/validateRequest';

const router = Router();

// Main chat endpoint for Excel GPT
router.post('/', [
  body('message').notEmpty().withMessage('Message is required')
], validateRequest, handleChat);

// Test endpoint
router.get('/test', testEndpoint);

export { router as chatRoutes };