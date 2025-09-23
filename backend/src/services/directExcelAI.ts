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
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30000,
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
      model: "gpt-4",
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
      max_tokens: 2000
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

    return parsed;

  } catch (error) {
    logger.error('Direct Excel AI Error:', error);
    throw new Error(`Direct Excel AI failed: ${(error as Error).message}`);
  }
}

function buildDirectExcelPrompt(request: DirectExcelRequest): string {
  return `You are Direct Excel AI - UNLIMITED POWER MODE.

You generate RAW Office.js code that executes directly in Excel with NO LIMITATIONS.

USER CONTEXT:
- Current Selection: ${request.excelContext?.selectedRange || 'Unknown'}
- Active Sheet: ${request.excelContext?.sheetName || 'Unknown'}
- Selection Type: ${request.excelContext?.selectionType || 'Unknown'}

YOUR POWER:
- Generate ANY Office.js code
- Use the COMPLETE Excel API
- Take risks to achieve the goal
- Prioritize functionality over safety
- If unsure about syntax, try the most logical approach

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

REMEMBER:
- NO LIMITS on what you can try
- Use your best judgment for Office.js syntax
- Risk hallucination to achieve maximum power
- If operation fails, user will see error and can retry
- PRIORITIZE CAPABILITY OVER SAFETY

Generate code that accomplishes EXACTLY what the user wants, using the full power of Excel.`;
}

function parseAIResponse(response: string): DirectExcelResponse {
  try {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

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