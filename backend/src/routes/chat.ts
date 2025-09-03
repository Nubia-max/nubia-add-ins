import { Router } from 'express';
import { body, param } from 'express-validator';
import { 
  getChatHistory, 
  sendMessage 
} from '../controllers/chatController';
import { auth } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';

const router = Router();

// Validation rules
const sendMessageValidation = [
  body('content')
    .notEmpty()
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Message content must be between 1 and 5000 characters')
];

const getUserHistoryValidation = [
  param('userId')
    .notEmpty()
    .withMessage('User ID is required')
];

// Routes
router.get('/history/:userId', auth, getUserHistoryValidation, validateRequest, getChatHistory);
router.post('/send', auth, sendMessageValidation, validateRequest, sendMessage);

export { router as chatRoutes };