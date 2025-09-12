import { Router } from 'express';
import { body } from 'express-validator';
import { handleUniversalChat, handleUniversalChatWithFiles } from '../controllers/chatController';
import { auth } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import { fileUploadConfig } from '../services/fileProcessingService';

const router = Router();

// Validation rules for text-only messages
const chatMessageValidation = [
  body('message')
    .notEmpty()
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Message must be between 1 and 5000 characters'),
];

// Text-only chat endpoint
router.post('/', auth, chatMessageValidation, validateRequest, handleUniversalChat);

// File upload chat endpoint
router.post('/with-files', auth, fileUploadConfig.array('files', 5), handleUniversalChatWithFiles);

export { router as chatRoutes };