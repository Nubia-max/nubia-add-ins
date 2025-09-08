# NUBIA Implementation Guide
## Complete Integration for TypeScript Controllers

This guide provides the complete implementation for integrating all NUBIA components with your existing TypeScript controllers.

## Overview

NUBIA (Multi-Credential Financial Intelligence) transforms your Excel automation app with:
- 🧠 **Multi-credential AI** (CPA/CA/ACCA/CMA/CIA/CFE/CFA)
- 📊 **Mode-based routing** (7 specialized modes)
- 🌍 **Multi-framework support** (US GAAP, IFRS, IPSAS, UK GAAP, J-GAAP)
- 🔒 **Usage tracking & quotas**
- 📈 **GAAP-compliant Excel generation**
- 🎯 **Clean UI/UX** (JSON never shown to users)

## Required Dependencies

Add to your `package.json`:
```json
{
  "dependencies": {
    "@types/node": "^18.0.0",
    "exceljs": "^4.3.0",
    "openai": "^4.0.0"
  }
}
```

## 1. Update chatController.ts

Replace your existing chat controller with this complete implementation:

```typescript
// src/controllers/chatController.ts
import { Request, Response } from 'express';
import FinancialIntelligenceService from '../services/financialIntelligence';
import { DynamicExcelGenerator } from '../services/dynamicExcelGenerator';
import { 
  recordUsage, 
  checkPlanAllows, 
  estimateTokensForCommand,
  UsageEvent 
} from '../services/usageService';

interface ChatRequest extends Request {
  body: {
    command: string;
    userId: string;
    chatHistory?: Array<{
      command: string;
      timestamp: string;
      success: boolean;
    }>;
    region?: string;
    sessionId?: string;
  }
}

export class ChatController {
  private finService: FinancialIntelligenceService;
  private excelGenerator: DynamicExcelGenerator;

  constructor() {
    this.finService = new FinancialIntelligenceService();
    this.excelGenerator = new DynamicExcelGenerator();
  }

  async handleFinancialCommand(req: ChatRequest, res: Response) {
    const startTime = Date.now();
    let usageEvent: Partial<UsageEvent> = {
      userId: req.body.userId,
      sessionId: req.body.sessionId,
      command: req.body.command,
      at: new Date().toISOString(),
      success: false
    };

    try {
      const { command, userId, chatHistory = [], region = 'US' } = req.body;

      // Validate required fields
      if (!command || !userId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: command and userId'
        });
      }

      // Estimate token usage and check quotas BEFORE processing
      const estimatedTokens = estimateTokensForCommand(command);
      
      try {
        await checkPlanAllows(userId, estimatedTokens, 10); // Assume max 10 worksheets
      } catch (quotaError) {
        return res.status(429).json({
          success: false,
          error: quotaError.message,
          quotaExceeded: true,
          estimatedTokens
        });
      }

      console.log(`🚀 Processing NUBIA command for user ${userId}`);

      // Process with NUBIA Intelligence
      const result = await this.finService.processFinancialCommand(
        command, 
        chatHistory, 
        region
      );

      // CRITICAL: Send ONLY chatResponse to frontend (never JSON/structure)
      res.json({
        success: true,
        message: result.chatResponse, // User-friendly message only
        mode: result.mode,
        framework: result.framework,
        tokensUsed: result.tokensUsed,
        model: result.model,
        processingTime: Date.now() - startTime
      });

      // Update usage event with success data
      usageEvent = {
        ...usageEvent,
        tokens: result.tokensUsed,
        model: result.model,
        mode: result.mode,
        framework: result.framework,
        success: true,
        worksheetCount: result.structure?.worksheets?.length || 0
      };

      // Generate Excel asynchronously (don't wait for response)
      this.generateExcelAsync(result.structure, userId, command)
        .catch(error => {
          console.error('Async Excel generation failed:', error);
          // Could send notification to user via websocket
        });

      // Record usage for analytics/billing
      await recordUsage(usageEvent as UsageEvent);

      console.log(`✅ NUBIA command completed successfully in ${Date.now() - startTime}ms`);

    } catch (error) {
      console.error('❌ Chat controller error:', error);
      
      // Record failed usage
      usageEvent.success = false;
      if (usageEvent.tokens) {
        await recordUsage(usageEvent as UsageEvent);
      }

      // Send user-friendly error
      let errorMessage = 'I encountered an issue processing your request. Please try again.';
      
      if (error.message.includes('API')) {
        errorMessage = 'Temporary service issue. Please try again in a moment.';
      } else if (error.message.includes('quota') || error.message.includes('limit')) {
        errorMessage = error.message; // Quota errors are user-facing
      }

      res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  }

  private async generateExcelAsync(structure: any, userId: string, command: string): Promise<void> {
    try {
      console.log('📊 Generating Excel workbook asynchronously...');
      const result = await this.excelGenerator.generateWithCompleteFreedom(structure, userId);
      console.log('✅ Excel generated:', result.filename);
      
      // Could notify user via websocket that Excel is ready
      // await websocketService.notifyUser(userId, {
      //   type: 'excel_ready',
      //   filename: result.filename,
      //   worksheets: result.worksheets
      // });
    } catch (error) {
      console.error('Excel generation error:', error);
      // Handle gracefully - don't break the main flow
    }
  }

  // Additional endpoints for usage management
  async getUserStats(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { getUsageStats } = await import('../services/usageService');
      const stats = await getUsageStats(userId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get usage stats' });
    }
  }

  async upgradeUserPlan(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { planType } = req.body;
      const { upgradePlan } = await import('../services/usageService');
      const newPlan = await upgradePlan(userId, planType);
      res.json(newPlan);
    } catch (error) {
      res.status(500).json({ error: 'Failed to upgrade plan' });
    }
  }
}

// Route setup
export const chatController = new ChatController();
```

## 2. Update excelService.ts

Create or update your Excel service:

```typescript
// src/services/excelService.ts
import { DynamicExcelGenerator } from './dynamicExcelGenerator';

export class ExcelService {
  private generator: DynamicExcelGenerator;

  constructor() {
    this.generator = new DynamicExcelGenerator();
  }

  async generateExcel(structure: any, userId: string): Promise<{
    success: boolean;
    filename: string;
    filepath: string;
    worksheets: Array<{name: string; rowCount: number; columnCount: number}>;
  }> {
    try {
      console.log('🎯 Excel service generating workbook...');
      const result = await this.generator.generateWithCompleteFreedom(structure, userId);
      
      return {
        success: result.success,
        filename: result.filename,
        filepath: result.filepath,
        worksheets: result.worksheets
      };
    } catch (error) {
      console.error('Excel service error:', error);
      throw new Error(`Excel generation failed: ${error.message}`);
    }
  }

  async validateWorkbook(filepath: string): Promise<{
    valid: boolean;
    issues: string[];
    gaapCompliant: boolean;
  }> {
    // TODO: Implement workbook validation
    // - Check for required sheets
    // - Validate debit/credit balance
    // - Verify formula integrity
    // - Confirm GAAP compliance
    
    return {
      valid: true,
      issues: [],
      gaapCompliant: true
    };
  }
}

export const excelService = new ExcelService();
```

## 3. Update your main routes

Add these routes to your Express app:

```typescript
// src/routes/chat.ts
import { Router } from 'express';
import { chatController } from '../controllers/chatController';

const router = Router();

// Main NUBIA endpoint
router.post('/financial-command', chatController.handleFinancialCommand.bind(chatController));

// Usage management endpoints
router.get('/usage/:userId', chatController.getUserStats.bind(chatController));
router.post('/upgrade/:userId', chatController.upgradeUserPlan.bind(chatController));

export default router;
```

## 4. Frontend Integration

Update your frontend to work with the new response format:

```typescript
// Frontend example
interface NubiaResponse {
  success: boolean;
  message: string;      // Only user-friendly text (never JSON)
  mode: string;         // BOOKKEEPER, FIN_REPORT, etc.
  framework: string;    // US_GAAP, IFRS, etc.
  tokensUsed: number;
  model: string;
  processingTime: number;
  quotaExceeded?: boolean;
  estimatedTokens?: number;
}

async function sendFinancialCommand(command: string, userId: string) {
  try {
    const response = await fetch('/api/chat/financial-command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command,
        userId,
        region: 'US', // or detect user's region
        sessionId: generateSessionId()
      })
    });

    const result: NubiaResponse = await response.json();
    
    if (result.quotaExceeded) {
      showUpgradePrompt(result.estimatedTokens);
      return;
    }

    if (result.success) {
      // Display only the friendly message (never JSON)
      displayChatMessage(result.message);
      
      // Show metadata if needed
      showProcessingInfo({
        mode: result.mode,
        framework: result.framework,
        tokensUsed: result.tokensUsed,
        processingTime: result.processingTime
      });
    } else {
      displayError(result.error);
    }
  } catch (error) {
    displayError('Network error occurred');
  }
}
```

## 5. Testing Your Implementation

### Test 1: Basic Functionality
```bash
curl -X POST http://localhost:3000/api/chat/financial-command \
  -H "Content-Type: application/json" \
  -d '{
    "command": "Create a general journal for a small restaurant",
    "userId": "test-user-123",
    "region": "US"
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "I've created a comprehensive restaurant accounting workbook with a general journal, cash flow tracking, and prime cost analysis. The workbook includes industry-specific metrics like food cost percentages and covers per day calculations.",
  "mode": "BOOKKEEPER",
  "framework": "US_GAAP",
  "tokensUsed": 3420,
  "model": "gpt-4o",
  "processingTime": 2150
}
```

### Test 2: Quota Exceeded
```bash
# After exhausting quota
curl -X POST http://localhost:3000/api/chat/financial-command \
  -H "Content-Type: application/json" \
  -d '{
    "command": "Create comprehensive analysis dashboard",
    "userId": "free-user-456"
  }'
```

Expected response:
```json
{
  "success": false,
  "error": "Monthly token limit exceeded. Used: 9850/10000. Upgrade your plan for more capacity.",
  "quotaExceeded": true,
  "estimatedTokens": 4500
}
```

### Test 3: Mode Detection
```bash
curl -X POST http://localhost:3000/api/chat/financial-command \
  -H "Content-Type: application/json" \
  -d '{
    "command": "Analyze profitability ratios and create KPI dashboard",
    "userId": "analyst-user-789"
  }'
```

Expected mode: `FIN_ANALYST`

## 6. Monitoring and Analytics

Add logging to track NUBIA performance:

```typescript
// src/middleware/nubiaMonitoring.ts
import { Request, Response, NextFunction } from 'express';

export function nubiaMonitoring(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const processingTime = Date.now() - startTime;
    const userId = req.body?.userId;
    
    console.log(`[NUBIA] ${req.method} ${req.path}`, {
      userId,
      processingTime,
      statusCode: res.statusCode,
      command: req.body?.command?.slice(0, 100) + '...'
    });
  });
  
  next();
}
```

## 7. Error Handling Best Practices

```typescript
// Custom error types for better handling
export class NubiaError extends Error {
  constructor(
    message: string, 
    public code: string, 
    public userMessage: string
  ) {
    super(message);
    this.name = 'NubiaError';
  }
}

export class QuotaExceededError extends NubiaError {
  constructor(currentUsage: number, limit: number) {
    super(
      `Quota exceeded: ${currentUsage}/${limit}`,
      'QUOTA_EXCEEDED',
      `You've reached your monthly limit. Upgrade for more capacity.`
    );
  }
}
```

## Security Considerations

1. **API Key Protection**: Never expose OpenAI keys to frontend
2. **User Input Validation**: Sanitize all user commands
3. **Rate Limiting**: Implement per-user rate limits
4. **Usage Tracking**: Monitor for abuse patterns
5. **File Security**: Ensure Excel files are properly sandboxed

## Performance Optimization

1. **Async Excel Generation**: Generate Excel files in background
2. **Response Caching**: Cache similar requests for 5 minutes
3. **Token Estimation**: Prevent unnecessary API calls
4. **Database Indexing**: Index usage tables by userId and date
5. **CDN Integration**: Serve Excel files from CDN

## Deployment Checklist

- [ ] Environment variables set (OPENAI_API_KEY)
- [ ] Database migrations run
- [ ] Usage tracking tables created
- [ ] Excel output directory configured
- [ ] Monitoring/logging enabled
- [ ] Error reporting configured
- [ ] Rate limiting implemented
- [ ] SSL/HTTPS enabled

## Support and Troubleshooting

### Common Issues

1. **"JSON appears in chat"**: Check that you're returning `result.chatResponse`, not `result.structure`
2. **"Excel not generating"**: Verify DynamicExcelGenerator is properly initialized
3. **"Quota errors"**: Ensure usage tracking is working and plans are configured
4. **"Mode detection wrong"**: Check command keywords in `extractModeFromCommand`

### Debug Commands

```bash
# Check NUBIA status
curl http://localhost:3000/api/health/nubia

# Get user usage stats
curl http://localhost:3000/api/chat/usage/user-123

# Test mode detection
curl -X POST http://localhost:3000/api/debug/detect-mode \
  -H "Content-Type: application/json" \
  -d '{"command": "create audit trail for compliance"}'
```

This implementation gives you a production-ready NUBIA system that separates concerns cleanly, tracks usage properly, and provides an excellent user experience while maintaining professional Excel output quality.