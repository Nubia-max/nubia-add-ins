// LEGENDARY NUBIA LLM SERVICE
// Rules-First Accounting Engine with Temperature 0.1 Lock
const OpenAI = require('openai');
const { LEGENDARY_NUBIA_SYSTEM_PROMPT } = require('../constants/systemPrompts');

class LLMService {
  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required. Please set it in your .env file.');
    }
    console.log('✅ OpenAI API key configured');
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * LEGENDARY NUBIA: Rules-First completion with LOCKED temperature 0.1
   * NO EXCEPTIONS - Always deterministic, always rules-first
   * @param {object} options - openai.chat.completions.create options
   */
  async createCompletion(options) {
    // LEGENDARY LOCK: Temperature 0.1 ALWAYS - no overrides allowed
    const legendaryOptions = {
      ...options,
      model: 'gpt-4o',  // Always GPT-4o for legendary Nubia
      temperature: 0.1, // LOCKED - ignores env vars and overrides
      frequency_penalty: 0,
      presence_penalty: 0,
      top_p: 1,
      // Force rules-first system prompt - no exceptions
      messages: options.messages.map(msg => {
        if (msg.role === 'system') {
          return {
            role: 'system',
            content: LEGENDARY_NUBIA_SYSTEM_PROMPT
          };
        }
        return msg;
      })
    };
    
    console.log(`🎯 LEGENDARY NUBIA: GPT-4o call (LOCKED temp=0.1)`);
    
    try {
      const response = await this.openai.chat.completions.create(legendaryOptions);
      
      // Log validation status
      if (response.choices?.[0]?.message?.content) {
        const content = response.choices[0].message.content;
        if (content.includes('"passed":false')) {
          console.warn('⚠️ Some validation checks failed in GPT response');
        }
      }
      
      return response;
    } catch (error) {
      console.error('❌ OpenAI API error:', error?.message || error);
      if (String(error?.message).includes('401')) {
        throw new Error('Invalid OpenAI API key. Please check your .env file.');
      } else if (String(error?.message).includes('429')) {
        throw new Error('OpenAI rate limit exceeded. Please try again later.');
      } else if (String(error?.message).includes('insufficient_quota')) {
        throw new Error('OpenAI quota exceeded. Please check your billing.');
      }
      throw new Error(`OpenAI API error: ${error?.message || error}`);
    }
  }

  /**
   * LEGENDARY NUBIA: Force JSON output with LOCKED temperature 0.1
   * Ignores all parameters - always uses legendary settings
   */
  async createJSON(messages) {
    return this.createCompletion({
      response_format: { type: 'json_object' },
      messages
    });
  }
}

module.exports = LLMService;

/*
LEGENDARY NUBIA LLM SERVICE
✅ Temperature 0.1 LOCKED - no overrides, no env vars, no exceptions
✅ Always GPT-4o model for legendary performance
✅ Rules-first system prompt enforced on every call
✅ Validation monitoring for accounting checks
✅ No hardcoded enhancements - GPT has complete freedom
✅ Deterministic, professional results every time

**If any check fails:**
- DO NOT output invalid results
- Recalculate using the rules
- Ensure all checks pass before responding
- If impossible, explain why in CHAT_RESPONSE

The legendary standard: GPT-4o at temperature 0.1 with complete freedom
*/
