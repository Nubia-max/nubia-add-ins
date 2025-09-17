import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import multer from 'multer';

// Import Firebase services for auth and database
import { firebaseService } from './services/firebase';
import { auth } from './middleware/auth';

// import { authRoutes } from './routes/auth';
// import { chatRoutes } from './routes/chat';
// import { subscriptionRoutes } from './routes/subscription';
// import { automationRoutes } from './routes/automation';
// import excelRoutes from './routes/excel';
import { errorHandler } from './middleware/errorHandler';
import { setupSocketHandlers } from './utils/socket';
import { logger } from './utils/logger';

// Import services from simple-server functionality
const FinancialIntelligenceService = require('./services/financialIntelligence');
const DynamicExcelGenerator = require('./services/dynamicExcelGenerator');
const { validateExcelStructure } = require('./utils/sectionParsers');
const { LEGENDARY_NUBIA_SYSTEM_PROMPT } = require('./constants/systemPrompts');

// Import FileProcessingService for OCR/image processing
import FileProcessingService from './services/fileProcessingService';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.BACKEND_PORT || 3001;

// Initialize services
const financialIntelligence = new FinancialIntelligenceService();
const excelGenerator = new DynamicExcelGenerator();
const fileProcessingService = new FileProcessingService();

// Firebase Firestore replaces mock database for persistent storage

// Extend Express Request type
declare module 'express-serve-static-core' {
  interface Request {
    user?: { id: string; email: string };
  }
}

// Conversation history now stored in Firebase Firestore for persistence
const conversationHistory = new Map(); // Keep in-memory for performance, with Firebase backup

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP'
});

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not supported') as any, false);
    }
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: function(origin: any, callback: any) {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'http://localhost:3000',  // Web frontend
      'http://localhost:3001',  // Backend itself
      'http://localhost:3002',  // Alternative frontend port
      'file://'                 // Electron app
    ];

    // Check if origin starts with any allowed origin
    const isAllowed = allowedOrigins.some(allowed =>
      origin.startsWith(allowed)
    );

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS') as any, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    auth: 'Firebase Auth',
    database: 'Firebase Firestore',
    storage: 'Firebase Storage'
  });
});

// Helper functions for conversation management
function generateMessageId() {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function buildContextFromHistory(history: any) {
  if (!history || history.messages.length === 0) {
    return '';
  }

  const lastExcelStructure = history.lastExcelStructure;
  const recentMessages = history.messages.slice(-3); // Last 3 exchanges for context

  let context = '\n**CONVERSATION CONTEXT:**\n';

  if (lastExcelStructure) {
    context += `PREVIOUS EXCEL WORK:
- Last created: ${lastExcelStructure.meta?.mode || 'Financial document'}
- Worksheets: ${lastExcelStructure.workbook?.map((w: any) => w.name).join(', ') || 'Unknown'}
- Type: ${lastExcelStructure.meta?.framework || 'Financial analysis'}
- Currency: ${lastExcelStructure.meta?.currency || 'USD'}

`;
  }

  if (recentMessages.length > 0) {
    context += 'RECENT CONVERSATION:\n';
    recentMessages.forEach((msg: any, index: number) => {
      const userMsg = msg.userMessage || '';
      const gptMsg = msg.gptResponse || '';
      context += `${index + 1}. User: ${userMsg.substring(0, 100)}${userMsg.length > 100 ? '...' : ''}\n`;
      context += `   Response: ${gptMsg.substring(0, 100)}${gptMsg.length > 100 ? '...' : ''}\n\n`;
    });
  }

  context += `When users reference "previous work", "that document", "change the value", "update that", or similar phrases, they refer to the context above. Use this information to understand their requests.\n\n`;

  return context;
}

function needsContext(message: string) {
  const contextCommands = [
    /change .* to/i,
    /update the/i,
    /correct that/i,
    /add another/i,
    /remove the/i,
    /show me .* instead/i,
    /modify .*/i,
    /adjust .*/i,
    /fix .*/i,
    /(that|this|previous|last) (document|file|excel|sheet|workbook)/i,
    /from (before|earlier|previous)/i
  ];

  return contextCommands.some(pattern => pattern.test(message));
}

function formatHistoryForGPT(messages: any[]) {
  const formatted: any[] = [];
  messages.forEach(msg => {
    // Ensure content fields exist and are non-empty
    if (msg.userMessage && typeof msg.userMessage === 'string' && msg.userMessage.trim()) {
      formatted.push({ role: 'user', content: msg.userMessage });
    }
    if (msg.gptResponse && typeof msg.gptResponse === 'string' && msg.gptResponse.trim()) {
      formatted.push({ role: 'assistant', content: msg.gptResponse });
    }
  });
  return formatted;
}

// Firebase Auth middleware
const authMiddleware = auth;

// Firebase Auth routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // Firebase Auth is handled client-side, but we can return config info
    return res.json({
      success: true,
      message: 'Use Firebase client SDK for authentication',
      authMethod: 'firebase',
      config: {
        projectId: process.env.FIREBASE_PROJECT_ID,
        authDomain: `${process.env.FIREBASE_PROJECT_ID}.firebaseapp.com`,
        usingEmulator: process.env.USE_FIREBASE_EMULATOR === 'true'
      }
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error'
    });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // Firebase Auth is handled client-side, but we can return config info
    return res.json({
      success: true,
      message: 'Use Firebase client SDK for registration',
      authMethod: 'firebase',
      config: {
        projectId: process.env.FIREBASE_PROJECT_ID,
        authDomain: `${process.env.FIREBASE_PROJECT_ID}.firebaseapp.com`,
        usingEmulator: process.env.USE_FIREBASE_EMULATOR === 'true'
      }
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error'
    });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await firebaseService.getUserById(req.user!.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      id: user.id,
      email: user.email,
      settings: user.settings,
      createdAt: user.createdAt
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Firebase Subscription routes
app.get('/api/subscription/current', authMiddleware, async (req, res) => {
  try {
    let subscription = await firebaseService.getSubscriptionByUserId(req.user!.id);
    if (!subscription) {
      // Create trial subscription if none exists
      subscription = await firebaseService.createSubscription({
        userId: req.user!.id,
        status: 'active',
        tier: 'free',
        automationsLimit: 10,
        automationsUsed: 0,
        billingPeriodStart: new Date(),
        billingPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });
    }
    res.json(subscription);
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/subscription/tiers', (req, res) => {
  res.json({
    free: {
      tier: 'free',
      name: 'Free',
      priceId: '',
      automationsLimit: 10,
      monthlyPrice: 0,
      features: ['10 Excel automations', 'Basic templates', 'Email support']
    },
    starter: {
      tier: 'starter',
      name: 'Starter',
      priceId: 'price_starter',
      automationsLimit: 100,
      monthlyPrice: 9,
      features: ['100 Excel automations', 'All templates', 'Priority email support', 'Custom macros']
    },
    pro: {
      tier: 'pro',
      name: 'Pro',
      priceId: 'price_pro',
      automationsLimit: -1,
      monthlyPrice: 29,
      features: ['Unlimited automations', 'Advanced templates', '24/7 chat support', 'API access', 'Team collaboration']
    },
    enterprise: {
      tier: 'enterprise',
      name: 'Enterprise',
      priceId: 'price_enterprise',
      automationsLimit: -1,
      monthlyPrice: 99,
      features: ['Everything in Pro', 'Dedicated support', 'SSO integration', 'Custom integrations', 'SLA guarantee']
    }
  });
});

// Financial generation
app.post('/api/financial/generate', authMiddleware, async (req, res) => {
  try {
    const { command, context, options } = req.body;

    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }

    // Check usage limits with Firebase
    const subscription = await firebaseService.getSubscriptionByUserId(req.user!.id);
    if (subscription && subscription.automationsLimit !== -1) {
      if (subscription.automationsUsed >= subscription.automationsLimit) {
        return res.status(429).json({
          error: 'Usage limit exceeded',
          message: `You've reached your monthly limit of ${subscription.automationsLimit} automations. Please upgrade your plan.`
        });
      }
    }

    // Get previous commands for context
    const previousCommands = context?.history || [];

    // Process with GPT intelligence
    const gptResult = await financialIntelligence.processFinancialCommand(
      command
    );

    if (!gptResult.success) {
      return res.status(500).json({
        error: 'Failed to process financial command',
        details: gptResult.error,
        fallback: gptResult.fallback
      });
    }

    // Generate Excel file
    const excelResult = await excelGenerator.generateFromStructure(
      gptResult.structure,
      req.user!.id
    );

    // Increment usage counter on success with Firebase
    if (subscription && excelResult.success) {
      await firebaseService.updateSubscription(subscription.id, {
        automationsUsed: subscription.automationsUsed + 1
      });
    }

    res.json({
      success: true,
      result: {
        type: 'financial_document',
        structure: gptResult.structure,
        excel: excelResult,
        tokensUsed: gptResult.tokensUsed,
        model: 'deepseek-reasoner'
      },
      subscription
    });

  } catch (error) {
    console.error('Financial generation error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: (error as Error).message
    });
  }
});

// Automation routes (legacy - kept for compatibility)
app.post('/api/automation/process', authMiddleware, async (req, res) => {
  const { command, context, options } = req.body;

  if (!command) {
    return res.status(400).json({ error: 'Command is required' });
  }

  // Check usage limits with Firebase
  const subscription = await firebaseService.getSubscriptionByUserId(req.user!.id);
  if (subscription && subscription.automationsLimit !== -1) {
    if (subscription.automationsUsed >= subscription.automationsLimit) {
      return res.status(429).json({
        error: 'Usage limit exceeded',
        message: `You've reached your monthly limit of ${subscription.automationsLimit} automations. Please upgrade your plan.`
      });
    }
  }

  // Simulate automation processing
  setTimeout(async () => {
    // Increment usage counter with Firebase
    if (subscription) {
      await firebaseService.updateSubscription(subscription.id, {
        automationsUsed: subscription.automationsUsed + 1
      });
    }
  }, 100);

  res.json({
    success: true,
    result: {
      type: 'excel_macro',
      instructions: `Generated automation for: ${command}`,
      vbaCode: `' Auto-generated VBA code for: ${command}\nSub AutomatedTask()\n    ' Implementation here\nEnd Sub`,
      success: true
    },
    subscription
  });
});

app.get('/api/automation/analytics', authMiddleware, async (req, res) => {
  const subscription = await firebaseService.getSubscriptionByUserId(req.user!.id);
  res.json({
    analytics: {
      totalAutomations: subscription ? subscription.automationsUsed : 0,
      successfulAutomations: subscription ? subscription.automationsUsed : 0,
      totalChatQueries: 0,
      totalTokensUsed: 150,
      averageExecutionTime: 1200
    },
    subscription
  });
});

// Conversation memory management endpoints
app.post('/api/chat/clear', authMiddleware, (req, res) => {
  try {
    const userId = req.user!.id;
    conversationHistory.delete(userId);
    console.log(`🧹 Cleared conversation history for user ${userId}`);

    res.json({
      success: true,
      message: 'Conversation history cleared successfully'
    });
  } catch (error) {
    console.error('❌ Error clearing conversation history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear conversation history'
    });
  }
});

app.get('/api/chat/history', authMiddleware, (req, res) => {
  try {
    const userId = req.user!.id;
    const history = conversationHistory.get(userId);

    if (!history) {
      return res.json({
        success: true,
        history: { messages: [], lastExcelStructure: null },
        totalMessages: 0
      });
    }

    // Return sanitized history
    const sanitizedHistory = {
      ...history,
      messages: history.messages.map((msg: any) => ({
        id: msg.id,
        timestamp: msg.timestamp,
        userMessage: msg.userMessage,
        gptResponse: msg.gptResponse,
        hasExcel: !!msg.excelStructure
      }))
    };

    res.json({
      success: true,
      history: sanitizedHistory,
      totalMessages: history.messages.length
    });
  } catch (error) {
    console.error('❌ Error fetching conversation history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversation history'
    });
  }
});

// Chat endpoint with file uploads
app.post('/api/chat/with-files', upload.array('files', 5), authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;
    const files = req.files || [];

    // Allow files without message, but require at least one of them
    if (!message && files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Message or files are required'
      });
    }

    // Use message as-is, or empty string if only files (GPT-4 will extract content)
    const processMessage = message || "";

    console.log(`💬 Processing NUBIA request with SMART CONTEXT and ${files.length} files:`, message?.substring(0, 100));

    // Check usage limits first with Firebase
    const subscription = await firebaseService.getSubscriptionByUserId(req.user!.id);
    if (subscription && subscription.automationsLimit !== -1) {
      if (subscription.automationsUsed >= subscription.automationsLimit) {
        return res.status(429).json({
          error: 'Usage limit exceeded',
          message: `You've reached your monthly limit of ${subscription.automationsLimit} automations. Please upgrade your plan.`
        });
      }
    }

    const userId = req.user!.id;

    // DEBUG: Re-enable smart context for files to debug GPT-4 extraction
    let result;
    if (Array.isArray(files) && files.length > 0) {
      // Process with files using smart context - with debugging enabled
      console.log('🔍 DEBUG: Processing file with smart context to identify GPT-4 extraction issue');
      result = await financialIntelligence.processWithSmartContextAndFiles(processMessage, userId, files, fileProcessingService);
    } else {
      // No files - use regular smart context
      result = await financialIntelligence.processWithSmartContext(processMessage, userId);
    }

    const rawResponse = result.chatResponse;
    const structureFromFI = result.structure;
    console.log('🎯 NUBIA SMART CONTEXT response received');
    console.log('🔍 Smart context used:', result.contextUsed);
    console.log('🔍 Response enhanced:', result.enhanced);

    // Use the already-parsed structure from financialIntelligence
    const chatResponse = rawResponse; // This is already just the chat response
    const structure = structureFromFI; // Use the pre-parsed structure
    console.log('🔍 SERVER.TS: Using pre-parsed structure:', structure ? 'EXISTS' : 'NULL');

    // Validate structure to determine if Excel is needed - only validate if structure exists
    const validation = structure ? validateExcelStructure(structure) : { valid: false, error: 'No structure provided' };
    const hasValidExcel = validation.valid && structure;

    console.log('🔍 SERVER.TS: Excel validation result:', validation);
    console.log('🔍 SERVER.TS: hasValidExcel:', hasValidExcel);
    console.log('🔍 SERVER.TS: structure exists:', !!structure);

    // Generate message ID for this interaction
    const messageId = generateMessageId();

    if (hasValidExcel) {
      console.log('📊 SERVER.TS: Valid Excel structure detected - generating file');
      console.log('📊 SERVER.TS: Structure:', JSON.stringify(structure, null, 2).substring(0, 500));

      try {
        // Generate Excel file using parsed structure
        const result = await excelGenerator.generateFromStructure(structure, req.user!.id);
        console.log('📊 SERVER.TS: Excel generation result:', result);

        // Increment usage counter on success with Firebase
        if (subscription && result.success) {
          await firebaseService.updateSubscription(subscription.id, {
            automationsUsed: subscription.automationsUsed + 1
          });
        }

        // Return standardized response shape with smart context info
        return res.json({
          success: true,
          type: 'excel',
          message: chatResponse,
          excelData: {
            filename: result.filename,
            filepath: result.filepath,
            summary: (structure as any)?.meta?.summary || 'Professional Excel workbook created',
            structure: structure
          },
          conversationId: messageId,
          filesProcessed: Array.isArray(files) ? files.length : 0,
          smartContext: {
            contextUsed: result.contextUsed,
            enhanced: result.enhanced,
            tokensUsed: result.tokensUsed
          }
        });

      } catch (error) {
        console.error('❌ Excel generation error:', error);
        // Return chat response with error note
        return res.json({
          success: true,
          type: 'chat',
          message: chatResponse + " (Note: Excel generation encountered an issue, but I've provided the analysis above.)",
          conversationId: messageId,
          filesProcessed: Array.isArray(files) ? files.length : 0,
          smartContext: {
            contextUsed: result.contextUsed,
            enhanced: result.enhanced,
            tokensUsed: result.tokensUsed
          }
        });
      }
    }

    // Just conversation - no valid Excel structure
    res.json({
      success: true,
      type: 'chat',
      message: chatResponse,
      conversationId: messageId,
      filesProcessed: Array.isArray(files) ? files.length : 0,
      smartContext: {
        contextUsed: result.contextUsed,
        enhanced: result.enhanced,
        tokensUsed: result.tokensUsed
      }
    });

  } catch (error) {
    console.error('❌ NUBIA Chat API error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// TEST: Smart context without auth for testing
app.post('/api/test/smart-context-files', async (req, res) => {
  try {
    const { message } = req.body;
    const testUserId = 'test-user-123';

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    console.log('🧪 Testing smart context with files (no auth):', message);

    // Test smart context functionality directly
    const result = await financialIntelligence.processWithSmartContext(message, testUserId);

    return res.json({
      success: true,
      type: 'chat',
      message: result.chatResponse,
      smartContext: {
        contextUsed: result.contextUsed,
        enhanced: result.enhanced,
        tokensUsed: result.tokensUsed
      },
      testMode: true
    });

  } catch (error) {
    console.error('❌ Test smart context error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// NEW: Smart context chat endpoint (two-stage reasoning)
app.post('/api/chat/smart', authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.user!.id;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    console.log('🧠 Smart Context Chat:', message.substring(0, 100));

    // Check usage limits first with Firebase
    const subscription = await firebaseService.getSubscriptionByUserId(userId);
    if (subscription && subscription.automationsLimit !== -1) {
      if (subscription.automationsUsed >= subscription.automationsLimit) {
        return res.status(429).json({
          error: 'Usage limit exceeded',
          message: `You've reached your monthly limit of ${subscription.automationsLimit} automations. Please upgrade your plan.`
        });
      }
    }

    // Use smart context processing (two-stage reasoning)
    const result = await financialIntelligence.processWithSmartContext(message, userId);

    // Check if it's accounting (has structure) or just chat
    if (result.structure) {
      // Generate Excel for accounting queries
      console.log('📊 SMART CONTEXT: Generating Excel with structure');
      const excelResult = await excelGenerator.generateFromStructure(result.structure, userId);

      // Update usage if successful
      if (subscription && excelResult?.success) {
        await firebaseService.updateSubscription(subscription.id, {
          automationsUsed: subscription.automationsUsed + 1
        });
      }

      return res.json({
        success: true,
        type: 'excel',
        message: result.chatResponse,
        contextUsed: result.contextUsed,
        enhanced: result.enhanced,
        excelData: {
          filename: excelResult?.filename || 'unknown.xlsx',
          filepath: excelResult?.filepath || '',
          summary: result.structure?.meta?.summary || 'Professional Excel workbook created',
          structure: result.structure
        }
      });
    } else {
      // Just chat response
      return res.json({
        success: true,
        type: 'chat',
        message: result.chatResponse,
        contextUsed: result.contextUsed,
        enhanced: result.enhanced
      });
    }

  } catch (error) {
    console.error('❌ Smart context chat error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// Universal chat endpoint with SMART CONTEXT (two-stage reasoning) and Firebase persistence
app.post('/api/chat', authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.user!.id;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    console.log('🧠 Processing NUBIA with Smart Context (Two-Stage Reasoning):', message.substring(0, 100));

    // Check usage limits first with Firebase
    const subscription = await firebaseService.getSubscriptionByUserId(userId);
    if (subscription && subscription.automationsLimit !== -1) {
      if (subscription.automationsUsed >= subscription.automationsLimit) {
        return res.status(429).json({
          error: 'Usage limit exceeded',
          message: `You've reached your monthly limit of ${subscription.automationsLimit} automations. Please upgrade your plan.`
        });
      }
    }

    // Use smart context processing (two-stage reasoning with Firebase persistence)
    const result = await financialIntelligence.processWithSmartContext(message, userId);

    // Check if it's accounting (has structure) or just chat
    if (result.structure) {
      // Generate Excel for accounting queries
      console.log('📊 SMART CONTEXT: Generating Excel with structure');
      const excelResult = await excelGenerator.generateFromStructure(result.structure, userId);

      // Update usage if successful
      if (subscription && excelResult?.success) {
        await firebaseService.updateSubscription(subscription.id, {
          automationsUsed: subscription.automationsUsed + 1
        });
      }

      return res.json({
        success: true,
        type: 'excel',
        message: result.chatResponse,
        contextUsed: result.contextUsed,
        enhanced: result.enhanced,
        reasoning: result.reasoning,
        excelData: {
          filename: excelResult?.filename || 'unknown.xlsx',
          filepath: excelResult?.filepath || '',
          summary: result.structure?.meta?.summary || 'Professional Excel workbook created',
          structure: result.structure
        }
      });
    } else {
      // Just chat response
      return res.json({
        success: true,
        type: 'chat',
        message: result.chatResponse,
        contextUsed: result.contextUsed,
        enhanced: result.enhanced,
        reasoning: result.reasoning
      });
    }

  } catch (error) {
    console.error('❌ Smart context chat error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'Test route works!' });
});

// Test endpoint for smart context (no auth required for testing)
app.post('/api/test/smart-context', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    console.log('🧪 Testing Smart Context:', message.substring(0, 100));

    const SmartContextManager = require('./services/smartContextManager');
    const smartContext = new SmartContextManager();

    const testUserId = 'test-user-123';
    const systemPrompt = `You are Nubia, an expert Financial Intelligence assistant. Generate professional financial documents and analysis.`;

    const result = await smartContext.processWithSmartContext(
      message,
      systemPrompt,
      testUserId
    );

    res.json({
      success: true,
      message: result.chatResponse,
      contextUsed: result.contextUsed,
      enhanced: result.enhanced,
      reasoning: result.reasoning,
      tokensUsed: result.tokensUsed
    });

  } catch (error) {
    console.error('❌ Smart context test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Smart context test failed'
    });
  }
});

// API Routes - use the integrated routes above instead of separate route files
// app.use('/api/auth', authRoutes);
// app.use('/api/chat', chatRoutes);
// app.use('/api/subscription', subscriptionRoutes);
// app.use('/api/automation', automationRoutes);
// app.use('/api/excel', excelRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling
app.use(errorHandler);

// Socket.IO setup
setupSocketHandlers(io);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

server.listen(PORT, () => {
  logger.info(`🚀 Firebase-powered NUBIA Server running on http://localhost:${PORT}`);
  logger.info(`📡 API available at http://localhost:${PORT}/api`);
  logger.info(`🔥 Database: Firebase Firestore`);
  logger.info(`🔐 Auth: Firebase Auth`);
  logger.info(`📦 Storage: Firebase Storage`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export { app, server, io };