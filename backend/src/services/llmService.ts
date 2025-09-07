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
      const systemPrompt = `You are Nubia, a friendly AI Excel automation assistant.

CAPABILITIES:
- Create 1-50+ worksheets in a single workbook
- Each worksheet can have completely different structures
- Include formulas, calculations, pivot tables, charts
- Handle accounting, financial, and any other type of data

IMPORTANT:
- Never give manual instructions like "Step 1: Open Excel"
- Always speak as if you're creating the file: "I'll create that for you"
- Be conversational while providing Excel structures

For Excel tasks, respond conversationally, then include:
[EXCEL_STRUCTURE]
{
  "worksheets": [
    {
      "name": "appropriate name",
      "columns": [
        {"header": "Column Name", "key": "key", "width": 20, "type": "text"}
      ],
      "data": [
        {"key": "actual data values"}
      ],
      "formulas": [
        {"cell": "E2", "formula": "=SUM(D2:D100)"}
      ]
    }
  ]
}
[/EXCEL_STRUCTURE]

For regular conversation, just chat normally.`;

      const messages: any[] = [
        { role: 'system', content: systemPrompt }
      ];

      if (conversationHistory && conversationHistory.length > 0) {
        messages.push(...conversationHistory.slice(-10));
      }

      messages.push({ role: 'user', content: message });

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages,
        max_tokens: 2000,
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content || '';
      
      // Parse Excel structure if present
      let excelData = null;
      if (response.includes('[EXCEL_STRUCTURE]')) {
        const match = response.match(/\[EXCEL_STRUCTURE\]([\s\S]*?)\[\/EXCEL_STRUCTURE\]/);
        if (match) {
          try {
            excelData = JSON.parse(match[1]);
          } catch (e) {
            logger.error('Failed to parse Excel structure:', e);
            throw new Error('GPT returned invalid Excel structure');
          }
        }
      }
      
      const inputTokens = completion.usage?.prompt_tokens || 0;
      const outputTokens = completion.usage?.completion_tokens || 0;
      const cost = (inputTokens * 0.01 / 1000) + (outputTokens * 0.03 / 1000);

      logger.info(`LLM Request processed - Cost: $${cost.toFixed(4)}`);

      return {
        response: response.replace(/\[EXCEL_STRUCTURE\][\s\S]*?\[\/EXCEL_STRUCTURE\]/, '').trim(),
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
      const systemPrompt = `You are Nubia, an Excel automation expert.

Create comprehensive Excel structures with complete freedom.
Return ONLY valid JSON with whatever structure makes sense for the request.

Include multiple worksheets if beneficial. Be creative and comprehensive.`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userCommand }
        ],
        max_tokens: 2000,
        temperature: 0.7,
        response_format: { type: "json_object" }
      });

      const response = completion.choices[0]?.message?.content || '';
      
      let parsed;
      try {
        parsed = JSON.parse(response);
      } catch {
        throw new Error('GPT returned invalid JSON for Excel structure');
      }

      // Ensure we have worksheets
      if (!parsed.worksheets && !parsed.data) {
        throw new Error('GPT did not return a valid Excel structure');
      }

      const inputTokens = completion.usage?.prompt_tokens || 0;
      const outputTokens = completion.usage?.completion_tokens || 0;
      const cost = (inputTokens * 0.01 / 1000) + (outputTokens * 0.03 / 1000);

      logger.info(`Excel structure generated - Cost: $${cost.toFixed(4)}`);

      return {
        structure: parsed.worksheets ? { worksheets: parsed.worksheets } : parsed,
        explanation: parsed.explanation || 'Excel file created with your data.',
        cost
      };
    } catch (error: any) {
      logger.error('Excel structure generation error:', error);
      throw error;
    }
  }
}

export const llmService = new LLMService();