import OpenAI from 'openai';
import { logger } from '../utils/logger';

// Initialize OpenAI client lazily
let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_API_KEY.startsWith('sk-')) {
      throw new Error('Valid OpenAI API key is required. Please set OPENAI_API_KEY in your .env file.');
    }
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

/**
 * Excel GPT - A system that can perform ANY Excel operation
 * by generating the correct Excel JavaScript API calls
 */
export async function processExcelRequest(
  userMessage: string,
  excelContext: any
): Promise<any> {
  try {
    const client = getOpenAI();

    const systemPrompt = buildExcelGPTPrompt();
    const userPrompt = buildUserPrompt(userMessage, excelContext);

    logger.info('Processing with Excel GPT - Full Excel API access');

    const response = await client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 2000,
    });

    const aiResponse = response.choices[0]?.message?.content;
    if (!aiResponse) {
      throw new Error('No response from Excel GPT');
    }

    const parsed = JSON.parse(aiResponse);
    logger.info('Excel GPT generated actions', {
      actionCount: parsed.actions?.length,
      confidence: parsed.confidence
    });

    return parsed;

  } catch (error) {
    logger.error('Excel GPT error:', error);
    throw new Error(`Failed to process with Excel GPT: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function buildExcelGPTPrompt(): string {
  return `You are Excel GPT, an AI that can perform ANY operation in Microsoft Excel by generating the correct Excel JavaScript API calls.

You have COMPLETE access to the Excel JavaScript API. You can:
- Format cells (colors, fonts, borders, alignment, number formats, etc.)
- Insert formulas (ALL Excel formulas: SUM, VLOOKUP, INDEX/MATCH, IF, COUNTIF, etc.)
- Create charts (Column, Bar, Line, Pie, Scatter, Area, etc.)
- Work with tables, pivot tables, and named ranges
- Apply conditional formatting
- Add data validation
- Insert/delete rows and columns
- Merge/unmerge cells
- Protect/unprotect sheets
- Add comments and notes
- Work with multiple worksheets
- Apply filters and sorting
- And MUCH more!

RESPONSE FORMAT:
You must respond with valid JSON containing Excel API operations:

{
  "understanding": "What I understood from the request",
  "actions": [
    {
      "type": "excel-api",
      "operation": "format|formula|chart|table|data|structure|protection",
      "description": "Human-readable description",
      "code": {
        "method": "getRange|getChart|getTables|etc",
        "target": "A1:B10",
        "properties": {
          // Any Excel API properties
        }
      }
    }
  ],
  "confidence": 0.95,
  "message": "Explanation to user"
}

EXCEL API EXAMPLES:

1. FORMATTING (any style imaginable):
{
  "operation": "format",
  "code": {
    "method": "getRange",
    "target": "A1:B10",
    "properties": {
      "format.fill.color": "#FF0000",
      "format.font.color": "#FFFFFF",
      "format.font.bold": true,
      "format.font.size": 14,
      "format.font.name": "Arial",
      "format.borders.getItem('EdgeBottom').style": "Continuous",
      "format.horizontalAlignment": "Center",
      "numberFormat": "$#,##0.00"
    }
  }
}

2. FORMULAS (any Excel formula):
{
  "operation": "formula",
  "code": {
    "method": "getRange",
    "target": "C1",
    "properties": {
      "formulas": [["=SUM(A1:B10)"]]
    }
  }
}

3. CHARTS (any chart type):
{
  "operation": "chart",
  "code": {
    "method": "addChart",
    "chartType": "ColumnClustered",
    "sourceData": "A1:B10",
    "seriesBy": "Auto"
  }
}

4. CONDITIONAL FORMATTING:
{
  "operation": "format",
  "code": {
    "method": "conditionalFormats.add",
    "target": "A1:A10",
    "type": "CellValue",
    "rule": {
      "formula1": "5",
      "operator": "GreaterThan"
    },
    "format": {
      "fill.color": "#00FF00"
    }
  }
}

KEY PRINCIPLES:
1. You can do ANYTHING that Excel can do
2. Generate the exact Excel JavaScript API calls needed
3. Don't limit yourself to predefined actions
4. Use the full power of the Excel API
5. Be creative and comprehensive in your solutions

IMPORTANT COLOR NOTES:
- For cell background colors, use format.fill.color
- For text colors, use format.font.color
- Always use hex codes (#FF0000) or standard color names
- Common colors: red=#FF0000, blue=#0000FF, green=#00FF00, yellow=#FFFF00, pink=#FFC0CB, orange=#FFA500, purple=#800080

Remember: You have the FULL Excel API at your disposal. If a user asks for something, find a way to do it!`;
}

function buildUserPrompt(userMessage: string, context: any): string {
  // Build intelligent context summary
  let contextSummary = `Current Excel Context:
- Active Sheet: "${context.sheetName || 'Sheet1'}"
- Workbook: "${context.workbookName || 'Book1'}"
- Selected Range: ${context.selectedRange || 'A1'}`;

  // Add selection context
  if (context.selectionType) {
    contextSummary += `\n- Selection Type: ${context.selectionType}`;
  }

  if (context.hint) {
    contextSummary += `\n- Context Hint: ${context.hint}`;
  }

  // Add data structure info
  if (context.dataSize) {
    contextSummary += `\n- Sheet Data Size: ${context.dataSize.rows} rows × ${context.dataSize.columns} columns`;
  }

  if (context.selectionSize) {
    contextSummary += `\n- Selection Size: ${context.selectionSize.rows} rows × ${context.selectionSize.columns} columns`;
  }

  // Add selected data if meaningful
  if (context.selectedData && context.selectedData.length > 0 && context.selectedData.length <= 10) {
    contextSummary += `\n- Selected Data: ${JSON.stringify(context.selectedData)}`;
  } else if (context.selectedData && context.selectedData.length > 10) {
    contextSummary += `\n- Selected Data: Large range (${context.selectedData.length} rows)`;
  }

  // Add special flags
  if (context.maybeHeaders) {
    contextSummary += `\n- Note: Selection may contain headers`;
  }

  if (context.tabColor) {
    contextSummary += `\n- Tab Color: ${context.tabColor}`;
  }

  return `${contextSummary}

User Request: "${userMessage}"

IMPORTANT CONTEXT ANALYSIS:
${analyzeUserIntent(userMessage, context)}

Generate the exact Excel API operations needed to fulfill this request. Be specific and comprehensive.
If the user asks for something complex, break it down into multiple operations.
Use the context hints to make intelligent decisions about ranges and operations.`;
}

function analyzeUserIntent(userMessage: string, context: any): string {
  const message = userMessage.toLowerCase();
  let analysis = '';

  // Analyze based on selection type
  if (context.selectionType === 'row' && message.includes('highlight')) {
    analysis += '- User wants to highlight an entire row\n';
  } else if (context.selectionType === 'column' && (message.includes('sum') || message.includes('total'))) {
    analysis += '- User wants to perform calculations on a column\n';
  } else if (context.maybeHeaders && (message.includes('bold') || message.includes('format'))) {
    analysis += '- User likely wants to format headers\n';
  }

  // Intent analysis
  if (message.includes('chart') || message.includes('graph')) {
    analysis += '- CHART OPERATION: Use selected data as source range\n';
  } else if (message.includes('table')) {
    analysis += '- TABLE OPERATION: Convert selected range to table\n';
  } else if (message.includes('formula') || message.includes('sum') || message.includes('average')) {
    analysis += '- FORMULA OPERATION: Add calculation based on selection\n';
  } else if (message.includes('highlight') || message.includes('color') || message.includes('bold')) {
    analysis += '- FORMATTING OPERATION: Apply visual changes to selection\n';
  } else if (message.includes('sort') || message.includes('filter')) {
    analysis += '- DATA OPERATION: Sort or filter selected range\n';
  }

  // Smart range recommendations
  if (context.selectionType === 'cell' && (message.includes('column') || message.includes('row'))) {
    analysis += `- RECOMMENDATION: Expand target from ${context.selectedRange} to entire row/column\n`;
  }

  if (context.dataSize.rows > 100 && message.includes('all')) {
    analysis += '- WARNING: Large dataset detected, consider performance implications\n';
  }

  return analysis || '- Standard operation on selected range';
}