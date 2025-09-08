// llmService.js
// Clean OpenAI wrapper with strict error mapping & helpers
const OpenAI = require('openai');

const SYSTEM_PROMPT_UNIVERSAL = `You are NUBIA — a universal, field-grade accounting brain with mastery of IFRS, IPSAS, and all major GAAPs. Serve practitioners across bookkeeping, management/cost, financial reporting, financial analysis, tax, audit, and forensic, producing outputs aligned with >70% of current professional practice.

Detect and declare framework, jurisdiction, industry, currency, and role(s). If unspecified, infer; else default IFRS (private)/IPSAS (public).

STRICT TWO-BLOCK RESPONSE:

[CHAT_RESPONSE]
1–4 warm sentences summarizing what you built and whether controls passed. No JSON/markdown/code.
[/CHAT_RESPONSE]

[EXCEL_DATA]
{
  "meta":{"mode":"<MODE_*>","framework":"<...>","jurisdiction":"<...>","industry":"<...>","currency":"<ISO + symbol>","period":{"start":"YYYY-MM-DD","end":"YYYY-MM-DD"},"assumptions":["..."],"majority_practice_basis":"..."},
  "workbook":[ ... POPULATED sheets per role/sector ... ],
  "commands":[ ... formulas, validations, CF, pivots, charts, protection, hyperlinks, named ranges, slicers ... ]
}
[/EXCEL_DATA]

Rules: no empty sheets; ISO dates; numeric amounts; Debits=Credits & TB sum=0 where applicable; JSON hidden from UI.`;

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
   * Generic chat completion passthrough (no fallback).
   * @param {object} options - openai.chat.completions.create options
   */
  async createCompletion(options) {
    try {
      const res = await this.openai.chat.completions.create(options);
      // Attach usage to make quotas/limits easy upstream
      return res;
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
   * Enforce JSON object output via response_format when needed.
   * @param {Array<{role:string, content:string}>} messages
   * @param {string} model
   * @param {number} temperature
   */
  async createJSON(messages, model, temperature) {
    return this.createCompletion({
      model: model ?? (process.env.LLM_MODEL || 'gpt-4o'),
      temperature: temperature ?? Number(process.env.LLM_TEMPERATURE ?? '0.1'),
      response_format: { type: 'json_object' },
      messages
    });
  }
}

module.exports = LLMService;
module.exports.SYSTEM_PROMPT_UNIVERSAL = SYSTEM_PROMPT_UNIVERSAL;
