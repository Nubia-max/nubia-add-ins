/**
 * Direct Excel AI - Unlimited Power Mode
 * AI generates raw Office.js code that executes directly in Excel
 * NO LIMITS, NO GUARDRAILS - MAXIMUM CAPABILITY
 */

import OpenAI from 'openai';
import { logger } from '../utils/logger';

// Lazy initialization to avoid module load issues
let client: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!client) {
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error('DEEPSEEK_API_KEY environment variable is required');
    }

    client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com',
      timeout: 120000, // 2 minutes for complex operations
      maxRetries: 2
    });
  }
  return client;
}

interface DirectExcelRequest {
  userCommand: string;
  excelContext: any;
}

interface DirectExcelResponse {
  understanding: string;
  code: string;
  confidence: number;
  message: string;
}

export async function generateDirectExcelCode(request: DirectExcelRequest): Promise<DirectExcelResponse> {
  try {
    logger.info('🚀 Direct Excel AI - Unlimited Power Mode', {
      command: request.userCommand.substring(0, 100),
      contextType: request.excelContext?.selectionType
    });

    const prompt = buildDirectExcelPrompt(request);

    const completion = await getOpenAIClient().chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: prompt
        },
        {
          role: "user",
          content: `Execute this Excel command: "${request.userCommand}"`
        }
      ],
      temperature: 0.1,
      max_tokens: 8000
    });

    const response = completion.choices[0]?.message?.content;

    if (!response) {
      throw new Error('No response from AI');
    }

    // Parse the AI response
    const parsed = parseAIResponse(response);

    logger.info('🧠 Direct Excel AI Generated Code', {
      understanding: parsed.understanding?.substring(0, 100),
      codeLength: parsed.code?.length,
      confidence: parsed.confidence
    });

    // Log the actual generated code for debugging
    logger.debug('Generated Excel Code:', parsed.code);

    // Remove the hardcoded fix since we're using few-shot learning now

    return parsed;

  } catch (error) {
    logger.error('Direct Excel AI Error:', error);
    throw new Error(`Direct Excel AI failed: ${(error as Error).message}`);
  }
}

function buildDirectExcelPrompt(request: DirectExcelRequest): string {
  return `You are Direct Excel AI - SMART STEP-BY-STEP MODE.

You generate precise Office.js code that executes reliably in Excel.

USER CONTEXT:
- Current Selection: ${request.excelContext?.selectedRange || 'Unknown'}
- Active Sheet: ${request.excelContext?.activeSheetName || 'Unknown'}
- Available Worksheets: ${request.excelContext?.worksheets?.map(w => w.name).join(', ') || 'Unknown'}
- Selection Type: ${request.excelContext?.selectionType || 'Unknown'}

TASK COMPLEXITY RULES:
1. SIMPLE TASKS: Execute directly (format cells, add formulas, create charts)
2. COMPLEX TASKS: Break into ONE simple step only
   - BRS → "Create BRS worksheet with headers"
   - Data comparison → "Copy data to new sheet"
   - Analysis → "Add basic formulas"

APPROACH:
- For complex requests, choose the FIRST logical step only
- Generate simple, reliable code that definitely works
- Avoid complex logic, loops, or advanced APIs
- Use basic Excel operations only

RESPONSE FORMAT:
You must respond with valid JSON:

{
  "understanding": "What I understood from the user's request",
  "code": "COMPLETE Office.js function that accomplishes the task",
  "confidence": 0.95,
  "message": "Explanation of what the code will do"
}

CODE REQUIREMENTS:
1. Generate a COMPLETE async function
2. Include proper Excel.run wrapper
3. Include context.sync() calls when needed
4. Handle errors gracefully with try-catch
5. Use the full power of Office.js API
6. Don't limit yourself to "safe" operations

EXCEL API EXAMPLES (Use ANY Office.js feature):

BASIC OPERATIONS:
\`\`\`javascript
async function executeExcelOperation() {
  return Excel.run(async (context) => {
    const worksheet = context.workbook.worksheets.getActiveWorksheet();
    const range = worksheet.getRange("A1:B10");
    range.format.fill.color = "#FFFF00";
    await context.sync();
  });
}
\`\`\`

ADVANCED OPERATIONS:
\`\`\`javascript
async function executeExcelOperation() {
  return Excel.run(async (context) => {
    const worksheet = context.workbook.worksheets.getActiveWorksheet();
    const usedRange = worksheet.getUsedRange();
    usedRange.load("values");
    await context.sync();

    // Complex logic here
    for (let row = 0; row < usedRange.values.length; row++) {
      for (let col = 0; col < usedRange.values[row].length; col++) {
        if (usedRange.values[row][col]?.toString().includes("target")) {
          const cell = worksheet.getCell(row, col);
          cell.format.fill.color = "#FF0000";
        }
      }
    }
    await context.sync();
  });
}
\`\`\`

WORKING EXAMPLES - Follow these exact patterns:

CHART CREATION (CORRECT SYNTAX):
\`\`\`javascript
async function executeExcelOperation() {
  return Excel.run(async (context) => {
    const worksheet = context.workbook.worksheets.getActiveWorksheet();
    const dataRange = worksheet.getUsedRange();
    const chart = worksheet.charts.add("columnClustered", dataRange, "auto");
    chart.setPosition("F2", "M15");
    chart.title.text = "My Chart";
    chart.legend.position = "right";
    await context.sync();
  });
}
executeExcelOperation().catch(console.error);
\`\`\`

CONDITIONAL FORMATTING:
\`\`\`javascript
async function executeExcelOperation() {
  return Excel.run(async (context) => {
    const worksheet = context.workbook.worksheets.getActiveWorksheet();
    const range = worksheet.getUsedRange();
    const conditionalFormat = range.conditionalFormats.add("cellValue");
    conditionalFormat.cellValue.format.fill.color = "#FF0000";
    conditionalFormat.cellValue.rule = { formula1: "100", operator: "greaterThan" };
    await context.sync();
  });
}
executeExcelOperation().catch(console.error);
\`\`\`

REMEMBER:
- Chart types: "columnClustered", "pie", "line", "bar"
- Always use executeExcelOperation().catch(console.error);
- STICK TO VALID OFFICE.JS SYNTAX - use only basic, reliable operations
- For complex tasks, do ONE logical step and guide user to next step
- Avoid loops, complex logic, and advanced APIs
- When in doubt, choose the simplest approach that works

Generate simple, reliable code that definitely executes successfully.`;
}

function parseAIResponse(response: string): DirectExcelResponse {
  try {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response');
    }

    // Log the raw JSON for debugging
    logger.debug('Raw JSON match:', jsonMatch[0].substring(0, 200) + '...');

    // Sanitize JSON string by escaping control characters only within string values
    let sanitizedJson = jsonMatch[0];
    let inString = false;
    let escaped = false;
    let result = '';

    for (let i = 0; i < sanitizedJson.length; i++) {
      const char = sanitizedJson[i];

      if (escaped) {
        result += char;
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        result += char;
        continue;
      }

      if (char === '"' && !escaped) {
        inString = !inString;
        result += char;
        continue;
      }

      if (inString && /[\x00-\x1F\x7F]/.test(char)) {
        switch (char) {
          case '\n': result += '\\n'; break;
          case '\r': result += '\\r'; break;
          case '\t': result += '\\t'; break;
          case '\b': result += '\\b'; break;
          case '\f': result += '\\f'; break;
          default: result += '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0');
        }
      } else {
        result += char;
      }
    }

    sanitizedJson = result;

    logger.debug('Sanitized JSON:', sanitizedJson.substring(0, 200) + '...');
    const parsed = JSON.parse(sanitizedJson);

    return {
      understanding: parsed.understanding || 'AI did not provide understanding',
      code: parsed.code || '',
      confidence: parsed.confidence || 0.8,
      message: parsed.message || 'AI will execute the operation'
    };

  } catch (error) {
    logger.error('Failed to parse AI response:', error);

    // Fallback: treat entire response as code
    return {
      understanding: 'Parsing failed, executing raw response',
      code: response,
      confidence: 0.5,
      message: 'Raw AI response execution'
    };
  }
}