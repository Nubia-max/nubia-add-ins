import OpenAI from 'openai';
import { logger } from '../utils/logger';

class LLMService {
  private openai: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required. Please set it in your .env file.');
    }
    
    this.openai = new OpenAI({
      apiKey: apiKey,
    });
  }

  async processExcelCommand(message: string, conversationHistory?: Array<{role: 'user' | 'assistant', content: string}>): Promise<{
    response: string;
    excelData?: any;
    cost: number;
  }> {
    try {
      const systemPrompt = `You are Nubia, a world-class CPA and CFO with Big 4 accounting firm expertise, providing BOARD-READY financial solutions.

YOUR CREDENTIALS:
- CPA with 15+ years senior-level experience
- Expert in GAAP/IFRS standards and SOX compliance
- Specialist in financial modeling, FP&A, and strategic analysis
- Advanced Excel automation architect
- Industry expertise: Technology, Retail, Manufacturing, Services, Real Estate

YOUR MISSION - Create Excel workbooks that are:
1. CEO/CFO presentation-ready without modification
2. Audit-compliant with complete documentation
3. Visually stunning yet professionally subtle
4. Functionally sophisticated with error-proof formulas
5. Decision-enabling with actionable insights

QUALITY STANDARDS YOU MUST MEET:

Fundamental Qualities:
- RELEVANCE: Include predictive analytics (forecasts, trends, scenarios) and confirmatory value (reconciliations, variance analysis)
- FAITHFUL REPRESENTATION: Complete (all material accounts), Neutral (unbiased presentation), Error-free (validated calculations)

Enhancing Qualities:
- COMPARABILITY: YoY/QoQ analysis, industry benchmarks, peer comparisons
- VERIFIABILITY: Clear audit trails, transaction references, supporting schedules
- TIMELINESS: Real-time data, automatic refresh capabilities, current period focus
- UNDERSTANDABILITY: Executive summaries, visual dashboards, intuitive navigation

PROFESSIONAL EXCEL STANDARDS:

Visual Excellence:
- Headers: #1F4788 background, white bold Calibri 11pt
- Subtotals: #F2F2F2 background with top border
- Grand totals: #D9D9D9 background, bold, top/bottom borders
- Negative values: Red font color, parentheses format
- Conditional formatting: Traffic lights for KPIs, data bars for comparisons
- Charts: Muted colors, clean lines, professional themes

Functional Sophistication:
- XLOOKUP/INDEX-MATCH for dynamic lookups
- SUMIFS/COUNTIFS for multi-criteria analysis
- Dynamic arrays (FILTER, SORT, UNIQUE) for flexible reporting
- IFERROR wrapping on all formulas for robustness
- Data validation dropdowns for controlled input
- Named ranges for formula clarity
- Cell protection for formula integrity
- Pivot tables with slicers for interactive analysis

WHAT YOU CREATE:

Core Financial Statements:
- General Journal with auto-posting logic
- Chart of Accounts with account mapping
- Trial Balance with auto-balancing checks
- Multi-step Income Statement with margin analysis
- Classified Balance Sheet with ratio calculations
- Direct & Indirect Cash Flow Statements
- Statement of Changes in Equity
- Notes with significant accounting policies

Management Reporting:
- Executive Dashboard with KPIs and sparklines
- Budget vs Actual with variance explanations
- Rolling forecasts with scenario modeling
- Segment reporting by product/region/customer
- Profitability analysis with contribution margins
- Working capital management metrics
- Break-even and sensitivity analysis
- CONSOLIDATED reporting for multi-entity structures

Industry-Specific Enhancements:
- Manufacturing: Cost accounting, inventory valuation, capacity utilization
- Retail: Same-store sales, inventory turnover, shrinkage analysis
- SaaS: MRR/ARR, CAC/LTV, cohort analysis, retention metrics
- Real Estate: NOI, cap rates, occupancy analysis, rent rolls
- Services: Utilization, realization, project profitability

COMPLIANCE & CONTROLS:
- SOX compliance documentation
- Internal control narratives
- Journal entry testing formats
- Account reconciliation templates
- Audit preparation schedules
- Tax provision workpapers

RESPONSE FORMAT:
Provide natural, professional explanation of what you're creating, then include comprehensive JSON structure for Excel generation. Design whatever structure best serves the user's needs - you have COMPLETE FREEDOM to create the optimal solution.

REMEMBER: Every workbook should be worthy of a Fortune 500 board presentation. Think like you're preparing materials for Warren Buffett, Jamie Dimon, or Satya Nadella.`;

      const messages: any[] = [
        { role: 'system', content: systemPrompt }
      ];

      if (conversationHistory && conversationHistory.length > 0) {
        messages.push(...conversationHistory.slice(-10));
      }

      messages.push({ role: 'user', content: message });

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        max_tokens: 4000,
        temperature: 0.85, // Optimal balance of creativity and consistency
      });
      // NOTE: Removed response_format restriction to give GPT complete freedom

      const response = completion.choices[0]?.message?.content || '';
      
      // Parse Excel structure from GPT's free-form response
      let excelData = null;
      
      // Look for JSON anywhere in the response (much more flexible)
      if (response.includes('{') && (response.includes('worksheet') || response.includes('sheet') || response.includes('column'))) {
        try {
          // Find JSON boundaries more intelligently
          const jsonStart = response.indexOf('{');
          const jsonEnd = response.lastIndexOf('}') + 1;
          
          if (jsonStart !== -1 && jsonEnd > jsonStart) {
            let jsonStr = response.substring(jsonStart, jsonEnd);
            
            // Handle markdown code blocks
            if (jsonStr.includes('```json')) {
              jsonStr = jsonStr.split('```json')[1].split('```')[0];
            } else if (jsonStr.includes('```')) {
              jsonStr = jsonStr.split('```')[1].split('```')[0];
            }
            
            excelData = JSON.parse(jsonStr.trim());
            logger.info('Successfully parsed Excel structure from GPT response');
          }
        } catch (e) {
          logger.info('No valid Excel JSON found in response, treating as chat-only');
          // Don't throw error - this allows pure conversational responses
        }
      }
      
      const inputTokens = completion.usage?.prompt_tokens || 0;
      const outputTokens = completion.usage?.completion_tokens || 0;
      const cost = (inputTokens * 0.01 / 1000) + (outputTokens * 0.03 / 1000);

      logger.info(`LLM Request processed - Cost: $${cost.toFixed(4)}`);

      return {
        response: response.trim(), // Keep full response for natural flow
        excelData,
        cost
      };
    } catch (error: any) {
      logger.error('LLM Service error:', error);
      
      if (error.message?.includes('401')) {
        throw new Error('Invalid OpenAI API key. Please check your .env file.');
      } else if (error.message?.includes('429')) {
        throw new Error('OpenAI rate limit exceeded. Please try again later.');
      } else if (error.message?.includes('insufficient_quota')) {
        throw new Error('OpenAI quota exceeded. Please check your billing.');
      }
      
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }

  async generateExcelStructure(userCommand: string): Promise<{
    structure: any;
    explanation: string;
    cost: number;
  }> {
    try {
      const systemPrompt = `You are Nubia, a world-class CPA and CFO creating INSTITUTIONAL-GRADE financial solutions.

Request to analyze: "${userCommand}"

YOUR APPROACH:

1. ANALYSIS PHASE:
   - Identify the core accounting/business need
   - Determine relevant GAAP/IFRS standards
   - Assess data complexity and volume
   - Consider industry-specific requirements
   - Plan multi-dimensional reporting structure

2. DESIGN PHASE - Create comprehensive workbook architecture:
   
   Foundation Layer:
   - Chart of Accounts with intelligent numbering
   - General Journal with validation rules
   - Subsidiary ledgers with auto-posting
   - Bank/Cash reconciliations
   
   Processing Layer:
   - Trial Balance with error checking
   - Adjusting entries workspace
   - Closing entries automation
   - Post-closing trial balance
   
   Reporting Layer:
   - Financial statements (IS, BS, CF, Equity)
   - Management reports with KPIs
   - Analytical schedules and ratios
   - Executive dashboard with charts
   
   Control Layer:
   - Reconciliation templates
   - Variance analysis
   - Exception reports
   - Audit trail documentation

3. EXCEL EXCELLENCE FEATURES:
   
   Advanced Formulas:
   - XLOOKUP for account mapping
   - SUMIFS for filtered totals
   - Dynamic arrays for flexible reports
   - LAMBDA for custom functions
   - LET for complex calculations
   
   Professional Formatting:
   - Accounting number format for amounts
   - Custom formats for variances: [Green]0.0%;[Red]-0.0%
   - Conditional formatting for exceptions
   - Icon sets for performance indicators
   - Data bars for visual comparisons
   
   Data Integrity:
   - Validation lists for account selection
   - Input masks for dates/amounts
   - Protection for formulas
   - Error checking routines
   - Cross-footing validations
   
   User Experience:
   - Navigation menu/index
   - Hyperlinks between sheets
   - Freeze panes for headers
   - Grouping for detail/summary views
   - Slicers for dynamic filtering

4. POPULATE WITH REALISTIC DATA:
   - Current fiscal year dates
   - Industry-appropriate amounts
   - Meaningful transaction descriptions
   - Proper account classifications
   - Natural business patterns (seasonality, growth)
   - Interconnected transactions
   - Calculated metrics and ratios

5. DELIVERABLE STANDARDS:
   - Board-ready presentation quality
   - Print-optimized layouts
   - Professional color scheme
   - Clear documentation
   - Version control notation
   - Confidentiality markers

Create the Excel structure that a Big 4 partner would sign off on. Include whatever sheets, analyses, and features provide maximum value.

Respond with clear explanation followed by comprehensive JSON structure. You have COMPLETE FREEDOM to design the optimal solution.`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userCommand }
        ],
        max_tokens: 4000,
        temperature: 0.85, // Optimal for professional creativity with consistency
        // REMOVED: response_format restriction for complete freedom
      });

      const response = completion.choices[0]?.message?.content || '';
      
      // Extract JSON from natural language response
      let parsed;
      try {
        // Look for JSON anywhere in the response
        const jsonStart = response.indexOf('{');
        const jsonEnd = response.lastIndexOf('}') + 1;
        
        if (jsonStart !== -1 && jsonEnd > jsonStart) {
          let jsonStr = response.substring(jsonStart, jsonEnd);
          
          // Handle markdown wrapping
          if (jsonStr.includes('```json')) {
            jsonStr = jsonStr.split('```json')[1].split('```')[0];
          } else if (jsonStr.includes('```')) {
            jsonStr = jsonStr.split('```')[1].split('```')[0];
          }
          
          parsed = JSON.parse(jsonStr.trim());
        } else {
          throw new Error('No JSON structure found in response');
        }
      } catch {
        throw new Error('Could not parse Excel structure from GPT response');
      }

      // Accept ANY structure GPT creates - no rigid validation
      if (!parsed) {
        throw new Error('GPT did not provide a structure');
      }

      const inputTokens = completion.usage?.prompt_tokens || 0;
      const outputTokens = completion.usage?.completion_tokens || 0;
      const cost = (inputTokens * 0.01 / 1000) + (outputTokens * 0.03 / 1000);

      logger.info(`Excel structure generated - Cost: $${cost.toFixed(4)}`);

      // Extract explanation from the natural language part
      const explanationText = response.substring(0, response.indexOf('{'));
      
      // Enhance the structure with professional defaults if not specified
      const enhancedStructure = this.enhanceStructureWithProfessionalDefaults(parsed);
      
      return {
        structure: enhancedStructure,
        explanation: parsed.explanation || explanationText.trim() || 'Professional-grade Excel workbook created with comprehensive financial analysis.',
        cost
      };
    } catch (error: any) {
      logger.error('Excel structure generation error:', error);
      throw error;
    }
  }

  private enhanceStructureWithProfessionalDefaults(structure: any): any {
    // Add professional formatting if not specified
    if (!structure.formatting) {
      structure.formatting = {
        headers: {
          fill: '#1F4788',
          font: { bold: true, color: '#FFFFFF', size: 11 }
        },
        subtotals: {
          fill: '#F2F2F2',
          font: { bold: true }
        },
        totals: {
          fill: '#D9D9D9',
          font: { bold: true },
          borders: { top: 'medium', bottom: 'double' }
        },
        negative: {
          font: { color: '#FF0000' },
          format: '#,##0.00_);(#,##0.00)'
        }
      };
    }
    
    // Add professional commands if not specified
    if (!structure.commands) {
      structure.commands = [];
    }
    
    // Ensure essential professional features
    const essentialCommands = [
      {
        type: 'protection',
        description: 'Protect formulas while allowing data entry',
        scope: 'all_sheets'
      },
      {
        type: 'conditional_format',
        description: 'Highlight exceptions and variances',
        rules: [
          { condition: 'negative_values', format: 'red_font' },
          { condition: 'top_10_percent', format: 'green_fill' },
          { condition: 'bottom_10_percent', format: 'red_fill' }
        ]
      },
      {
        type: 'print_setup',
        description: 'Configure professional printing',
        settings: {
          orientation: 'auto',
          margins: 'normal',
          headers: true,
          footers: true,
          fitToPage: true
        }
      }
    ];
    
    // Add essential commands if not present
    essentialCommands.forEach(cmd => {
      if (!structure.commands.find((c: any) => c.type === cmd.type)) {
        structure.commands.push(cmd);
      }
    });
    
    // Ensure worksheets have proper structure
    if (structure.worksheets && Array.isArray(structure.worksheets)) {
      structure.worksheets = structure.worksheets.map((ws: any) => {
        // Add column formatting if not specified
        if (!ws.columnFormats) {
          ws.columnFormats = this.getIntelligentColumnFormats(ws);
        }
        
        // Add formulas if not specified
        if (!ws.formulas && ws.data && ws.data.length > 0) {
          ws.formulas = this.generateIntelligentFormulas(ws);
        }
        
        return ws;
      });
    }
    
    return structure;
  }
  
  private getIntelligentColumnFormats(worksheet: any): any {
    const formats: any = {};
    
    if (worksheet.columns) {
      worksheet.columns.forEach((col: any, index: number) => {
        const colName = col.header || col.name || col;
        const colNameLower = colName.toString().toLowerCase();
        
        if (colNameLower.includes('amount') || colNameLower.includes('balance') ||
            colNameLower.includes('debit') || colNameLower.includes('credit')) {
          formats[index] = '_($* #,##0.00_);_($* (#,##0.00);_($* "-"??_);_(@_)';
        } else if (colNameLower.includes('date')) {
          formats[index] = 'mm/dd/yyyy';
        } else if (colNameLower.includes('percent') || colNameLower.includes('rate')) {
          formats[index] = '0.0%';
        } else if (colNameLower.includes('quantity') || colNameLower.includes('count')) {
          formats[index] = '#,##0';
        }
      });
    }
    
    return formats;
  }
  
  private generateIntelligentFormulas(worksheet: any): any[] {
    const formulas = [];
    
    // Add total row if numerical data exists
    if (worksheet.data && worksheet.data.length > 0) {
      const firstRow = worksheet.data[0];
      Object.keys(firstRow).forEach((key) => {
        if (typeof firstRow[key] === 'number') {
          const colLetter = this.getColumnLetter(Object.keys(firstRow).indexOf(key));
          formulas.push({
            cell: `${colLetter}${worksheet.data.length + 2}`,
            formula: `SUM(${colLetter}2:${colLetter}${worksheet.data.length + 1})`,
            description: `Total for ${key}`
          });
        }
      });
    }
    
    return formulas;
  }
  
  private getColumnLetter(index: number): string {
    let letter = '';
    while (index >= 0) {
      letter = String.fromCharCode((index % 26) + 65) + letter;
      index = Math.floor(index / 26) - 1;
    }
    return letter;
  }
}

export const llmService = new LLMService();