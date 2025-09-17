import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';

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

// Mock database
let users: any[] = [];
let subscriptions: any[] = [];

// Extend Express Request type
declare module 'express-serve-static-core' {
  interface Request {
    user?: { id: string; email: string };
  }
}

// Conversation memory storage
const conversationHistory = new Map();

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
app.get('/api/health', (req, res) => {  // Added /api prefix
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
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
    formatted.push({ role: 'user', content: msg.userMessage });
    formatted.push({ role: 'assistant', content: msg.gptResponse });
  });
  return formatted;
}

// Auth middleware
const authMiddleware = (req: any, res: any, next: any) => {
  const authHeader = req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as any;
    const user = users.find(u => u.id === decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    (req as any).user = { id: user.id, email: user.email };
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Auth routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = {
      id: `user_${Date.now()}`,
      email,
      password: hashedPassword,
      createdAt: new Date()
    };
    users.push(user);

    // Create trial subscription
    const subscription = {
      id: `sub_${Date.now()}`,
      userId: user.id,
      status: 'TRIAL',
      tier: 'TRIAL',
      automationsLimit: 10,
      automationsUsed: 0,
      billingPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    };
    subscriptions.push(subscription);

    // Generate token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      user: { id: user.id, email: user.email, createdAt: user.createdAt },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      user: { id: user.id, email: user.email, createdAt: user.createdAt },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json(req.user!);
});

// Subscription routes
app.get('/api/subscription/current', authMiddleware, (req, res) => {
  const subscription = subscriptions.find(s => s.userId === req.user!.id);
  if (!subscription) {
    // Create trial subscription if none exists
    const newSub = {
      id: `sub_${Date.now()}`,
      userId: req.user!.id,
      status: 'TRIAL',
      tier: 'TRIAL',
      automationsLimit: 10,
      automationsUsed: 0,
      billingPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    };
    subscriptions.push(newSub);
    return res.json(newSub);
  }
  res.json(subscription);
});

app.get('/api/subscription/tiers', (req, res) => {
  res.json({
    TRIAL: {
      tier: 'TRIAL',
      name: 'Free Trial',
      priceId: '',
      automationsLimit: 10,
      monthlyPrice: 0,
      features: ['10 Excel automations', 'Basic templates', 'Email support']
    },
    STARTER: {
      tier: 'STARTER',
      name: 'Starter',
      priceId: 'price_starter',
      automationsLimit: 100,
      monthlyPrice: 9,
      features: ['100 Excel automations', 'All templates', 'Priority email support', 'Custom macros']
    },
    PRO: {
      tier: 'PRO',
      name: 'Pro',
      priceId: 'price_pro',
      automationsLimit: -1,
      monthlyPrice: 29,
      features: ['Unlimited automations', 'Advanced templates', '24/7 chat support', 'API access', 'Team collaboration']
    },
    ENTERPRISE: {
      tier: 'ENTERPRISE',
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

    // Check usage limits
    const subscription = subscriptions.find(s => s.userId === req.user!.id);
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

    // Increment usage counter on success
    if (subscription && excelResult.success) {
      subscription.automationsUsed++;
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
app.post('/api/automation/process', authMiddleware, (req, res) => {
  const { command, context, options } = req.body;

  if (!command) {
    return res.status(400).json({ error: 'Command is required' });
  }

  // Check usage limits
  const subscription = subscriptions.find(s => s.userId === req.user!.id);
  if (subscription && subscription.automationsLimit !== -1) {
    if (subscription.automationsUsed >= subscription.automationsLimit) {
      return res.status(429).json({
        error: 'Usage limit exceeded',
        message: `You've reached your monthly limit of ${subscription.automationsLimit} automations. Please upgrade your plan.`
      });
    }
  }

  // Simulate automation processing
  setTimeout(() => {
    // Increment usage counter
    if (subscription) {
      subscription.automationsUsed++;
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

app.get('/api/automation/analytics', authMiddleware, (req, res) => {
  const subscription = subscriptions.find(s => s.userId === req.user!.id);
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
    const { message, includeContext = true } = req.body;
    const files = req.files || [];

    if (!message && files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Message or files are required'
      });
    }

    console.log(`💬 Processing NUBIA request with ${files.length} files:`, message?.substring(0, 100));

    // Check usage limits first
    const subscription = subscriptions.find(s => s.userId === req.user!.id);
    if (subscription && subscription.automationsLimit !== -1) {
      if (subscription.automationsUsed >= subscription.automationsLimit) {
        return res.status(429).json({
          error: 'Usage limit exceeded',
          message: `You've reached your monthly limit of ${subscription.automationsLimit} automations. Please upgrade your plan.`
        });
      }
    }

    // Get conversation history for this user
    const userId = req.user!.id;
    const history = conversationHistory.get(userId) || {
      messages: [],
      lastExcelStructure: null
    };

    // Build context for GPT if available and requested
    let contextString = '';
    let gptMessages: any[] = [];

    if (includeContext && (history.messages.length > 0 || history.lastExcelStructure)) {
      contextString = buildContextFromHistory(history);
    }

    // Build messages array with context
    gptMessages = [
      {
        role: 'system',
        content: LEGENDARY_NUBIA_SYSTEM_PROMPT
      }
    ];

    // Add recent conversation history for continuity - extended for better context
    if (includeContext && history.messages.length > 0) {
      const recentMessages = formatHistoryForGPT(history.messages.slice(-5)); // Extended from 2 to 5 for better thinking
      gptMessages.push(...recentMessages);
    }

    // Handle files with integrated GPT-4 + DeepSeek analysis
    let rawResponse = '';
    let structureFromFI = null;
    if (Array.isArray(files) && files.length > 0) {
      try {
        // Process all files (GPT-4 extraction for images)
        const processedFiles = await fileProcessingService.processUploadedFiles(files);

        // Use unified financial intelligence with file processing
        const fullUserMessage = contextString ? `${contextString}\nCurrent request: ${message}` : message;
        const enhancedPrompt = await fileProcessingService.getEnhancedPromptForProcessing(fullUserMessage, processedFiles);

        // Process through unified financial intelligence service
        const FinancialIntelligenceService = require('./services/financialIntelligence');
        const financialIntelligence = new FinancialIntelligenceService();
        const result = await financialIntelligence.processFinancialCommand(enhancedPrompt);
        rawResponse = result.chatResponse;

        // IMPORTANT: Get the already-parsed structure from the result
        structureFromFI = result.structure;
        console.log('🔍 SERVER.TS FILES: Got structure from FI:', structureFromFI ? 'EXISTS' : 'NULL');
        console.log('🔍 SERVER.TS FILES: Result object keys:', Object.keys(result));

      } catch (error) {
        console.error('Error processing files:', error);

        // Fallback to regular text processing if file processing fails
        const userMessageContent = contextString ?
          `${contextString}\nCurrent request: ${message}\n\n[Error processing uploaded files: ${(error as Error).message}]` :
          `${message}\n\n[Error processing uploaded files: ${(error as Error).message}]`;

        // Process through unified financial intelligence service
        const result = await financialIntelligence.processFinancialCommand(userMessageContent);
        rawResponse = result.chatResponse;

        // IMPORTANT: Get the already-parsed structure from the result
        structureFromFI = result.structure;
      }
    } else {
      // No files - regular text processing
      const userMessageContent = contextString ?
        `${contextString}\nCurrent request: ${message}` :
        message;

      // Process through unified financial intelligence service
      const result = await financialIntelligence.processFinancialCommand(userMessageContent);
      rawResponse = result.chatResponse;

      // IMPORTANT: Get the already-parsed structure from the result
      structureFromFI = result.structure;
    }
    console.log('🎯 NUBIA two-block response received');

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

    // Store this interaction in conversation history
    const messageId = generateMessageId();
    const conversationEntry = {
      id: messageId,
      timestamp: Date.now(),
      userMessage: message,
      gptResponse: chatResponse,
      excelStructure: hasValidExcel ? structure : null,
      rawResponse: rawResponse,
      filesUploaded: Array.isArray(files) ? files.map((f: any) => ({ name: f.originalname, size: f.size, type: f.mimetype })) : []
    };

    // Update conversation history
    history.messages.push(conversationEntry);
    if (hasValidExcel) {
      history.lastExcelStructure = structure;
    }

    // Keep only last 10 interactions
    if (history.messages.length > 10) {
      history.messages = history.messages.slice(-10);
    }

    // Store updated history
    conversationHistory.set(userId, history);

    if (hasValidExcel) {
      console.log('📊 SERVER.TS: Valid Excel structure detected - generating file');
      console.log('📊 SERVER.TS: Structure:', JSON.stringify(structure, null, 2).substring(0, 500));

      try {
        // Generate Excel file using parsed structure
        const result = await excelGenerator.generateFromStructure(structure, req.user!.id);
        console.log('📊 SERVER.TS: Excel generation result:', result);

        // Increment usage counter on success
        if (subscription && result.success) {
          subscription.automationsUsed++;
        }

        // Return standardized response shape
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
          filesProcessed: Array.isArray(files) ? files.length : 0
        });

      } catch (error) {
        console.error('❌ Excel generation error:', error);
        // Return chat response with error note
        return res.json({
          success: true,
          type: 'chat',
          message: chatResponse + " (Note: Excel generation encountered an issue, but I've provided the analysis above.)",
          conversationId: messageId,
          filesProcessed: Array.isArray(files) ? files.length : 0
        });
      }
    }

    // Just conversation - no valid Excel structure
    res.json({
      success: true,
      type: 'chat',
      message: chatResponse,
      conversationId: messageId,
      filesProcessed: Array.isArray(files) ? files.length : 0
    });

  } catch (error) {
    console.error('❌ NUBIA Chat API error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// Universal chat endpoint with conversation memory
app.post('/api/chat', authMiddleware, async (req, res) => {
  try {
    const { message, includeContext = true } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    console.log('💬 Processing NUBIA legendary accounting request:', message.substring(0, 100));

    // Check usage limits first
    const subscription = subscriptions.find(s => s.userId === req.user!.id);
    if (subscription && subscription.automationsLimit !== -1) {
      if (subscription.automationsUsed >= subscription.automationsLimit) {
        return res.status(429).json({
          error: 'Usage limit exceeded',
          message: `You've reached your monthly limit of ${subscription.automationsLimit} automations. Please upgrade your plan.`
        });
      }
    }

    // Get conversation history for this user
    const userId = req.user!.id;
    const history = conversationHistory.get(userId) || {
      messages: [],
      lastExcelStructure: null
    };

    // Check if context is needed and available
    const messageNeedsContext = needsContext(message);
    if (messageNeedsContext && !history.lastExcelStructure) {
      return res.json({
        success: true,
        type: 'chat',
        message: "I don't have any previous context from our conversation. Please specify what you'd like me to create or change, or provide more details about the financial document you're referring to."
      });
    }

    // Build context for GPT if available and requested
    let contextString = '';
    let gptMessages: any[] = [];

    if (includeContext && (history.messages.length > 0 || history.lastExcelStructure)) {
      contextString = buildContextFromHistory(history);
    }

    // Build messages array with LEGENDARY NUBIA system prompt
    gptMessages = [
      {
        role: 'system',
        content: LEGENDARY_NUBIA_SYSTEM_PROMPT
      }
    ];

    // Add recent conversation history for continuity - extended for better context
    if (includeContext && history.messages.length > 0) {
      const recentMessages = formatHistoryForGPT(history.messages.slice(-5)); // Extended from 2 to 5 for better thinking
      gptMessages.push(...recentMessages);
    }

    // Add current user message with context
    const userMessageContent = contextString ?
      `${contextString}\nCurrent request: ${message}` :
      message;

    gptMessages.push({
      role: 'user',
      content: userMessageContent
    });

    // Single unified call using LEGENDARY NUBIA financial intelligence with context
    const result = await financialIntelligence.processFinancialCommand(userMessageContent);
    const rawResponse = result.chatResponse;
    console.log('🎯 NUBIA two-block response received');

    // Use the already-parsed structure from financialIntelligence (same as with-files endpoint)
    const chatResponse = rawResponse; // This is already just the chat response
    const structure = result.structure; // Use the pre-parsed structure
    console.log('🔍 SERVER.TS: Using pre-parsed structure:', structure ? 'EXISTS' : 'NULL');

    // Validate structure to determine if Excel is needed - only validate if structure exists
    const validation = structure ? validateExcelStructure(structure) : { valid: false, error: 'No structure provided' };
    const hasValidExcel = validation.valid && structure;

    console.log('🔍 SERVER.TS: Excel validation result:', validation);
    console.log('🔍 SERVER.TS: hasValidExcel:', hasValidExcel);
    console.log('🔍 SERVER.TS: structure exists:', !!structure);

    // Store this interaction in conversation history
    const messageId = generateMessageId();
    const conversationEntry = {
      id: messageId,
      timestamp: Date.now(),
      userMessage: message,
      gptResponse: chatResponse,
      excelStructure: hasValidExcel ? structure : null,
      rawResponse: rawResponse
    };

    // Update conversation history
    history.messages.push(conversationEntry);
    if (hasValidExcel) {
      history.lastExcelStructure = structure;
    }

    // Keep only last 10 interactions
    if (history.messages.length > 10) {
      history.messages = history.messages.slice(-10);
    }

    // Store updated history
    conversationHistory.set(userId, history);

    if (hasValidExcel) {
      console.log('📊 SERVER.TS: Valid Excel structure detected - generating file');
      console.log('📊 SERVER.TS: Structure:', JSON.stringify(structure, null, 2).substring(0, 500));

      try {
        // Generate Excel file using parsed structure
        const result = await excelGenerator.generateFromStructure(structure, req.user!.id);
        console.log('📊 SERVER.TS: Excel generation result:', result);

        // Increment usage counter on success
        if (subscription && result.success) {
          subscription.automationsUsed++;
        }

        // Return standardized response shape
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
          conversationId: messageId
        });

      } catch (error) {
        console.error('❌ Excel generation error:', error);
        // Return chat response with error note
        return res.json({
          success: true,
          type: 'chat',
          message: chatResponse + " (Note: Excel generation encountered an issue, but I've provided the analysis above.)",
          conversationId: messageId
        });
      }
    }

    // Just conversation - no valid Excel structure
    res.json({
      success: true,
      type: 'chat',
      message: chatResponse,
      conversationId: messageId
    });

  } catch (error) {
    console.error('❌ NUBIA Chat API error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'Test route works!' });
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
  logger.info(`🚀 Server running on http://localhost:${PORT}`);
  logger.info(`📡 API available at http://localhost:${PORT}/api`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export { app, server, io };