import OpenAI from 'openai';
import { logger } from '../utils/logger';

class LLMService {
  private openai: OpenAI;

  constructor() {
    // Set the API key from environment or use the provided key
    const apiKey = process.env.OPENAI_API_KEY || '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';
    
    if (!apiKey || apiKey === 'your-api-key-here') {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    
    this.openai = new OpenAI({
      apiKey: apiKey,
    });
  }

  async processExcelCommand(message: string, conversationHistory?: Array<{role: 'user' | 'assistant', content: string}>): Promise<{
    response: string;
    actions?: any[];
    cost: number;
  }> {
    try {
      const systemPrompt = `You are Nubia, an Excel automation system that CREATES Excel files.

NEVER give instructions or steps.
NEVER say "Step 1", "Step 2", etc.
NEVER tell users to create workbooks or click anything.

When given transactions, IMMEDIATELY return:
{
  "action": "create_excel",
  "data": {
    "worksheets": [actual data structure with the transactions already recorded]
  }
}

You CREATE the Excel file with the data already in it.
You are automation software, not a teacher.

When users need Excel work, analyze what they need and respond with:
[EXCEL_STRUCTURE]
{
  "worksheets": [
    {
      "name": "Sheet name that makes sense",
      "columns": [
        {"header": "Column Name", "key": "logical_key", "width": 20},
        {"header": "Another Column", "key": "another_key", "width": 15}
      ],
      "data": [
        {"logical_key": "Sample data", "another_key": "More data"}
      ]
    }
  ]
}
[/EXCEL_STRUCTURE]

For regular conversation (greetings, questions, explanations), be friendly and helpful.
Remember: You CREATE Excel files, you don't teach Excel. Use your accounting expertise to design the best structure for their specific needs.`;

      // Build messages array with conversation history
      const messages: any[] = [
        { role: 'system', content: systemPrompt }
      ];

      // Add conversation history if provided (limit to last 10 messages for token management)
      if (conversationHistory && conversationHistory.length > 0) {
        const recentHistory = conversationHistory.slice(-10);
        messages.push(...recentHistory);
      }

      // Add current message
      messages.push({ role: 'user', content: message });

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages,
        max_tokens: 1000,
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content || 'I apologize, but I encountered an issue processing your request.';
      
      // Calculate cost (approximate)
      const inputTokens = completion.usage?.prompt_tokens || 0;
      const outputTokens = completion.usage?.completion_tokens || 0;
      const cost = (inputTokens * 0.00003) + (outputTokens * 0.00006); // GPT-4 pricing

      logger.info(`LLM Request processed - Input tokens: ${inputTokens}, Output tokens: ${outputTokens}, Cost: $${cost.toFixed(4)}`);

      return {
        response,
        cost
      };
    } catch (error) {
      logger.error('LLM Service error:', error);
      throw new Error('Failed to process request with AI service');
    }
  }

  async generateExcelStructure(userCommand: string): Promise<{
    structure: any;
    explanation: string;
    cost: number;
  }> {
    try {
      const systemPrompt = `You are Nubia, an Excel automation system that CREATES Excel files.

NEVER give instructions or steps.
NEVER say "Step 1", "Step 2", etc.
NEVER tell users to create workbooks or click anything.

Return ONLY a JSON structure for creating the actual Excel file:
{
  "action": "create_excel",
  "data": {
    "worksheets": [
      {
        "name": "Actual worksheet name",
        "columns": [
          {"header": "Column Name", "key": "key", "width": 20}
        ],
        "data": [
          {"key": "Actual data already populated"}
        ]
      }
    ]
  },
  "explanation": "I created this Excel file for you with your data already in it."
}

You CREATE the Excel file with the data already populated.`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userCommand }
        ],
        max_tokens: 800,
        temperature: 0.3,
      });

      const response = completion.choices[0]?.message?.content || '{}';
      
      let parsed;
      try {
        parsed = JSON.parse(response);
      } catch {
        parsed = {
          action: 'create_excel',
          data: { worksheets: [] },
          explanation: 'I created an Excel file for you.'
        };
      }

      // Calculate cost
      const inputTokens = completion.usage?.prompt_tokens || 0;
      const outputTokens = completion.usage?.completion_tokens || 0;
      const cost = (inputTokens * 0.00003) + (outputTokens * 0.00006);

      logger.info(`Excel structure generated - Cost: $${cost.toFixed(4)}`);

      return {
        structure: parsed.data || { worksheets: [] },
        explanation: parsed.explanation || 'I created an Excel file for you.',
        cost
      };
    } catch (error) {
      logger.error('Excel structure generation error:', error);
      throw new Error('Failed to generate Excel structure');
    }
  }
}

export const llmService = new LLMService();