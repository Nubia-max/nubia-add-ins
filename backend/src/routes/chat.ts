import { Router } from 'express';
import { body } from 'express-validator';
import { handleChat, clearConversation, getDocumentContext, testNubia } from '../controllers/chatController';
import { validateRequest } from '../middleware/validateRequest';
import multer from 'multer';

const router = Router();

// Simple file upload configuration
const fileUploadConfig = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5
  }
});

// Enhanced chat endpoint for Excel add-in with rich context
router.post('/', [
  body('message').notEmpty().withMessage('Message is required')
], validateRequest, handleChat);

// File upload chat (future enhancement)
router.post('/with-files', fileUploadConfig.array('files', 5), handleChat);

// Utility endpoints
router.post('/clear', clearConversation);
router.get('/context', getDocumentContext);
router.get('/test', testNubia);

export { router as chatRoutes };