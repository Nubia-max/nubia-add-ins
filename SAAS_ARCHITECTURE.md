# Nubia SaaS Architecture

## ✅ Complete SaaS Implementation

Nubia has been restructured as a proper SaaS platform where **ALL AI processing happens through our backend servers**. Users never see or need OpenAI API keys.

## 🏗️ Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│                 │     │                  │     │                 │
│  Desktop App    │────▶│  Nubia Backend   │────▶│   OpenAI API    │
│  (Electron)     │◀────│  (Your Server)   │◀────│   (GPT-4)       │
│                 │     │                  │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
     No API Keys         YOUR API Keys            YOUR Costs
     Auth Token          Usage Tracking           Rate Limited
                        Subscription Mgmt
```

## 📁 Key Files Changed

### Backend (Node.js + TypeScript)

1. **`backend/src/services/excelService.ts`** - Core Excel processing service
   - Handles all OpenAI API calls with YOUR company key
   - Tracks usage per user
   - Enforces subscription limits
   - Records all requests for billing

2. **`backend/src/routes/excel.ts`** - API endpoints
   - `/api/excel/process-transactions` - Main Excel generation
   - `/api/excel/generate-formulas` - Formula creation
   - `/api/excel/usage-stats` - User usage statistics
   - All endpoints require authentication

3. **`backend/src/server.ts`** - Updated to include Excel routes

### Desktop App (Electron)

1. **`desktop/src/api.ts`** - Removed ALL OpenAI code
   - Now only handles authentication tokens
   - No API keys stored locally

2. **`desktop/src/excelAutomation.js`** - Updated to use backend
   - Calls YOUR backend instead of OpenAI
   - Includes authentication token in requests
   - Handles rate limiting and upgrade prompts

3. **`desktop/src/services/backendApi.ts`** - New backend API client
   - Centralized API calls to your backend
   - Automatic error handling
   - Upgrade prompt triggers

## 🔐 Security & Control

### What Users CAN'T Do:
- ❌ Use their own OpenAI keys
- ❌ Make direct API calls to OpenAI
- ❌ Bypass usage limits
- ❌ Access the service without authentication
- ❌ See your OpenAI API costs

### What You CAN Do:
- ✅ Control all AI costs centrally
- ✅ Track every API call per user
- ✅ Cut off users who don't pay
- ✅ Implement tiered pricing
- ✅ Monitor usage patterns
- ✅ Add custom logic/filters
- ✅ Cache responses to save costs

## 💰 Business Model Implementation

### Subscription Tiers (Configured in Database)
```javascript
// backend/prisma/schema.prisma
enum SubscriptionTier {
  TRIAL      // 10 automations/month
  STARTER    // 100 automations/month
  PRO        // 500 automations/month
  ENTERPRISE // Unlimited
}
```

### Usage Tracking
Every API call creates a `UsageRecord`:
- User ID
- Timestamp
- Tokens consumed
- Success/failure
- Execution time
- Command details

### Enforcement
```javascript
// Before processing any request:
if (user.automationsUsed >= user.automationsLimit) {
  throw new Error('Monthly limit exceeded. Please upgrade.');
}
```

## 🚀 API Flow

### 1. Desktop App Makes Request
```javascript
// desktop/src/excelAutomation.js
const response = await fetch('http://localhost:3001/api/excel/process-transactions', {
  headers: {
    'Authorization': `Bearer ${userToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ transactions })
});
```

### 2. Backend Validates & Processes
```javascript
// backend/src/services/excelService.ts
async processTransactions(userId, transactions) {
  // 1. Check user subscription
  const user = await checkSubscription(userId);
  
  // 2. Call OpenAI with YOUR key
  const result = await openai.chat.completions.create({...});
  
  // 3. Track usage for billing
  await recordUsage(userId, result.usage.tokens);
  
  // 4. Return processed data
  return result;
}
```

### 3. Desktop App Handles Response
```javascript
if (response.status === 429) {
  // Show upgrade prompt
  showUpgradePrompt();
} else {
  // Process Excel data
  createExcelFile(response.data);
}
```

## 🧪 Testing

Run the test script to verify the architecture:
```bash
node test-saas-flow.js
```

This tests:
- User registration
- Authentication flow
- Excel processing through backend
- Usage tracking
- Rate limiting
- Error handling

## 🔧 Environment Variables

### Backend (.env)
```bash
OPENAI_API_KEY=sk-... # YOUR company OpenAI key
JWT_SECRET=your-secret-key
DATABASE_URL=postgresql://...
BACKEND_PORT=3001
```

### Desktop App
```bash
BACKEND_URL=http://localhost:3001  # In production: https://api.nubia.ai
```

## 📊 Monitoring & Analytics

### Usage Dashboard Query
```sql
-- Monthly usage by user
SELECT 
  u.email,
  s.tier,
  s.automationsUsed,
  s.automationsLimit,
  SUM(ur.tokensUsed) as totalTokens
FROM users u
JOIN subscriptions s ON u.id = s.userId
JOIN usage_records ur ON u.id = ur.userId
WHERE ur.createdAt >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY u.email, s.tier, s.automationsUsed, s.automationsLimit;
```

## 🚨 Important Notes

1. **Never expose backend OpenAI key** - It should only exist on your servers
2. **Always authenticate requests** - Every API call needs a valid user token
3. **Track everything** - Log all usage for billing and debugging
4. **Handle limits gracefully** - Show clear upgrade prompts when limits are hit
5. **Cache when possible** - Save API costs by caching common requests

## 🎯 Next Steps

1. Deploy backend to production server
2. Configure production database
3. Set up Stripe for payment processing
4. Implement webhook for subscription updates
5. Add admin dashboard for usage monitoring
6. Set up automated billing based on usage

---

**This architecture ensures you maintain full control over AI costs and user access while providing a seamless experience for paying customers.**