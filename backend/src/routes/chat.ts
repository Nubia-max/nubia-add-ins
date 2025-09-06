import { Router } from 'express';
import { body, param } from 'express-validator';
import { 
  getChatHistory, 
  getChatById,
  createNewChat,
  sendMessage 
} from '../controllers/chatController';
import { auth } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import { checkUsageMiddleware } from '../utils/usageTracking';

const router = Router();

// Validation rules
const sendMessageValidation = [
  body('content')
    .notEmpty()
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Message content must be between 1 and 5000 characters'),
  body('chatId')
    .optional()
    .isString()
    .withMessage('Chat ID must be a string')
];

const getUserHistoryValidation = [
  param('userId')
    .notEmpty()
    .withMessage('User ID is required')
];

const getChatValidation = [
  param('chatId')
    .notEmpty()
    .withMessage('Chat ID is required')
];

// Routes
router.get('/history/:userId', auth, getUserHistoryValidation, validateRequest, getChatHistory);
router.get('/chat/:chatId', auth, getChatValidation, validateRequest, getChatById);
router.post('/new', auth, validateRequest, createNewChat);
router.post('/send', auth, sendMessageValidation, validateRequest, sendMessage);

export { router as chatRoutes };