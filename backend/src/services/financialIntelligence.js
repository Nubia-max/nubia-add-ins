require('dotenv').config();
const OpenAI = require('openai');
const { 
  extractTaggedBlock, 
  safeParseJSON, 
  validateExcelStructure,
  extractModeFromCommand,
  detectAccountingFramework 
} = require('../utils/sectionParsers');

class FinancialIntelligenceService {
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required. Please set it in your .env file.');
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async processFinancialCommand(userCommand, chatHistory = [], region = 'US') {
    console.log('🧠 Processing NUBIA command:', userCommand);
    
    // Detect mode and framework
    const mode = extractModeFromCommand(userCommand);
    const framework = detectAccountingFramework(userCommand, region);
    
    console.log(`📊 Mode: ${mode}, Framework: ${framework}`);

    const prompt = this.buildNubiaPrompt(userCommand, chatHistory, mode, framework);

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { 
            role: "system", 
            content: this.getNubiaSystemPrompt(mode, framework)
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 4000
      });

      const raw = response.choices[0].message.content || '';
      console.log('🎯 NUBIA Response received');

      // Extract sections using enhanced parser
      const chatResponse = extractTaggedBlock(raw, 'CHAT_RESPONSE') || 'Professional workbook created successfully.';
      const excelDataBlock = extractTaggedBlock(raw, 'EXCEL_DATA');
      const structure = safeParseJSON(excelDataBlock);

      // Validate structure
      const validation = validateExcelStructure(structure);
      if (!validation.valid) {
        console.error('Structure validation failed:', validation.error);
        console.error('Raw response (truncated):', raw.slice(0, 1200));
        throw new Error(`Invalid Excel structure: ${validation.error}`);
      }

      // Surface usage for quotas/limits
      const usage = response.usage || {};

      return {
        success: true,
        chatResponse,
        structure,
        tokensUsed: usage.total_tokens || 0,
        model: response.model,
        usage,
        mode,
        framework
      };

    } catch (error) {
      console.error('❌ NUBIA Intelligence Error:', error);
      
      if (error.message.includes('API')) {
        throw new Error('OpenAI API error. Please check your API key and try again.');
      }
      throw error;
    }
  }

  getNubiaSystemPrompt(mode, framework) {
    const modeSpecifics = this.getModeSpecifics(mode);
    const frameworkDetails = this.getFrameworkDetails(framework);
    
    return `You are NUBIA — a multi-credential accountant with CPA/CA/ACCA/CMA/CIA/CFE/CFA certifications and mastery of all major accounting frameworks.

CURRENT MODE: ${mode}
FRAMEWORK: ${framework}

${modeSpecifics}

${frameworkDetails}

CRITICAL RESPONSE FORMAT - You MUST respond with exactly these two blocks:

[CHAT_RESPONSE]
Write a warm, professional response (2-3 sentences) explaining what you've created. Mention key insights but NO technical details or JSON.
[/CHAT_RESPONSE]

[EXCEL_DATA]
{
  "worksheets": [
    {
      "name": "Worksheet Name",
      "data": [populated array of objects with actual data],
      "formatting": {formatting specifications}
    }
  ],
  "commands": [
    {
      "type": "formula",
      "cell": "C10",
      "formula": "=SUM(C2:C9)",
      "description": "Total calculation"
    }
  ]
}
[/EXCEL_DATA]

EXCEL QUALITY STANDARDS:
- RELEVANCE: Include predictive ratios, trends, forecasts
- FAITHFUL REPRESENTATION: Complete accounts, validated formulas, unbiased presentation
- COMPARABILITY: Period-over-period columns, YoY changes, benchmarks
- VERIFIABILITY: Reference numbers, audit trails, clear documentation
- TIMELINESS: Current dates, real-time calculations
- UNDERSTANDABILITY: Clear labels, executive summaries, logical flow

PROFESSIONAL FORMATTING COMMANDS:
- Headers: {"type": "format", "range": "A1:Z1", "style": {"fill": "2E5090", "font": {"bold": true, "color": "FFFFFF"}}}
- Subtotals: {"type": "format", "range": "A10:Z10", "style": {"fill": "F2F2F2", "font": {"bold": true}}}
- Negative amounts: {"type": "format", "format": "currency_negative"}
- All formulas wrapped in IFERROR for robustness

DATA REQUIREMENTS:
- Use realistic, current-year data
- Include actual amounts, dates, descriptions
- Ensure debits = credits in accounting entries
- Create interconnected sheets that reference each other
- Include running balances and automatic calculations

NEVER include JSON, formulas, or technical content in [CHAT_RESPONSE]. Keep it conversational and executive-friendly.`;
  }

  getModeSpecifics(mode) {
    const specs = {
      'BOOKKEEPER': `
BOOKKEEPING MODE - Create transaction-focused workbooks:
Required Sheets: General Journal, Cash Book, Accounts Receivable, Accounts Payable, Bank Reconciliation
Focus: Daily transactions, posting references, running balances
Include: Transaction validation, duplicate detection, period-end procedures`,

      'MGMT_COST': `
MANAGEMENT/COST MODE - Create decision-support analytics:
Required Sheets: Cost Centers, Budget vs Actual, Variance Analysis, Break-even Analysis
Focus: Cost behavior, profitability analysis, performance measurement
Include: Flexible budgets, cost drivers, contribution margins, segment reporting`,

      'FIN_REPORT': `
FINANCIAL REPORTING MODE - Create compliance-ready statements:
Required Sheets: Income Statement, Balance Sheet, Statement of Cash Flows, Notes
Focus: GAAP/IFRS compliance, presentation standards, disclosure requirements
Include: Comparative periods, footnote references, audit trail documentation`,

      'FIN_ANALYST': `
FINANCIAL ANALYSIS MODE - Create performance analytics:
Required Sheets: Ratio Analysis, Trend Analysis, Peer Comparison, KPI Dashboard
Focus: Financial health, profitability, efficiency, leverage analysis
Include: Industry benchmarks, historical trends, predictive metrics`,

      'TAX': `
TAX MODE - Create tax compliance workbooks:
Required Sheets: Tax Calculations, Deductions, Credits, Planning Scenarios
Focus: Tax optimization, compliance, documentation
Include: Form preparation support, tax planning strategies, compliance checklists`,

      'AUDIT': `
AUDIT MODE - Create audit support workbooks:
Required Sheets: Audit Trail, Control Testing, Risk Assessment, Findings Summary
Focus: Internal controls, compliance testing, risk evaluation
Include: Sample selections, test procedures, documentation standards`,

      'FORENSIC': `
FORENSIC MODE - Create investigation workbooks:
Required Sheets: Transaction Analysis, Red Flags, Timeline, Evidence Summary
Focus: Fraud detection, anomaly identification, investigation support
Include: Pattern analysis, exception reporting, documentation preservation`
    };

    return specs[mode] || specs['FIN_REPORT'];
  }

  getFrameworkDetails(framework) {
    const details = {
      'US_GAAP': `
US GAAP REQUIREMENTS:
- Revenue Recognition: ASC 606 five-step model
- Lease Accounting: ASC 842 right-of-use assets
- Financial Instruments: ASC 326 expected credit losses
- Presentation: SEC requirements, MD&A considerations
- Currency: USD, standard US chart of accounts`,

      'IFRS': `
IFRS REQUIREMENTS:
- Revenue Recognition: IFRS 15 five-step model
- Lease Accounting: IFRS 16 right-of-use model
- Financial Instruments: IFRS 9 expected credit loss model
- Presentation: IAS 1 presentation standards
- Currency: Local currency with USD equivalent where relevant`,

      'IPSAS': `
IPSAS REQUIREMENTS (Government/Public Sector):
- Revenue Recognition: IPSAS 23 non-exchange revenue
- Assets: IPSAS 17 property, plant & equipment
- Budget Integration: Budget vs actual reporting
- Fund Accounting: General fund, special revenue funds
- Presentation: Government financial reporting standards`,

      'UK_GAAP': `
UK GAAP (FRS 102) REQUIREMENTS:
- Small/Medium Entity Standards: FRS 102 provisions
- Revenue Recognition: Performance obligation model
- Presentation: Companies Act 2006 formats
- Currency: GBP, UK chart of accounts structure`,

      'J_GAAP': `
JAPANESE GAAP REQUIREMENTS:
- Revenue Recognition: JICPA standards
- Asset Valuation: Historical cost emphasis
- Presentation: Japanese reporting formats
- Currency: JPY, Japanese business practices`
    };

    return details[framework] || details['US_GAAP'];
  }

  buildNubiaPrompt(userCommand, chatHistory, mode, framework) {
    const historyContext = chatHistory.length > 0 
      ? `Previous context: ${JSON.stringify(chatHistory.slice(-3))}\n\n`
      : '';

    return `${historyContext}PROFESSIONAL ACCOUNTING REQUEST: "${userCommand}"

MODE: ${mode}
FRAMEWORK: ${framework}

Create a WORLD-CLASS Excel workbook that would impress Big 4 partners. Think like you're preparing board-ready deliverables for a Fortune 500 CFO.

The workbook should be:
✅ Immediately actionable for executive decisions
✅ Audit-ready with complete documentation
✅ Visually stunning with professional formatting
✅ Functionally sophisticated with advanced formulas
✅ Error-proof with validation and protection
✅ Compliant with ${framework} standards

SPECIFIC REQUIREMENTS:
1. Create comprehensive, interconnected worksheets
2. Use realistic data that tells a complete business story
3. Include advanced Excel features (XLOOKUP, SUMIFS, dynamic arrays)
4. Apply professional formatting throughout
5. Add data validation and cell protection
6. Include executive summary and key insights
7. Ensure all calculations are formula-driven and auditable

Populate with current-year data, meaningful descriptions, and industry-appropriate amounts. Make it look like it came from a Big 4 accounting firm.

Remember: [CHAT_RESPONSE] is conversational, [EXCEL_DATA] is technical JSON.`;
  }

  // Enhanced context-aware processing with NUBIA intelligence
  async processWithContext(userCommand, userId, previousCommands = [], region = 'US') {
    const chatHistory = previousCommands.map(cmd => ({
      command: cmd.command,
      timestamp: cmd.timestamp,
      success: cmd.success
    }));

    // Analyze user patterns for intelligent mode detection
    const userContext = this.analyzeUserPatterns(previousCommands);
    const enhancedCommand = this.enhanceCommandWithContext(userCommand, userContext);
    
    return this.processFinancialCommand(enhancedCommand, chatHistory, region);
  }

  analyzeUserPatterns(previousCommands) {
    const industries = {
      manufacturing: ['widget', 'factory', 'production', 'inventory', 'raw materials'],
      retail: ['sales', 'store', 'customers', 'merchandise', 'pos'],
      restaurant: ['restaurant', 'food', 'dining', 'menu', 'tips', 'covers'],
      consulting: ['client', 'project', 'billable', 'utilization', 'engagement'],
      real_estate: ['property', 'rent', 'lease', 'tenant', 'cap rate'],
      crypto: ['bitcoin', 'crypto', 'trading', 'defi', 'wallet'],
      government: ['government', 'public', 'municipality', 'taxpayer', 'citizen']
    };

    let detectedIndustry = 'general';
    let complexityScore = 0;
    let preferredMode = 'FIN_REPORT';

    previousCommands.forEach(cmd => {
      const command = cmd.command.toLowerCase();
      
      // Detect industry
      Object.entries(industries).forEach(([industry, keywords]) => {
        if (keywords.some(keyword => command.includes(keyword))) {
          detectedIndustry = industry;
        }
      });

      // Analyze complexity and preferred mode
      if (command.includes('formula') || command.includes('complex')) complexityScore += 2;
      if (command.includes('analysis') || command.includes('dashboard')) complexityScore += 1;
      if (command.includes('journal') || command.includes('ledger')) preferredMode = 'BOOKKEEPER';
      if (command.includes('budget') || command.includes('cost')) preferredMode = 'MGMT_COST';
      if (command.includes('ratio') || command.includes('performance')) preferredMode = 'FIN_ANALYST';
    });

    return {
      industry: detectedIndustry,
      complexity: complexityScore > 3 ? 'high' : complexityScore > 1 ? 'medium' : 'basic',
      preferredMode,
      commandCount: previousCommands.length
    };
  }

  enhanceCommandWithContext(userCommand, context) {
    if (context.industry === 'manufacturing') {
      return `${userCommand}

MANUFACTURING CONTEXT: Include cost accounting elements like raw materials, work-in-progress, finished goods inventory. Add manufacturing overhead allocation, labor efficiency metrics, and production variance analysis.`;
    }

    if (context.industry === 'restaurant') {
      return `${userCommand}

RESTAURANT CONTEXT: Include prime cost analysis (food + labor), covers and average check calculations, tip reconciliation, inventory turnover by category, and weekly/monthly P&L comparison.`;
    }

    if (context.industry === 'government') {
      return `${userCommand}

GOVERNMENT CONTEXT: Use fund accounting principles, include budget vs actual with encumbrances, create commitment control schedules, and ensure IPSAS compliance for financial reporting.`;
    }

    return userCommand;
  }
}

module.exports = FinancialIntelligenceService;

/*
TODO for TypeScript controllers:

1. chatController.ts - Update flow:
   async handleFinancialCommand(req, res) {
     const { command, userId, chatHistory, region = 'US' } = req.body;
     
     // Check quota before processing
     await checkPlanAllows(userId, 3500); // Estimated tokens
     
     const finService = new FinancialIntelligenceService();
     const result = await finService.processFinancialCommand(command, chatHistory, region);
     
     // Send ONLY chatResponse to frontend (never JSON)
     res.json({ 
       message: result.chatResponse,
       success: result.success,
       mode: result.mode,
       framework: result.framework
     });
     
     // Pass structure internally to Excel generator
     await excelService.generateExcel(result.structure, userId);
     
     // Record usage for billing/quotas
     await recordUsage({
       userId,
       tokens: result.tokensUsed,
       model: result.model,
       mode: result.mode,
       at: new Date().toISOString()
     });
   }

2. excelService.ts - Excel generation:
   async generateExcel(structure: any, userId: string) {
     const generator = new DynamicExcelGenerator();
     return await generator.generateWithCompleteFreedom(structure, userId);
   }

3. Import usage tracking:
   import { recordUsage, checkPlanAllows } from '../services/usageService';
*/

/* NUBIA Test Scenarios:

1. Manufacturing Request: "Create cost accounting system for automotive parts manufacturer"
   Expected Mode: MGMT_COST
   Expected Sheets: Cost Centers, WIP Tracking, Standard vs Actual Costs, Overhead Allocation
   
2. Government Request: "Set up municipal budget tracking with IPSAS compliance"
   Expected Mode: AUDIT (compliance focus)
   Expected Framework: IPSAS
   Expected Sheets: Budget Register, Fund Accounting, Commitment Control
   
3. Restaurant Request: "Build comprehensive P&L analysis for multi-location restaurant chain"
   Expected Mode: FIN_ANALYST
   Expected Sheets: Store-by-Store P&L, Prime Cost Analysis, Same-Store Sales Growth
   
4. Tax Request: "Prepare small business tax planning workbook with deduction optimization"
   Expected Mode: TAX
   Expected Sheets: Income Summary, Deduction Categories, Tax Scenarios, Form Prep
*/