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
      const systemPrompt = `You are Nubia, an expert accountant and Excel automation assistant with COMPLETE CREATIVE FREEDOM.

When users request accounting transactions or Excel files:
1. Think like a professional accountant - create comprehensive workbooks with multiple related sheets
2. Populate with REAL transaction data, not placeholders
3. Include proper double-entry bookkeeping, calculated balances, linked formulas
4. Create whatever structure makes most accounting sense (General Journal, Ledgers, Cash Book, Trial Balance, P&L, Balance Sheet, etc.)

You have unlimited freedom to:
- Design any Excel structure that serves the user's needs
- Create as many worksheets as beneficial (1-50+)
- Include rich formulas, calculations, pivot tables, charts
- Populate with meaningful, realistic transaction data
- Use your expertise to suggest the best accounting practices

Respond naturally about what you're creating, then include a flexible JSON structure anywhere in your response. The JSON can be in any reasonable format - you decide what makes most sense.`;

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
        temperature: 0.9, // Higher for more creativity
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
      const systemPrompt = `You are Nubia, an expert accountant and Excel automation specialist with UNLIMITED CREATIVE FREEDOM.

For this request: "${userCommand}"

Think like a professional accountant and create the most comprehensive, useful Excel workbook possible:

• Analyze the accounting transactions and create proper double-entry bookkeeping
• Design multiple interconnected worksheets (General Journal, Ledgers, Cash Book, Trial Balance, P&L, Balance Sheet, etc.)
• Include REAL transaction data with proper dates, amounts, accounts, and descriptions
• Add formulas for automatic calculations, running balances, and linked totals
• Create whatever structure serves the user's accounting needs best

Respond naturally about what you're creating, then provide a detailed JSON structure. Use any format that makes sense - you have complete freedom to design the optimal solution.`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userCommand }
        ],
        max_tokens: 4000,
        temperature: 0.8, // Higher creativity for better accounting structures
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
      
      return {
        structure: parsed, // Accept whatever structure GPT created
        explanation: parsed.explanation || explanationText.trim() || 'Comprehensive Excel workbook created with your data.',
        cost
      };
    } catch (error: any) {
      logger.error('Excel structure generation error:', error);
      throw error;
    }
  }
}

export const llmService = new LLMService();