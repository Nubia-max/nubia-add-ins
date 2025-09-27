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
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
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

    // Extract token usage from API response
    const tokensUsed = {
      input: completion.usage?.prompt_tokens || 0,
      output: completion.usage?.completion_tokens || 0,
      total: completion.usage?.total_tokens || 0
    };

    // Parse the AI response
    const parsed = parseAIResponse(response);

    logger.info('🧠 Direct Excel AI Generated Code', {
      understanding: parsed.understanding?.substring(0, 100),
      codeLength: parsed.code?.length,
      confidence: parsed.confidence,
      tokensUsed: tokensUsed.total
    });

    // Log the actual generated code for debugging
    logger.debug('Generated Excel Code:', parsed.code);

    // Add token usage to response
    return {
      ...parsed,
      tokensUsed
    };

  } catch (error) {
    logger.error('Direct Excel AI Error:', error);
    throw new Error(`Direct Excel AI failed: ${(error as Error).message}`);
  }
}

function buildDirectExcelPrompt(request: DirectExcelRequest): string {
  return `You are Direct Excel AI - PRECISION MODE.

You generate accurate Office.js code that executes reliably in Excel with proper error handling and coordinate management.

USER CONTEXT:
- Current Selection: ${request.excelContext?.selectedRange || 'Unknown'}
- Active Sheet: ${request.excelContext?.activeSheetName || 'Unknown'}
- Available Worksheets: ${request.excelContext?.worksheets?.map((w: any) => w.name).join(', ') || 'Unknown'}
- Selection Type: ${request.excelContext?.selectionType || 'Unknown'}

TASK APPROACH:
- Handle both simple and complex operations in one comprehensive solution
- Use proper coordinate management to avoid cell targeting bugs
- Implement robust error handling for all scenarios
- Leverage user's current context when relevant

RESPONSE FORMAT:
You must respond with valid JSON:

{
  "understanding": "What I understood from the user's request",
  "code": "COMPLETE Office.js function that accomplishes the task",
  "confidence": 0.95,
  "message": "Explanation of what the code will do"
}

CODE REQUIREMENTS:
1. Generate a COMPLETE async function with Excel.run wrapper
2. Use proper context.sync() after loading properties and before accessing values
3. Handle errors with comprehensive try-catch blocks
4. Use correct cell coordinate management (CRITICAL)
5. Always end with executeExcelOperation().catch(console.error);

CRITICAL: CELL COORDINATE MANAGEMENT
When working with usedRange and accessing cells:

CORRECT - Use usedRange.getCell() for relative coordinates:
\`\`\`javascript
const foundCell = usedRange.getCell(row, col);
foundCell.format.fill.color = "#FF0000";
\`\`\`

CORRECT - Convert to absolute coordinates:
\`\`\`javascript
const startRow = usedRange.getRowIndex();
const startCol = usedRange.getColumnIndex();
const absoluteCell = worksheet.getCell(startRow + row, startCol + col);
\`\`\`

WRONG - Never mix relative and absolute coordinates:
\`\`\`javascript
// DON'T DO THIS - causes wrong cell targeting
const cell = worksheet.getCell(row, col); // Uses relative coords with absolute method
\`\`\`

WORKING EXAMPLES:

BASIC FORMATTING:
\`\`\`javascript
async function executeExcelOperation() {
  return Excel.run(async (context) => {
    try {
      const worksheet = context.workbook.worksheets.getActiveWorksheet();
      const range = worksheet.getRange("A1:B10");
      range.format.fill.color = "#FFFF00";
      await context.sync();
    } catch (error) {
      console.error("Formatting error:", error);
      throw error;
    }
  });
}
executeExcelOperation().catch(console.error);
\`\`\`

SEARCH AND HIGHLIGHT ACROSS ALL WORKSHEETS:
\`\`\`javascript
async function executeExcelOperation() {
  return Excel.run(async (context) => {
    try {
      const worksheets = context.workbook.worksheets;
      worksheets.load("items");
      await context.sync();

      for (const worksheet of worksheets.items) {
        const usedRange = worksheet.getUsedRange();
        if (usedRange) {
          usedRange.load("values");
          await context.sync();

          for (let row = 0; row < usedRange.values.length; row++) {
            for (let col = 0; col < usedRange.values[row].length; col++) {
              const cellValue = usedRange.values[row][col];
              if (cellValue && cellValue.toString().toLowerCase().includes("searchterm")) {
                // CORRECT: Use relative coordinates with usedRange
                const foundCell = usedRange.getCell(row, col);
                foundCell.format.fill.color = "#FFFF00";
              }
            }
          }
        }
      }
      await context.sync();
    } catch (error) {
      console.error("Search error:", error);
      throw error;
    }
  });
}
executeExcelOperation().catch(console.error);
\`\`\`

FIND AND REPLACE TEXT:
\`\`\`javascript
async function executeExcelOperation() {
  return Excel.run(async (context) => {
    try {
      const worksheet = context.workbook.worksheets.getActiveWorksheet();
      const usedRange = worksheet.getUsedRange();
      if (usedRange) {
        usedRange.load("values");
        await context.sync();

        for (let row = 0; row < usedRange.values.length; row++) {
          for (let col = 0; col < usedRange.values[row].length; col++) {
            if (usedRange.values[row][col] === "oldtext") {
              const cell = usedRange.getCell(row, col);
              cell.values = [["newtext"]];
            }
          }
        }
        await context.sync();
      }
    } catch (error) {
      console.error("Replace error:", error);
      throw error;
    }
  });
}
executeExcelOperation().catch(console.error);
\`\`\`

CHART CREATION:
\`\`\`javascript
async function executeExcelOperation() {
  return Excel.run(async (context) => {
    try {
      const worksheet = context.workbook.worksheets.getActiveWorksheet();
      const usedRange = worksheet.getUsedRange();
      if (usedRange) {
        const chart = worksheet.charts.add("columnClustered", usedRange, "auto");
        chart.setPosition("F2", "M15");
        chart.title.text = "Data Chart";
        chart.legend.position = "right";
        await context.sync();
      }
    } catch (error) {
      console.error("Chart creation error:", error);
      throw error;
    }
  });
}
executeExcelOperation().catch(console.error);
\`\`\`

WORKING WITH USER'S CURRENT SELECTION:
\`\`\`javascript
async function executeExcelOperation() {
  return Excel.run(async (context) => {
    try {
      const range = context.workbook.getSelectedRange();
      range.load("address");
      await context.sync();

      range.format.fill.color = "#00FF00";
      await context.sync();
    } catch (error) {
      console.error("Selection error:", error);
      throw error;
    }
  });
}
executeExcelOperation().catch(console.error);
\`\`\`

CONDITIONAL FORMATTING:
\`\`\`javascript
async function executeExcelOperation() {
  return Excel.run(async (context) => {
    try {
      const worksheet = context.workbook.worksheets.getActiveWorksheet();
      const range = worksheet.getUsedRange();
      if (range) {
        const conditionalFormat = range.conditionalFormats.add("cellValue");
        conditionalFormat.cellValue.format.fill.color = "#FF0000";
        conditionalFormat.cellValue.rule = { formula1: "100", operator: "greaterThan" };
        await context.sync();
      }
    } catch (error) {
      console.error("Conditional formatting error:", error);
      throw error;
    }
  });
}
executeExcelOperation().catch(console.error);
\`\`\`

ERROR HANDLING PATTERNS:
- Always wrap operations in try-catch
- Check if ranges exist before using them
- Load required properties before accessing values
- Use meaningful error messages
- Always call context.sync() after loading and before accessing

COORDINATE RULES:
1. usedRange.getCell(row, col) - Use for relative positioning within range
2. worksheet.getCell(absRow, absCol) - Use for absolute worksheet positioning
3. Never mix relative loop indices with absolute getCell() calls
4. Always verify range exists before processing

PERFORMANCE TIPS:
- Load all required properties in one call
- Minimize context.sync() calls
- Process multiple operations before syncing
- Use batch operations when possible

Generate precise, reliable code that executes successfully with proper coordinate management.`;
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
      message: parsed.message || 'AI will execute the operation',
      tokensUsed: {
        input: 0,
        output: 0,
        total: 0
      }
    };

  } catch (error) {
    logger.error('Failed to parse AI response:', error);

    // Fallback: treat entire response as code
    return {
      understanding: 'Parsing failed, executing raw response',
      code: response,
      confidence: 0.5,
      message: 'Raw AI response execution',
      tokensUsed: {
        input: 0,
        output: 0,
        total: 0
      }
    };
  }
}