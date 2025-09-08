require('dotenv').config();
const OpenAI = require('openai');

class FinancialIntelligenceService {
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required. Please set it in your .env file.');
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async processFinancialCommand(userCommand, chatHistory = []) {
    console.log('🧠 Processing command with complete GPT freedom:', userCommand);
    
    const prompt = `
You have COMPLETE FREEDOM to design the optimal Excel structure for: "${userCommand}"

Previous context: ${JSON.stringify(chatHistory.slice(-3))}

Think like a CFO preparing board-ready financials. Every workbook should be:
- Immediately understandable by executives
- Audit-ready with clear documentation
- Visually professional (subtle colors, consistent formatting)
- Functionally rich (formulas, validations, protections)
- GAAP/IFRS compliant with proper classifications
- Error-resistant (IFERROR, data validation, cell protection)

Create whatever sheets, analyses, and visualizations would provide maximum business insight. Anticipate questions like:
- What's our cash runway?
- Where are the cost overruns?
- What are our key performance indicators?
- How does this period compare to last?
- What accounts need attention?

CRITICAL: You must use this EXACT response format:

[CHAT_RESPONSE]
Your friendly, conversational response here. Be warm and professional. Mention key insights from the data if relevant.
[/CHAT_RESPONSE]

[EXCEL_DATA]
{
  "worksheets": [
    {
      "name": "General Journal",
      "data": [...],
      "formatting": {...},
      "formulas": {...}
    },
    // Create AS MANY sheets as needed for professional accounting
  ],
  "commands": [
    // Professional Excel commands for formulas, formatting, validation, etc.
  ]
}
[/EXCEL_DATA]

For the EXCEL_DATA section, create WORLD-CLASS accounting workbooks:

Fundamental Sheets (as applicable):
- General Journal with auto-posting references
- T-Accounts/Ledgers with running balances
- Cash Book with bank reconciliation
- Trial Balance with auto-balancing check
- Income Statement (multi-step format)
- Balance Sheet (classified format)
- Cash Flow Statement (direct & indirect)
- Statement of Changes in Equity

Enhancing Analytics:
- Ratio Analysis Dashboard (liquidity, profitability, efficiency, leverage)
- Trend Analysis with sparklines
- Variance Analysis (budget vs actual)
- Break-even Analysis
- Aging Reports (AR/AP)
- KPI Dashboard with conditional formatting

Professional Features to Include:
- XLOOKUP/INDEX-MATCH for account lookups
- SUMIFS for multi-criteria totals
- Dynamic arrays for flexible reporting
- Data validation dropdowns for accounts
- Conditional formatting for exceptions
- IFERROR wrapping for robust formulas
- Cell protection for formula integrity
- Print-ready formatting

Formatting Standards:
- Headers: #1F4788 background, white bold text
- Subtotals: #F2F2F2 background
- Grand totals: #D9D9D9 background, bold
- Negative numbers: Red, in parentheses
- Currency: Accounting format
- Dates: MM/DD/YYYY
- Percentages: One decimal (0.0%)

POPULATE with REALISTIC data that tells a complete story:
- Current year dates
- Industry-appropriate amounts
- Meaningful transaction descriptions
- Proper account classifications
- Connected transactions across sheets
- Calculated fields and automatic totals

For the CHAT_RESPONSE section:
- Be warm and professional
- Highlight 2-3 key insights from the data
- Suggest next steps or areas to watch
- Keep technical jargon minimal unless requested

Think like a Big 4 senior accountant preparing client deliverables. Create the workbook you'd be proud to present to a Fortune 500 CFO.

REMEMBER: You have COMPLETE FREEDOM to create the optimal structure. Be comprehensive, professional, and insightful.
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { 
            role: "system", 
            content: `You are a world-class CPA and CFO with expertise from Big 4 accounting firms.

Your credentials:
- CPA with 15+ years experience
- Expert in GAAP/IFRS standards
- Specialist in financial modeling and analysis
- Advanced Excel automation expert
- Industry experience across multiple sectors

Your mission:
Create BOARD-READY financial workbooks that are:
1. Immediately actionable for C-suite decisions
2. Fully compliant with accounting standards
3. Visually stunning yet professional
4. Functionally sophisticated with advanced formulas
5. Error-proof with validation and protection

Quality Standards:
- RELEVANCE: Include predictive value (forecasts, trends) and confirmatory value (variances, reconciliations)
- FAITHFUL REPRESENTATION: Complete (all necessary accounts), Neutral (unbiased), Error-free (validated formulas)
- COMPARABILITY: Period-over-period columns, industry benchmarks
- VERIFIABILITY: Clear audit trails, reference numbers
- TIMELINESS: Current dates, automatic timestamps
- UNDERSTANDABILITY: Clear labels, logical flow, executive summaries

Always respond with the [CHAT_RESPONSE] and [EXCEL_DATA] format. Create comprehensive, multi-sheet workbooks with populated data.`
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.8, // Higher creativity for richer financial insights
        max_tokens: 4000
      });

      const gptResponse = response.choices[0].message.content;
      console.log('🎯 GPT Response received');

      // Parse and validate the JSON response
      let structure;
      try {
        // Handle GPT responses that might be wrapped in markdown code blocks
        let cleanedResponse = gptResponse.trim();
        if (cleanedResponse.startsWith('```json')) {
          cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedResponse.startsWith('```')) {
          cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        structure = JSON.parse(cleanedResponse);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        console.error('Original GPT response:', gptResponse);
        throw new Error('GPT returned invalid JSON. Please try again.');
      }

      // Validate structure - NO FALLBACK
      if (!structure.worksheets || !Array.isArray(structure.worksheets)) {
        throw new Error('GPT did not return a valid Excel structure with worksheets.');
      }

      return {
        success: true,
        structure,
        tokensUsed: response.usage.total_tokens,
        model: response.model
      };

    } catch (error) {
      console.error('❌ Financial Intelligence Error:', error);
      
      // NO FALLBACK - just throw the error
      if (error.message.includes('API')) {
        throw new Error('OpenAI API error. Please check your API key and try again.');
      }
      throw error;
    }
  }

  // Enhanced context-aware processing with professional standards
  async processWithContext(userCommand, userId, previousCommands = []) {
    const chatHistory = previousCommands.map(cmd => ({
      command: cmd.command,
      timestamp: cmd.timestamp,
      success: cmd.success
    }));

    // Analyze user patterns to provide better context
    const userContext = this.analyzeUserPatterns(previousCommands);
    
    const enhancedPrompt = `
User: ${userId}
Current request: "${userCommand}"
User's typical industry/focus: ${userContext.industry}
Previous document types: ${userContext.documentTypes.join(', ')}
Complexity preference: ${userContext.complexity}

${userContext.industry !== 'unknown' ? `
Industry-Specific Requirements for ${userContext.industry}:
${this.getIndustrySpecificRequirements(userContext.industry)}
` : ''}

Professional Standards to Apply:
- Financial Statement Presentation (ASC 205, IAS 1)
- Revenue Recognition (ASC 606, IFRS 15)
- Lease Accounting (ASC 842, IFRS 16)
- Segment Reporting (ASC 280, IFRS 8)

Create WORLD-CLASS financial documents optimized for this specific user, including:
1. Industry-specific KPIs and metrics
2. Regulatory compliance checks
3. Benchmark comparisons
4. Predictive analytics where applicable
5. Executive dashboard with key insights
    `;

    return this.processFinancialCommand(enhancedPrompt, chatHistory);
  }

  getIndustrySpecificRequirements(industry) {
    const requirements = {
      restaurant: `
- Food cost percentage analysis
- Labor cost tracking with overtime
- Table turnover metrics
- Daily sales reports with weather correlation
- Tip reconciliation and reporting
- Menu item profitability matrix
- Waste tracking and variance analysis`,
      retail: `
- Inventory turnover ratios
- Same-store sales growth
- SKU performance analysis
- Seasonal trend analysis
- Shrinkage and loss prevention metrics
- Customer acquisition cost
- Gross margin return on investment (GMROI)`,
      crypto: `
- Realized vs unrealized gains
- Cost basis tracking (FIFO/LIFO/HIFO)
- Staking rewards classification
- DeFi yield tracking
- Tax lot optimization
- Portfolio diversification metrics
- Risk-adjusted returns (Sharpe ratio)`,
      consulting: `
- Utilization rates by consultant
- Project profitability analysis
- Pipeline and backlog reporting
- Realization rates
- Client concentration risk
- Billable vs non-billable analysis
- Work in progress (WIP) aging`,
      real_estate: `
- Cap rate analysis
- Net operating income (NOI)
- Debt service coverage ratio (DSCR)
- Occupancy and vacancy rates
- Rent roll analysis
- CAM reconciliation
- Property-level P&L with same-store comparisons`
    };
    return requirements[industry] || 'Standard GAAP/IFRS compliance';
  }

  analyzeUserPatterns(previousCommands) {
    const industries = {
      restaurant: ['restaurant', 'food', 'dining', 'menu', 'tips'],
      retail: ['sales', 'inventory', 'products', 'customers', 'store'],
      crypto: ['bitcoin', 'crypto', 'cryptocurrency', 'trading', 'wallet'],
      consulting: ['client', 'project', 'consulting', 'billable', 'time'],
      real_estate: ['property', 'real estate', 'rent', 'lease', 'tenant']
    };

    let detectedIndustry = 'unknown';
    let documentTypes = [];
    let complexityScore = 0;

    previousCommands.forEach(cmd => {
      const command = cmd.command.toLowerCase();
      
      // Detect industry
      Object.entries(industries).forEach(([industry, keywords]) => {
        if (keywords.some(keyword => command.includes(keyword))) {
          detectedIndustry = industry;
        }
      });

      // Analyze complexity
      if (command.includes('formula') || command.includes('calculate')) complexityScore++;
      if (command.includes('chart') || command.includes('graph')) complexityScore++;
      if (command.includes('multiple') || command.includes('several')) complexityScore++;
    });

    return {
      industry: detectedIndustry,
      documentTypes,
      complexity: complexityScore > 2 ? 'high' : complexityScore > 0 ? 'medium' : 'simple'
    };
  }

  // Intelligent command enhancement with professional standards
  enhanceCommand(userCommand) {
    const enhancements = {
      restaurant: {
        keywords: ['restaurant', 'food', 'dining', 'cafe', 'bar'],
        additions: `Create comprehensive restaurant accounting package:
        - Daily cash reconciliation with POS integration
        - Prime cost analysis (food + labor)
        - Menu engineering matrix (stars, puzzles, plowhorses, dogs)
        - Theoretical vs actual food cost variance
        - Server productivity and tip reporting
        - Break-even analysis with covers needed
        - 13-period P&L for year-over-year comparison`
      },
      sales: {
        keywords: ['sales', 'revenue', 'income', 'invoice'],
        additions: `Generate professional sales analytics:
        - Sales pipeline with probability weighting
        - Customer lifetime value (CLV) analysis
        - Sales velocity and conversion metrics
        - Territory performance mapping
        - Commission calculations with tier breaks
        - Revenue recognition waterfall
        - Deferred revenue scheduling`
      },
      expenses: {
        keywords: ['expense', 'cost', 'spending', 'budget'],
        additions: `Build comprehensive expense management system:
        - Expense categorization per GAAP
        - Budget vs actual with variance analysis
        - Trend analysis with anomaly detection
        - Vendor spend analysis with concentration risk
        - Approval workflow tracking
        - Tax deduction optimization
        - Zero-based budgeting templates`
      },
      crypto: {
        keywords: ['bitcoin', 'crypto', 'trading', 'defi', 'nft'],
        additions: `Create institutional-grade crypto accounting:
        - Multi-wallet consolidation
        - Tax lot tracking with optimization
        - DeFi position tracking and yield analysis
        - Impermanent loss calculations
        - Mining/staking income classification
        - Mark-to-market valuations
        - Form 8949 preparation format`
      },
      payroll: {
        keywords: ['payroll', 'salary', 'wages', 'employee'],
        additions: `Design complete payroll management suite:
        - Gross-to-net calculations
        - Tax withholding schedules
        - Benefit deduction tracking
        - Overtime and shift differential
        - Accrued PTO liability
        - Workers comp allocation
        - 941/940 quarterly reporting format`
      },
      inventory: {
        keywords: ['inventory', 'stock', 'warehouse', 'product'],
        additions: `Implement inventory control system:
        - Perpetual inventory tracking
        - FIFO/LIFO/Average cost layers
        - Reorder point optimization
        - ABC analysis for SKU prioritization
        - Shrinkage and cycle count variance
        - Inventory turnover by category
        - Obsolescence reserve calculation`
      }
    };

    let enhanced = userCommand;
    Object.entries(enhancements).forEach(([type, config]) => {
      if (config.keywords.some(keyword => userCommand.toLowerCase().includes(keyword))) {
        enhanced += `\n\nPROFESSIONAL ENHANCEMENT:\n${config.additions}`;
      }
    });

    // Add universal enhancements
    enhanced += `\n\nUNIVERSAL FEATURES TO INCLUDE:
    - Automated three-way matching
    - Exception reporting with thresholds
    - Audit trail with user tracking
    - Multi-period comparative analysis
    - Drill-down capability references
    - Executive summary dashboard
    - Export-ready for tax software`;

    return enhanced;
  }
}

module.exports = FinancialIntelligenceService;