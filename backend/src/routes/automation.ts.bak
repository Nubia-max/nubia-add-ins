import { Router } from 'express';
import { body } from 'express-validator';
import {
  processAutomation,
  getAutomationHistory,
  getUsageAnalytics,
  saveAutomationTemplate,
  getAutomationTemplates,
  useAutomationTemplate
} from '../controllers/automationController';
import { auth } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import { checkUsageMiddleware } from '../utils/usageTracking';

const router = Router();

// Validation rules
const automationValidation = [
  body('command')
    .isString()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Command must be between 1 and 5000 characters'),
  body('context')
    .optional()
    .isObject()
    .withMessage('Context must be an object'),
  body('options')
    .optional()
    .isObject()
    .withMessage('Options must be an object')
];

const templateValidation = [
  body('name')
    .isString()
    .isLength({ min: 1, max: 200 })
    .withMessage('Template name must be between 1 and 200 characters'),
  body('description')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('commands')
    .isArray({ min: 1 })
    .withMessage('Commands must be a non-empty array'),
  body('category')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('Category must be less than 50 characters'),
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean')
];

// Routes with usage limits
router.post('/process', 
  auth, 
  checkUsageMiddleware('excel_automation'), 
  automationValidation, 
  validateRequest, 
  processAutomation
);

router.get('/history', auth, getAutomationHistory);
router.get('/analytics', auth, getUsageAnalytics);

// Template management
router.post('/templates', 
  auth, 
  templateValidation, 
  validateRequest, 
  saveAutomationTemplate
);

router.get('/templates', auth, getAutomationTemplates);
router.post('/templates/:templateId/use', auth, useAutomationTemplate);

export { router as automationRoutes };