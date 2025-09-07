import { Router } from 'express';
import { body } from 'express-validator';
import { handleUniversalChat } from '../controllers/chatController';
import { auth } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';

const router = Router();

// Validation rules
const chatMessageValidation = [
  body('message')
    .notEmpty()
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Message must be between 1 and 5000 characters'),
];

// Universal chat endpoint - matches server-simple.js
router.post('/', auth, chatMessageValidation, validateRequest, handleUniversalChat);

export { router as chatRoutes };