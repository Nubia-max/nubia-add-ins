require('dotenv').config();
const OpenAI = require('openai');
const { extractTaggedBlock, safeParseJSON, validateExcelStructure } = require('../utils/sectionParsers');
const { LEGENDARY_NUBIA_SYSTEM_PROMPT } = require('../constants/systemPrompts');

class FinancialIntelligenceService {
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required. Please set it in your .env file.');
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 60000
    });
  }

  // LEGENDARY NUBIA: Let GPT decide everything, always temperature 0.1
  async processFinancialCommand(message, options = {}) {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        console.log(`🎯 Processing with legendary Nubia (temperature 0.1) - Attempt ${attempt + 1}`);
        
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4o',
          temperature: 0.1,  // ALWAYS 0.1 - even for casual chat
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
          max_tokens: 8000
        });

        const raw = response.choices[0].message.content || '';
        console.log('🎯 GPT Response received (rules-first mode)');
        
        // Debug: Log raw GPT response for analysis
        if (message.toLowerCase().includes('record') || message.toLowerCase().includes('books')) {
          console.log('📄 RAW GPT RESPONSE:', raw.substring(0, 1000));
        }

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

        // If no Excel structure, it's just chat (GPT decided it wasn't accounting)
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
          structure,
          tokensUsed: response.usage?.total_tokens || 0
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

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        temperature: 0.1,
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
        max_tokens: 4000
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
        'GPT-4o powered intelligence'
      ],
      temperature: 0.1,
      rulesFirst: true
    };
  }
}

module.exports = FinancialIntelligenceService;

/*
LEGENDARY NUBIA FINANCIAL INTELLIGENCE
✅ Let GPT decide everything - no keyword detection
✅ Always temperature 0.1 - even for casual chat  
✅ Retry mechanism on validation failure
✅ Rules-first validation enforcement
✅ Trust GPT's intelligence completely
✅ Clean separation of chat and Excel data
✅ Deterministic, professional results every time

The legendary standard: GPT-4o at temperature 0.1 with complete freedom
*/