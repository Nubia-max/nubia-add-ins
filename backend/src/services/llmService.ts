import OpenAI from 'openai';
import { logger } from '../utils/logger';

class LLMService {
  private openai: OpenAI;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async processExcelCommand(message: string, context?: any): Promise<{
    response: string;
    actions?: any[];
    cost: number;
  }> {
    try {
      const systemPrompt = `You are Nubia, an expert Excel automation assistant. Your job is to:

1. Understand user requests for Excel tasks
2. Generate clear, actionable Excel automation instructions
3. Provide helpful responses about what you'll do

When a user asks for Excel automation, respond with:
- A friendly confirmation of what you'll do
- Clear step-by-step actions if complex
- Any clarifying questions if needed

Context about Excel automation capabilities:
- Create worksheets and workbooks
- Enter data, formulas, and formatting
- Generate charts and pivot tables
- Perform calculations and data analysis
- Import/export data
- Create reports and templates

Be conversational but professional. Always confirm what you understand before proceeding.`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
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

  async generateExcelInstructions(userCommand: string): Promise<{
    instructions: string[];
    explanation: string;
    cost: number;
  }> {
    try {
      const systemPrompt = `You are an Excel automation expert. Convert user requests into step-by-step Excel automation instructions.

Return your response in this JSON format:
{
  "instructions": [
    "Step 1: Open Excel application",
    "Step 2: Create new workbook",
    "Step 3: ..."
  ],
  "explanation": "I'll help you create a sales tracking spreadsheet with automated calculations..."
}

Make instructions specific and actionable for automation scripts.`;

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
          instructions: ['Open Excel', 'Perform requested task'],
          explanation: 'I\'ll help you with your Excel task.'
        };
      }

      // Calculate cost
      const inputTokens = completion.usage?.prompt_tokens || 0;
      const outputTokens = completion.usage?.completion_tokens || 0;
      const cost = (inputTokens * 0.00003) + (outputTokens * 0.00006);

      logger.info(`Excel instructions generated - Cost: $${cost.toFixed(4)}`);

      return {
        instructions: parsed.instructions || [],
        explanation: parsed.explanation || 'I\'ll help you with your Excel task.',
        cost
      };
    } catch (error) {
      logger.error('Excel instructions generation error:', error);
      throw new Error('Failed to generate Excel instructions');
    }
  }
}

export const llmService = new LLMService();