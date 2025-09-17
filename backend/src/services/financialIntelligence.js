require('dotenv').config();
const OpenAI = require('openai');
const { extractTaggedBlock, safeParseJSON, validateExcelStructure } = require('../utils/sectionParsers');
const { LEGENDARY_NUBIA_SYSTEM_PROMPT, EXCEL_FORMATTING_INSTRUCTIONS } = require('../constants/systemPrompts');

class FinancialIntelligenceService {
  constructor() {
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error('DEEPSEEK_API_KEY environment variable is required. Please set it in your .env file.');
    }

    if (!LEGENDARY_NUBIA_SYSTEM_PROMPT) {
      throw new Error('LEGENDARY_NUBIA_SYSTEM_PROMPT is not properly exported from systemPrompts.js');
    }

    this.client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com',
      timeout: 300000, // 5 minutes - allow proper thinking time
      maxRetries: 1
    });
  }

  // LEGENDARY NUBIA: Enhanced thinking with temperature 0
  async processFinancialCommand(message, options = {}) {
    if (!message || typeof message !== 'string' || message.trim() === '') {
      throw new Error('Message parameter is required and must be a non-empty string');
    }

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        console.log(`🎯 Processing with legendary Nubia DeepSeek (temperature 0 - EXTENDED enhanced thinking) - Attempt ${attempt + 1}`);
        console.log(`🧠 Deep reasoning mode: Comprehensive analysis of all problem aspects required`);

        // DEBUG: Log what's being sent to DeepSeek
        console.log('📤 DEEPSEEK REQUEST DEBUG:');
        console.log('📤 Model:', 'deepseek-reasoner');
        console.log('📤 Temperature:', 0);
        console.log('📤 System prompt length:', LEGENDARY_NUBIA_SYSTEM_PROMPT.length);
        console.log('📤 System prompt first 200 chars:', LEGENDARY_NUBIA_SYSTEM_PROMPT.substring(0, 200));
        console.log('📤 User message length:', message.length);
        console.log('📤 User message first 200 chars:', message.substring(0, 200));

        console.log('🚀 Sending request to DeepSeek...');
        console.log('⏳ Allowing up to 6 minutes for deep reasoning...');

        // Add progress logging every 30 seconds
        const progressInterval = setInterval(() => {
          console.log('🧠 DeepSeek is still thinking... (this is normal for complex accounting)');
        }, 30000);

        let response;
        try {
          response = await Promise.race([
            this.client.chat.completions.create({
              model: 'deepseek-reasoner',
              temperature: 0,  // LOCKED at 0 for complete determinism with enhanced thinking
              messages: [
                {
                  role: 'system',
                  content: LEGENDARY_NUBIA_SYSTEM_PROMPT
                },
                {
                  role: 'user',
                  content: message
                }
              ],
              max_tokens: 32000,
              // Explicitly enable reasoning mode for DeepSeek Reasoner
              reasoning: true,
              // DISABLE function calling for accounting reasoning - we need pure mathematical thinking
              // functions: this.functionRegistry.getFunctionDefinitions(),
              // function_call: 'auto'
            }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('DeepSeek request timed out after 6 minutes - may indicate API or network issue')), 360000)
            )
          ]);
        } finally {
          clearInterval(progressInterval);
        }

        console.log('✅ DeepSeek thinking complete! Processing response...');
        const responseMessage = response.choices[0].message;
        const raw = responseMessage.content || '';

        console.log('🎯 DeepSeek Response received (enhanced thinking mode)');

        // DEBUG: Log DeepSeek response structure for reasoning analysis
        console.log('📥 DEEPSEEK RESPONSE DEBUG:');
        console.log('📥 Response object keys:', Object.keys(response));
        console.log('📥 Choice object keys:', Object.keys(response.choices[0]));
        console.log('📥 Message object keys:', Object.keys(responseMessage));
        console.log('📥 Has reasoning property:', 'reasoning' in responseMessage);
        console.log('📥 Has reasoning_content property:', 'reasoning_content' in responseMessage);

        if (responseMessage.reasoning_content) {
          console.log('📥 Reasoning content length:', responseMessage.reasoning_content.length);
          console.log('📥 Reasoning preview (first 800 chars):', responseMessage.reasoning_content.substring(0, 800));
          console.log('📥 Reasoning preview (last 400 chars):', responseMessage.reasoning_content.slice(-400));
        } else if (responseMessage.reasoning) {
          console.log('📥 Reasoning content length:', responseMessage.reasoning.length);
          console.log('📥 Reasoning preview:', responseMessage.reasoning.substring(0, 500));
        }
        console.log('📥 Regular content length:', raw.length);

        // Function calling disabled for pure accounting reasoning

        // Enhanced logging for all responses to debug format issues
        console.log('📄 RAW DEEPSEEK RESPONSE (first 2000 chars):', raw.substring(0, 2000));
        console.log('📄 RAW DEEPSEEK RESPONSE (last 500 chars):', raw.slice(-500));
        console.log('📄 TOTAL RESPONSE LENGTH:', raw.length);

        // Check for proper format adherence
        const hasChatResponse = raw.includes('[CHAT_RESPONSE]') && raw.includes('[/CHAT_RESPONSE]');
        const hasExcelData = raw.includes('[EXCEL_DATA]') && raw.includes('[/EXCEL_DATA]');
        console.log('📄 FORMAT CHECK:', { hasChatResponse, hasExcelData });

        // Extract sections using the proven parser
        const chatResponse = extractTaggedBlock(raw, 'CHAT_RESPONSE') || 
                            'I\'ve processed your request.';
        const excelDataBlock = extractTaggedBlock(raw, 'EXCEL_DATA');
        const structure = safeParseJSON(excelDataBlock);
        
        // Debug: Log the parsed structure
        if (structure && structure.workbook) {
          console.log('📊 PARSED STRUCTURE:', JSON.stringify({
            worksheetCount: structure.workbook.length,
            worksheetNames: structure.workbook.map(w => w.name || w.sheetName || "unnamed"),
            commandCount: structure.commands ? structure.commands.length : 0
          }, null, 2));
        }

        // If no Excel structure but the request appears to be accounting-related, retry
        if (!structure && this.isAccountingRequest(message)) {
          console.log('⚠️ No Excel structure detected for accounting request, retrying with format enforcement');
          return await this.retryWithFormatEnforcement(message);
        }

        // If no Excel structure, it's just chat (DeepSeek decided it wasn't accounting)
        if (!structure) {
          return {
            success: true,
            chatResponse,
            structure: null,
            tokensUsed: response.usage?.total_tokens || 0
          };
        }

        // Validate structure if it exists
        const validation = validateExcelStructure(structure);
        if (!validation.valid) {
          console.log('⚠️ Validation failed, attempting retry with stricter prompt');
          return await this.retryWithValidation(message, structure, validation.error);
        }

        // Post-process: Apply Excel formatting instructions to enhance the structure (optional)
        let enhancedStructure = structure;

        // TEMPORARY: Disable enhancement to prevent timeouts - can be enabled later
        const ENABLE_EXCEL_ENHANCEMENT = false; // Set to true to enable post-processing

        if (ENABLE_EXCEL_ENHANCEMENT) {
          try {
            console.log('🎨 Attempting optional Excel enhancement...');
            enhancedStructure = await Promise.race([
              this.applyExcelFormatting(structure, message),
              new Promise(resolve => setTimeout(() => {
                console.log('⚠️ Excel enhancement timed out, using original structure');
                resolve(structure);
              }, 10000)) // 10 second timeout for enhancement
            ]);
          } catch (error) {
            console.log('⚠️ Excel enhancement failed, using original structure:', error.message);
            enhancedStructure = structure;
          }
        } else {
          console.log('🎨 Excel enhancement disabled, using original structure');
        }

        // Additional rules-first validation checks
        if (structure.meta?.checks) {
          const failedChecks = structure.meta.checks.filter(check => !check.passed);
          if (failedChecks.length > 0) {
            console.log('⚠️ Accounting rules failed, attempting retry');
            return await this.retryWithValidation(message, structure, `Accounting rules failed: ${failedChecks.map(c => c.check).join(', ')}`);
          }
        }

        console.log('✅ Rules-first validation passed');
        
        return {
          success: true,
          chatResponse,
          structure: enhancedStructure,
          tokensUsed: response.usage?.total_tokens || 0,
          functionResults: [],
          automationExecuted: false
        };
        
      } catch (error) {
        attempt++;
        console.error(`❌ Financial Intelligence Error (Attempt ${attempt}):`, error.message);
        
        if (error.name === 'APIConnectionTimeoutError' || error.code === 'ECONNRESET' || error.message?.includes('timeout')) {
          if (attempt < maxRetries) {
            const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
            console.log(`⏳ Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        
        if (attempt >= maxRetries) {
          console.error('❌ All retry attempts failed');
          throw error;
        }
        
        throw error;
      }
    }
  }

  async retryWithValidation(message, _structure, validationError) {
    try {
      console.log('🔄 Retrying with validation feedback:', validationError);
      
      const retryPrompt = `${message}

VALIDATION ERROR FEEDBACK: ${validationError}
Please correct the structure and ensure all required fields are present.`;

      const response = await this.client.chat.completions.create({
        model: 'deepseek-reasoner',
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: LEGENDARY_NUBIA_SYSTEM_PROMPT
          },
          {
            role: 'user',
            content: retryPrompt
          }
        ],
        max_tokens: 32000,
        reasoning: true
      });

      const raw = response.choices[0].message.content || '';
      const chatResponse = extractTaggedBlock(raw, 'CHAT_RESPONSE') || 
                          'I\'ve processed your request with corrections.';
      const excelDataBlock = extractTaggedBlock(raw, 'EXCEL_DATA');
      const correctedStructure = safeParseJSON(excelDataBlock);

      return {
        success: true,
        chatResponse,
        structure: correctedStructure,
        tokensUsed: response.usage?.total_tokens || 0,
        retry: true
      };
      
    } catch (error) {
      console.error('❌ Retry failed:', error);
      return {
        success: false,
        chatResponse: 'I apologize, but I encountered an error processing your request. Please try again.',
        structure: null,
        error: error.message
      };
    }
  }

  // Helper to detect if request is accounting-related
  isAccountingRequest(message) {
    const accountingKeywords = [
      'consolidated', 'goodwill', 'acquisition', 'financial statement', 'balance sheet',
      'income statement', 'cash flow', 'ledger', 'journal', 'debit', 'credit', 'profit',
      'loss', 'revenue', 'expense', 'asset', 'liability', 'equity', 'depreciation',
      'trial balance', 'reconciliation', 'audit', 'budget', 'forecast', 'accounting'
    ];
    const lowerMessage = message.toLowerCase();
    return accountingKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  // Enhanced retry for format enforcement
  async retryWithFormatEnforcement(message) {
    try {
      console.log('🔄 Retrying with strict format enforcement');

      const formatEnforcementPrompt = `${message}

CRITICAL FORMAT REQUIREMENT: Your response MUST follow this EXACT format:

[CHAT_RESPONSE]
Your professional accounting analysis and explanation here.
[/CHAT_RESPONSE]

[EXCEL_DATA]
{
  "meta": { "mode": "appropriate_mode", "framework": "IFRS_or_GAAP" },
  "workbook": [{"name": "Sheet_Name", "data": [["Header1"], ["Data1"]]}]
}
[/EXCEL_DATA]

DO NOT deviate from this format. Do not add any text before [CHAT_RESPONSE] or after [/EXCEL_DATA].`;

      const response = await this.client.chat.completions.create({
        model: 'deepseek-reasoner',
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: LEGENDARY_NUBIA_SYSTEM_PROMPT
          },
          {
            role: 'user',
            content: formatEnforcementPrompt
          }
        ],
        max_tokens: 32000,
        reasoning: true
      });

      const raw = response.choices[0].message.content || '';
      const chatResponse = extractTaggedBlock(raw, 'CHAT_RESPONSE') ||
                          'I\'ve processed your request with format corrections.';
      const excelDataBlock = extractTaggedBlock(raw, 'EXCEL_DATA');
      const structure = safeParseJSON(excelDataBlock);

      return {
        success: true,
        chatResponse,
        structure,
        tokensUsed: response.usage?.total_tokens || 0,
        formatRetry: true
      };

    } catch (error) {
      console.error('❌ Format enforcement retry failed:', error);
      return {
        success: false,
        chatResponse: 'I apologize, but I encountered an error processing your accounting request. Please try again.',
        structure: null,
        error: error.message
      };
    }
  }

  // Post-processing: Apply Excel formatting instructions to enhance structure
  async applyExcelFormatting(structure, originalMessage) {
    try {
      console.log('🎨 Applying Excel formatting enhancements (post-processing)');

      if (!structure || !structure.workbook) {
        console.log('⚠️ No structure to enhance, returning original');
        return structure;
      }

      // Create a prompt to enhance the Excel structure with professional formatting
      const enhancementPrompt = `Given this basic Excel structure from an accounting analysis, apply professional formatting and enhancements:

ORIGINAL REQUEST: ${originalMessage}

BASIC STRUCTURE:
${JSON.stringify(structure, null, 2)}

ENHANCEMENT INSTRUCTIONS:
${EXCEL_FORMATTING_INSTRUCTIONS}

Please return an enhanced version of the structure with:
1. Professional formatting commands
2. Proper styling and borders
3. Charts and graphs where appropriate
4. Conditional formatting for negative values
5. Freeze panes and column adjustments
6. Any missing calculations or totals

Return ONLY the enhanced JSON structure, no explanation needed.`;

      console.log('🎨 Sending for Excel enhancement...');
      const response = await this.client.chat.completions.create({
        model: 'deepseek-reasoner',
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: enhancementPrompt
          }
        ],
        max_tokens: 8000,  // Reduced for faster processing
        reasoning: false   // Disable reasoning for formatting to speed up
      });

      const enhancementResponse = response.choices[0].message.content || '';
      console.log('🎨 Enhancement response received, length:', enhancementResponse.length);

      // Try to parse the enhanced structure
      const enhancedStructure = safeParseJSON(enhancementResponse);

      if (enhancedStructure && enhancedStructure.workbook) {
        console.log('✅ Excel formatting enhancement successful');
        console.log('🎨 Enhanced with', enhancedStructure.commands?.length || 0, 'formatting commands');
        return enhancedStructure;
      } else {
        console.log('⚠️ Enhancement failed, returning original structure');
        return structure;
      }

    } catch (error) {
      console.error('❌ Excel formatting enhancement failed:', error.message);
      console.log('⚠️ Falling back to original structure');
      return structure;
    }
  }

  // Get service status
  getServiceInfo() {
    return {
      service: 'NUBIA Financial Intelligence',
      version: '2.0',
      features: [
        'Rules-first validation',
        'Temperature 0.1 deterministic processing',
        'Automatic retry on validation failure',
        'Multi-framework support (GAAP, IFRS, etc.)',
        'DeepSeek Reasoner (Thinking Mode v3.1) powered intelligence'
      ],
      temperature: 0,
      rulesFirst: true
    };
  }
}

module.exports = FinancialIntelligenceService;

/*
LEGENDARY NUBIA FINANCIAL INTELLIGENCE - ENHANCED THINKING EDITION
✅ Let DeepSeek decide everything - no keyword detection
✅ Always temperature 0 - enhanced thinking with complete determinism
✅ Extended 10-minute timeout for thorough reasoning
✅ Retry mechanism on validation failure
✅ Rules-first validation enforcement
✅ Trust DeepSeek's intelligence completely
✅ Clean separation of chat and Excel data
✅ Deterministic, professional results with detailed working shown

The legendary standard: DeepSeek Reasoner at temperature 0 with enhanced thinking for every task
*/