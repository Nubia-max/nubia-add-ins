require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const FinancialIntelligenceService = require('./services/financialIntelligence');
const DynamicExcelGenerator = require('./services/dynamicExcelGenerator');
const LLMService = require('./services/llmService');

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

// Initialize services
const financialIntelligence = new FinancialIntelligenceService();
const llmService = new LLMService();
const excelGenerator = new DynamicExcelGenerator(llmService);

// Middleware
app.use(cors({
  origin: function(origin, callback) {
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
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Mock database
let users = [];
let subscriptions = [];

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

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

// Auth middleware
const authMiddleware = (req, res, next) => {
  const authHeader = req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    const user = users.find(u => u.id === decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    req.user = { id: user.id, email: user.email };
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json(req.user);
});

// Subscription routes
app.get('/api/subscription/current', authMiddleware, (req, res) => {
  const subscription = subscriptions.find(s => s.userId === req.user.id);
  if (!subscription) {
    // Create trial subscription if none exists
    const newSub = {
      id: `sub_${Date.now()}`,
      userId: req.user.id,
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

// New GPT-driven financial document generation
app.post('/api/financial/generate', authMiddleware, async (req, res) => {
  try {
    const { command, context, options } = req.body;
    
    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }

    // Check usage limits
    const subscription = subscriptions.find(s => s.userId === req.user.id);
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
    const gptResult = await financialIntelligence.processWithContext(
      command, 
      req.user.id, 
      previousCommands
    );

    if (!gptResult.success) {
      return res.status(500).json({
        error: 'Failed to process financial command',
        details: gptResult.error,
        fallback: gptResult.fallback
      });
    }

    // Generate Excel file
    const excelResult = await excelGenerator.generateAccountingWorkbook(
      command, // Pass the original command instead of structure
      req.user.id
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
        model: gptResult.model
      },
      subscription
    });

  } catch (error) {
    console.error('Financial generation error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
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
  const subscription = subscriptions.find(s => s.userId === req.user.id);
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
  const subscription = subscriptions.find(s => s.userId === req.user.id);
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

// Test route to debug
app.get('/api/test', (req, res) => {
  res.json({ message: 'Test route works!' });
});

// Universal chat endpoint - GPT decides everything
app.post('/api/chat', authMiddleware, async (req, res) => {
  try {
    const { message, context } = req.body;
    
    if (!message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Message is required' 
      });
    }

    console.log('💬 Processing message:', message.substring(0, 100));

    // Check usage limits first
    const subscription = subscriptions.find(s => s.userId === req.user.id);
    if (subscription && subscription.automationsLimit !== -1) {
      if (subscription.automationsUsed >= subscription.automationsLimit) {
        return res.status(429).json({
          error: 'Usage limit exceeded',
          message: `You've reached your monthly limit of ${subscription.automationsLimit} automations. Please upgrade your plan.`
        });
      }
    }

    // STEP 1: Get conversational response for user (what they see)
    const conversationalResponse = await llmService.createCompletion({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are Nubia, a friendly AI that creates Excel workbooks.

CAPABILITIES:
- You can create 1-50+ worksheets in a single workbook
- Each worksheet can have completely different structures
- You can include formulas, charts, pivot tables, anything Excel supports
- You decide what's best for each request

IMPORTANT:
- Never give manual instructions ("Step 1: Open Excel")
- Always speak as if you're creating the file ("I'll create that for you")
- Be conversational AND provide the Excel structure
- If the user asks for something you can't do, politely explain why
You have COMPLETE FREEDOM to create whatever makes sense.`
        },
        {
          role: 'user',
          content: message
        }
      ],
      temperature: 0.8,
      max_tokens: 500
    });
    
    const chatMessage = conversationalResponse.choices[0].message.content;
    
    // STEP 2: Check if Excel is needed (hidden from user)
    const needsExcelCheck = await llmService.createCompletion({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `Determine if this user message requires creating an Excel file. 

Respond with ONLY "YES" or "NO".

YES if the user wants to:
- Record transactions
- Create budgets, trackers, spreadsheets
- Track data in Excel
- Generate financial reports
- Create any kind of workbook

NO if the user is:
- Just greeting or chatting
- Asking questions without wanting files
- Requesting explanations`
        },
        {
          role: 'user',
          content: message
        }
      ],
      temperature: 0.1,
      max_tokens: 10
    });
    
    const needsExcel = needsExcelCheck.choices[0].message.content.trim().toUpperCase() === 'YES';
    
    if (needsExcel) {
      console.log('🎯 User needs Excel file - generating data structure');
      
      try {
        // STEP 3: Get Excel data structure (JSON only, hidden from user)
        const excelDataResponse = await llmService.createCompletion({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: `Create Excel structure for accounting. Extract ALL transactions from user message.
Analyze the user's message and extract all transactions. Create a comprehensive Excel structure with the actual transaction data populated in the worksheets. Return JSON with real data, not placeholders.`
            },            
            {
              role: 'user',
              content: message
            }
          ],
          temperature: 0.3,
          max_tokens: 4000
        });
        
        const excelDataStr = excelDataResponse.choices[0].message.content.trim();
        // Clean up response to get just the JSON
        let cleanedJson = excelDataStr;
        if (cleanedJson.includes('```json')) {
          cleanedJson = cleanedJson.split('```json')[1].split('```')[0];
        } else if (cleanedJson.includes('```')) {
          cleanedJson = cleanedJson.split('```')[1].split('```')[0];
        }
        
        const excelStructure = JSON.parse(cleanedJson.trim());
        
        // Create Excel file in background
        const result = await excelGenerator.generateAccountingWorkbook(message, req.user.id);
        
        // Increment usage counter on success
        if (subscription && result.success) {
          subscription.automationsUsed++;
        }
        
        // Return BOTH conversational message AND Excel data
        return res.json({
          success: true,
          type: 'excel',
          message: chatMessage, // User sees conversational response
          excelData: {
            filename: result.filename,
            filepath: result.filepath,
            summary: excelStructure.summary || 'Excel file created',
            structure: excelStructure
          }
        });
        
      } catch (error) {
        console.error('❌ Excel generation error:', error);
        // Return just conversational response if Excel fails
        return res.json({
          success: true,
          type: 'chat',
          message: chatMessage + " I'm having some trouble with the Excel creation right now, but I'll keep working on it!"
        });
      }
    }
    
    // Just conversation - no Excel needed
    res.json({ 
      success: true,
      type: 'chat', 
      message: chatMessage
    });

  } catch (error) {
    console.error('❌ Chat API error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


app.listen(PORT, () => {
  console.log(`🚀 Nubia SaaS Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`💬 Universal Chat API: /api/chat`);
  console.log(`🔐 Auth endpoints: /api/auth/login, /api/auth/register`);
});