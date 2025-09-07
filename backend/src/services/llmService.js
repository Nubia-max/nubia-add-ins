const OpenAI = require('openai');

class LLMService {
  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required. Please set it in your .env file.');
    }
    
    console.log('✅ OpenAI API key configured');
    this.openai = new OpenAI({
      apiKey: apiKey,
    });
  }

  async createCompletion(options) {
    try {
      return await this.openai.chat.completions.create(options);
    } catch (error) {
      console.error('❌ OpenAI API error:', error.message);
      
      // NO FALLBACK - just throw the error
      if (error.message.includes('401')) {
        throw new Error('Invalid OpenAI API key. Please check your .env file.');
      } else if (error.message.includes('429')) {
        throw new Error('OpenAI rate limit exceeded. Please try again later.');
      } else if (error.message.includes('insufficient_quota')) {
        throw new Error('OpenAI quota exceeded. Please check your billing.');
      }
      
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }
}

module.exports = LLMService;