import { Router } from 'express';
import { body } from 'express-validator';
import { handleImageUploadWithDirectPipeline } from '../controllers/imageUploadController';
import { handleChat, clearConversation, getDocumentContext, testNubia } from '../controllers/chatController';
import { auth } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import multer from 'multer';

const router = Router();

// Simple file upload configuration for our direct pipeline
const fileUploadConfig = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5
  }
});

// 🚀 Direct Pipeline: GPT-4 Vision → DeepSeek (with files)
router.post('/with-files', auth, fileUploadConfig.array('files', 5), handleImageUploadWithDirectPipeline);

// Simple text-only chat (no files)
router.post('/', auth, [
  body('message').notEmpty().withMessage('Message is required')
], validateRequest, handleChat);

// Utility endpoints
router.post('/clear', auth, clearConversation);
router.get('/context', auth, getDocumentContext);
router.get('/test', testNubia);

export { router as chatRoutes };