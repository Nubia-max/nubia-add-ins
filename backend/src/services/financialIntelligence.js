require('dotenv').config();
const OpenAI = require('openai');

class FinancialIntelligenceService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async processFinancialCommand(userCommand, chatHistory = []) {
    console.log('🧠 Processing financial command with complete GPT freedom:', userCommand);
    
    const prompt = `
User request: "${userCommand}"

Previous context: ${JSON.stringify(chatHistory.slice(-3))}

You have COMPLETE FREEDOM to create ANY financial documents that would be most helpful for this request.

Analyze this request and return a JSON structure for an Excel file with:
- As many worksheets as you think are necessary (1-50+)
- Whatever columns make sense for each worksheet  
- Any formulas, formatting, or structure you deem appropriate
- Creative solutions that go beyond basic templates

Think like a professional accountant, financial analyst, or business consultant. Create what would be MOST useful and comprehensive for this specific request.

Examples of what you can create:
- Multiple related worksheets (Sales Log, Tax Calc, P&L, Cash Flow, etc.)
- Dynamic formulas and calculations
- Different formats for different needs
- Charts and pivot table suggestions
- Compliance-ready structures

Return ONLY a JSON object with this flexible structure:
{
  "worksheets": [
    {
      "name": "descriptive worksheet name",
      "description": "what this worksheet does",
      "columns": [
        {
          "header": "Column Name", 
          "key": "column_key",
          "width": 15,
          "type": "text|number|currency|date|formula"
        }
      ],
      "data": [
        // Sample data rows that match the columns
      ],
      "formulas": [
        {
          "cell": "C1",
          "formula": "=SUM(C2:C100)",
          "description": "Total calculation"
        }
      ],
      "formatting": {
        "headerStyle": {
          "font": { "bold": true },
          "fill": { "fgColor": { "rgb": "4472C4" } },
          "font": { "color": { "rgb": "FFFFFF" } }
        },
        "currencyColumns": ["amount", "total", "price"],
        "dateColumns": ["date", "created_at"]
      }
    }
  ],
  "suggestions": [
    "Additional features or next steps the user might want"
  ]
}

Be creative and comprehensive. Create multiple worksheets if beneficial. Include real sample data that makes sense for the context.
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { 
            role: "system", 
            content: "You are an expert accountant and financial analyst with complete creative freedom to design optimal financial documents. Always respond with valid JSON only." 
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 4000
      });

      const gptResponse = response.choices[0].message.content;
      console.log('🎯 GPT Response:', gptResponse);

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
        throw new Error('Invalid JSON response from GPT');
      }

      // Validate structure
      if (!structure.worksheets || !Array.isArray(structure.worksheets)) {
        throw new Error('Invalid worksheet structure from GPT');
      }

      return {
        success: true,
        structure,
        tokensUsed: response.usage.total_tokens,
        model: response.model
      };

    } catch (error) {
      console.error('❌ Financial Intelligence Error:', error);
      return {
        success: false,
        error: error.message,
        fallback: this.createFallbackStructure(userCommand)
      };
    }
  }

  // Enhanced context-aware processing
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
Since this user typically works with ${userContext.industry}, ensure the documents are optimized for that industry's specific needs and compliance requirements.
` : ''}

Create the most relevant and useful financial documents for this specific user and request.
    `;

    return this.processFinancialCommand(enhancedPrompt, chatHistory);
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

  createFallbackStructure(userCommand) {
    console.log('🛟 Creating fallback structure for:', userCommand);
    
    return {
      worksheets: [{
        name: "Financial Data",
        description: "General financial tracking sheet",
        columns: [
          { header: "Date", key: "date", width: 12, type: "date" },
          { header: "Description", key: "description", width: 25, type: "text" },
          { header: "Amount", key: "amount", width: 15, type: "currency" },
          { header: "Category", key: "category", width: 15, type: "text" },
          { header: "Running Total", key: "total", width: 15, type: "formula" }
        ],
        data: [
          {
            date: new Date().toLocaleDateString(),
            description: "Sample Transaction",
            amount: 0,
            category: "General",
            total: "=SUM(C$2:C2)"
          }
        ],
        formulas: [
          {
            cell: "E2",
            formula: "=SUM(C$2:C2)",
            description: "Running total of amounts"
          }
        ],
        formatting: {
          headerStyle: {
            font: { bold: true },
            fill: { fgColor: { rgb: "4472C4" } }
          },
          currencyColumns: ["amount", "total"],
          dateColumns: ["date"]
        }
      }],
      suggestions: [
        "Add more specific transaction categories",
        "Create monthly summary charts",
        "Set up automated tax calculations"
      ]
    };
  }

  // Intelligent command enhancement
  enhanceCommand(userCommand) {
    const enhancements = {
      restaurant: {
        keywords: ['restaurant', 'food', 'dining'],
        additions: 'Include tax calculations, tip tracking, and daily sales summaries.'
      },
      sales: {
        keywords: ['sales', 'revenue', 'income'],
        additions: 'Add commission calculations, sales targets, and performance metrics.'
      },
      expenses: {
        keywords: ['expense', 'cost', 'spending'],
        additions: 'Include expense categories, budget comparisons, and tax deductions.'
      },
      crypto: {
        keywords: ['bitcoin', 'crypto', 'trading'],
        additions: 'Add capital gains calculations, portfolio tracking, and tax implications.'
      }
    };

    let enhanced = userCommand;
    Object.entries(enhancements).forEach(([type, config]) => {
      if (config.keywords.some(keyword => userCommand.toLowerCase().includes(keyword))) {
        enhanced += ` ${config.additions}`;
      }
    });

    return enhanced;
  }
}

module.exports = FinancialIntelligenceService;