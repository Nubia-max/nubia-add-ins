import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { MultiIntentService } from '../services/MultiIntentService';

// Enhanced chat controller for Excel add-in with rich context support and multi-intent handling
export const handleChat = async (req: Request, res: Response) => {
  try {
    const { message, context, source } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    logger.info(`Processing chat from ${source || 'unknown'}: ${message.substring(0, 100)}...`);

    // Initialize multi-intent service
    const multiIntentService = new MultiIntentService();

    // Check if message contains multiple intents
    const multiIntentDetection = await multiIntentService.detectMultipleIntents(message);
    logger.info(`Multi-intent detection: ${JSON.stringify(multiIntentDetection)}`);

    if (multiIntentDetection.hasMultiple && multiIntentDetection.confidence > 0.6) {
      // Handle multi-intent request
      logger.info('Processing as multi-intent request');

      const tasks = await multiIntentService.splitIntoTasks(message);
      logger.info(`Split into ${tasks.length} tasks: ${tasks.map(t => t.intent).join(', ')}`);

      // Execute tasks sequentially
      const result = await multiIntentService.executeTasks(tasks, context, async (taskMessage: string, taskContext: any, intent: string) => {
        // Use existing single-intent processing logic
        const enhancedPrompt = buildEnhancedPrompt(taskMessage, taskContext);
        const aiResponse = await processWithAI(enhancedPrompt, taskContext);
        return parseAIResponse(aiResponse, taskContext);
      });

      return res.json({
        success: true,
        type: 'multi-intent',
        tasks: result.tasks,
        message: result.feedback,
        operations: result.operations,
        timestamp: new Date().toISOString()
      });

    } else {
      // Handle single-intent request (existing logic)
      logger.info('Processing as single-intent request');

      // Check for simple greeting first (bypass formula detection)
      const lowerMessage = message.toLowerCase().trim();
      const greetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'];
      if (greetings.includes(lowerMessage)) {
        return res.json({
          success: true,
          type: 'chat',
          message: "Hello! I'm your AI Excel assistant. I can help you with formulas, data analysis, charts, and automation. Try selecting some data and ask me to format it, sum it, or create a chart!",
          timestamp: new Date().toISOString()
        });
      }

      const enhancedPrompt = buildEnhancedPrompt(message, context);
      const aiResponse = await processWithAI(enhancedPrompt, context);
      const parsedResponse = parseAIResponse(aiResponse, context);

      logger.info(`Responding with type: ${parsedResponse.type}`);

      return res.json({
        success: true,
        type: 'single-intent',
        ...parsedResponse,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    logger.error('Chat controller error:', error);
    return res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
};

/**
 * Build enhanced prompt with Excel context
 */
function buildEnhancedPrompt(userMessage: string, context: any): string {
  let systemPrompt = `You are Nubia, an AI Excel assistant. You help users with Excel tasks, analysis, and automation.

IMPORTANT: You can respond in two ways:
1. Chat response: Provide helpful text responses
2. Excel actions: Perform actions in Excel by responding with specific JSON format

For Excel actions, respond with:
{
  "type": "action",
  "action": "actionName",
  "args": { "address": "A1", "value": "example" }
}

Available actions:
- writeToCell: { "address": "A1", "value": "text or number", "sheet": "optional" }
- formatRange: { "range": "A1:B5", "style": {"fillColor": "#ff0000", "bold": true}, "sheet": "optional" }
- insertChart: { "range": "A1:B5", "type": "ColumnClustered", "title": "Chart Title", "sheet": "optional" }
- insertFormula: { "address": "A1", "formula": "=SUM(B1:B10)", "sheet": "optional" }
- insertData: { "startAddress": "A1", "data": [["Header1", "Header2"], ["Value1", "Value2"]], "sheet": "optional" }
- clearRange: { "range": "A1:B5", "clearType": "All", "sheet": "optional" }

Chart Types Available:
- ColumnClustered, ColumnStacked, BarClustered, BarStacked
- Line, LineMarkers, LineMarkersStacked
- Pie, PieExploded3D, Doughnut
- XYScatter, XYScatterLines, XYScatterLinesNoMarkers

`;

  // Add Excel context if available
  if (context) {
    if (context.sheetName) {
      systemPrompt += `\nCurrent Excel Context:`;
      systemPrompt += `\n- Active Sheet: ${context.sheetName}`;
    }

    if (context.selectedRange) {
      systemPrompt += `\n- Selected Range: ${context.selectedRange}`;
    }

    if (context.dataPreview && Array.isArray(context.dataPreview)) {
      systemPrompt += `\n- Selected Data Preview:`;
      const preview = context.dataPreview.slice(0, 5); // First 5 rows
      preview.forEach((row: any[], index: number) => {
        if (Array.isArray(row)) {
          systemPrompt += `\n  Row ${index + 1}: [${row.join(', ')}]`;
        }
      });
      if (context.dataPreview.length > 5) {
        systemPrompt += `\n  ... (${context.dataPreview.length - 5} more rows)`;
      }
    }

    if (context.workbook && context.workbook.sheetNames) {
      systemPrompt += `\n- Available Sheets: ${context.workbook.sheetNames.join(', ')}`;
    }

    if (context.usedRange) {
      systemPrompt += `\n- Sheet Used Range: ${context.usedRange.address} (${context.usedRange.rowCount}x${context.usedRange.columnCount})`;
    }
  }

  systemPrompt += `\n\nUser Message: ${userMessage}`;

  return systemPrompt;
}

/**
 * Process message with AI - Enhanced formula support
 */
async function processWithAI(prompt: string, context: any): Promise<string> {
  const message = prompt.toLowerCase();

  // Handle simple greetings first
  const greetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'];
  if (greetings.some(greeting => message.trim() === greeting)) {
    return "Hello! I'm your AI Excel assistant. I can help you with formulas, data analysis, charts, and automation. Try selecting some data and ask me to format it, sum it, or create a chart!";
  }

  // Enhanced formula detection
  const formulaResult = detectAndGenerateFormula(message, context);
  if (formulaResult) {
    return JSON.stringify(formulaResult);
  }

  // Chart detection and generation
  const chartResult = detectAndGenerateChart(message, context);
  if (chartResult) {
    return JSON.stringify(chartResult);
  }

  // Other Excel operations
  if (message.includes('set') && message.includes('cell') || message.includes('write') || message.includes('put')) {
    const cellMatch = message.match(/([a-z]+\d+)/i);
    const numberMatch = message.match(/(\d+)/);

    if (cellMatch && numberMatch) {
      return JSON.stringify({
        type: "action",
        action: "writeToCell",
        args: {
          address: cellMatch[0].toUpperCase(),
          value: parseInt(numberMatch[0])
        }
      });
    }
  }

  if (message.includes('highlight') || message.includes('format') || message.includes('color')) {
    if (context && context.selectedRange) {
      return JSON.stringify({
        type: "action",
        action: "formatRange",
        args: {
          range: context.selectedRange,
          style: {
            fillColor: "#ffff00",
            bold: true
          }
        }
      });
    }
  }

  if (message.includes('clear') || message.includes('delete') || message.includes('remove')) {
    if (context && context.selectedRange) {
      return JSON.stringify({
        type: "action",
        action: "clearRange",
        args: {
          range: context.selectedRange,
          clearType: "All"
        }
      });
    }
  }

  // Default chat response
  if (context && context.selectedRange) {
    return `I can see you have selected ${context.selectedRange} in sheet "${context.sheetName}". ${getContextualSuggestion(context)}`;
  }

  return "I'm Nubia, your Excel AI assistant! I can help you with formulas, formatting, charts, and data analysis. Try selecting some data and ask me to format it, sum it, or create a chart!";
}

/**
 * Parse AI response to determine if it's a chat message or Excel action
 */
function parseAIResponse(response: string, context: any): any {
  try {
    // Try to parse as JSON (Excel action)
    const parsed = JSON.parse(response);
    if (parsed.type === 'action' && parsed.action && parsed.args) {
      return parsed;
    }
  } catch (e) {
    // Not JSON, treat as chat message
  }

  // Return as chat message
  return {
    type: 'chat',
    message: response
  };
}

/**
 * Get next empty cell for formulas
 */
function getNextEmptyCell(context: any): string {
  if (!context || !context.selectedRange) return 'A1';

  // Simple logic: if selection is A1:A5, return A6
  const match = context.selectedRange.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
  if (match) {
    const col = match[3];
    const endRow = parseInt(match[4]);
    return `${col}${endRow + 1}`;
  }

  return 'A1';
}

/**
 * Enhanced formula detection and generation
 */
function detectAndGenerateFormula(message: string, context: any): any | null {
  const keywords: Record<string, string[]> = {
    sum: ['sum', 'total', 'add up', 'add together', 'aggregate', 'sum up'],
    average: ['average', 'mean', 'avg', 'average of'],
    count: ['count', 'number of', 'how many', 'count cells'],
    max: ['maximum', 'max', 'highest', 'largest', 'biggest', 'greatest'],
    min: ['minimum', 'min', 'lowest', 'smallest', 'least'],
    growth: ['growth', 'increase', 'change', 'difference', 'percent change', 'percentage change', 'yoy', 'year over year'],
    calculate: ['calculate', 'compute', 'formula', 'equation'],
    percent: ['percent', 'percentage', '%', 'percent of', 'percentage of'],
    multiply: ['multiply', 'times', 'product', '*', 'multiplication'],
    divide: ['divide', 'divided by', 'ratio', '/', 'division'],
    if: ['condition', 'conditional', 'when', 'check if', 'if statement'],
    lookup: ['lookup', 'vlookup', 'find', 'search for', 'match'],
    concatenate: ['concatenate', 'combine', 'join', 'merge text', 'concat'],
    date: ['today', 'now', 'current date', 'date', 'year', 'month', 'day'],
    round: ['round', 'round up', 'round down', 'decimal places']
  };

  // Convert message to lowercase for case-insensitive matching
  const lowerMessage = message.toLowerCase();

  // Check for formula keywords with priority handling
  const formulaType = detectFormulaType(lowerMessage, keywords);
  if (!formulaType) return null;

  // Get target location
  const targetLocation = determineFormulaLocation(message, context);
  if (!targetLocation) {
    return {
      type: "chat",
      message: "I couldn't determine where to place the formula. Please specify a cell location or select a range first."
    };
  }

  // Generate formula and explanation
  const formulaData = generateFormulaAndExplanation(formulaType, lowerMessage, context, targetLocation);
  if (!formulaData) {
    return {
      type: "chat",
      message: "I couldn't determine the right formula for your request. Please provide more details about what you want to calculate."
    };
  }

  // Validate formula before returning
  if (!validateExcelFormula(formulaData.formula)) {
    return {
      type: "chat",
      message: `I generated a formula but it appears to be invalid: ${formulaData.formula}. Please check your cell references and try again.`
    };
  }

  // Return dual action/chat response
  return {
    actions: [
      {
        type: "action",
        action: "insertFormula",
        args: {
          address: formulaData.address,
          formula: formulaData.formula,
          sheet: formulaData.sheet
        }
      },
      {
        type: "chat",
        message: formulaData.explanation
      }
    ]
  };
}

/**
 * Detect formula type from message with priority handling
 */
function detectFormulaType(message: string, keywords: Record<string, string[]>): string | null {
  // Priority order - more specific formulas first to handle ambiguity
  const priorityOrder = [
    'growth', 'percent', 'lookup', 'concatenate', 'date', 'round',
    'if', 'multiply', 'divide', 'average', 'count', 'max', 'min', 'sum', 'calculate'
  ];

  // Check each type in priority order with word boundary matching
  for (const type of priorityOrder) {
    const terms = keywords[type];
    if (terms && terms.some((term: string) => {
      // Use word boundaries for better matching
      const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return regex.test(message);
    })) {
      return type;
    }
  }

  return null;
}

/**
 * Determine where to place the formula
 */
function determineFormulaLocation(message: string, context: any): any {
  // Check for explicit cell reference
  const cellMatch = message.match(/\b([A-Z]+\d+)\b/i);
  if (cellMatch) {
    return {
      type: 'explicit',
      address: cellMatch[0].toUpperCase(),
      sheet: context?.sheetName
    };
  }

  // Check for "next column" or "next row"
  if (message.includes('next column') || message.includes('in the next column')) {
    return {
      type: 'next_column',
      context: context
    };
  }

  if (message.includes('next row') || message.includes('below')) {
    return {
      type: 'next_row',
      context: context
    };
  }

  // Check for different sheet reference with more flexible matching
  const sheetMatches = [
    message.match(/\b(put|place|insert)\s+(in|on|to)\s+([a-zA-Z0-9\s]+)\s+(sheet|tab)\b/i),
    message.match(/\b(sheet|tab)\s*([a-zA-Z0-9\s]+)\b/i),
    message.match(/\b([a-zA-Z0-9\s]+)\s+(sheet|tab)\b/i)
  ];

  for (const sheetMatch of sheetMatches) {
    if (sheetMatch && context?.workbook?.sheetNames) {
      const sheetNamePart = sheetMatch[3] || sheetMatch[2] || sheetMatch[1];
      const targetSheet = context.workbook.sheetNames.find((name: string) =>
        name.toLowerCase().includes(sheetNamePart.toLowerCase().trim())
      );
      if (targetSheet) {
        return {
          type: 'other_sheet',
          sheet: targetSheet,
          address: getDefaultCellForSheet()
        };
      }
    }
  }

  // Default: use context or fallback
  if (context?.selectedRange) {
    return {
      type: 'context_based',
      context: context
    };
  }

  return null;
}

/**
 * Generate Excel formula and explanation
 */
function generateFormulaAndExplanation(formulaType: string, message: string, context: any, targetLocation: any): any {
  const sourceRange = getSourceRange(message, context);

  switch (formulaType) {
    case 'sum':
      return generateSumFormula(sourceRange, targetLocation, context);

    case 'average':
      return generateAverageFormula(sourceRange, targetLocation, context);

    case 'count':
      return generateCountFormula(sourceRange, targetLocation, context);

    case 'max':
      return generateMaxFormula(sourceRange, targetLocation, context);

    case 'min':
      return generateMinFormula(sourceRange, targetLocation, context);

    case 'growth':
      return generateGrowthFormula(message, sourceRange, targetLocation, context);

    case 'percent':
      return generatePercentFormula(message, sourceRange, targetLocation, context);

    case 'multiply':
      return generateMultiplyFormula(message, sourceRange, targetLocation, context);

    case 'divide':
      return generateDivideFormula(message, sourceRange, targetLocation, context);

    case 'if':
      return generateIfFormula(message, sourceRange, targetLocation, context);

    case 'lookup':
      return generateLookupFormula(message, sourceRange, targetLocation, context);

    case 'concatenate':
      return generateConcatenateFormula(message, sourceRange, targetLocation, context);

    case 'date':
      return generateDateFormula(message, sourceRange, targetLocation, context);

    case 'round':
      return generateRoundFormula(message, sourceRange, targetLocation, context);

    default:
      return null;
  }
}

/**
 * Get source range for formula
 */
function getSourceRange(message: string, context: any): string {
  // Check for explicit sheet!range reference (e.g., "Sheet2!A1:A10")
  const sheetRangeMatch = message.match(/\b([a-zA-Z0-9\s]+)!([A-Z]+\d+:[A-Z]+\d+)\b/i);
  if (sheetRangeMatch) {
    return sheetRangeMatch[0];
  }

  // Check for explicit range reference without sheet
  const rangeMatch = message.match(/\b([A-Z]+\d+:[A-Z]+\d+)\b/i);
  if (rangeMatch) {
    return rangeMatch[0];
  }

  // Check for natural language sheet reference
  const naturalSheetMatch = message.match(/\b(from|in|on)\s+([a-zA-Z0-9\s]+)\s+(sheet|tab)\b/i);
  if (naturalSheetMatch && context?.workbook?.sheetNames) {
    const targetSheet = context.workbook.sheetNames.find((name: string) =>
      name.toLowerCase().includes(naturalSheetMatch[2].toLowerCase().trim())
    );
    if (targetSheet) {
      const defaultRange = context?.selectedRange || 'A1:A10';
      return `${targetSheet}!${defaultRange}`;
    }
  }

  // Use current selection with current sheet
  if (context?.selectedRange) {
    // Add sheet reference if we're working across sheets
    if (context.sheetName && message.includes('sheet')) {
      return `${context.sheetName}!${context.selectedRange}`;
    }
    return context.selectedRange;
  }

  return 'A1:A10'; // Fallback
}

/**
 * Generate SUM formula
 */
function generateSumFormula(sourceRange: string, targetLocation: any, context: any): any {
  const address = getTargetAddress(targetLocation, context);
  const formula = `=SUM(${sourceRange})`;

  return {
    address: address.cell,
    formula: formula,
    sheet: address.sheet,
    explanation: `I inserted ${formula} in ${address.sheet ? address.sheet + '!' : ''}${address.cell}. This formula adds up all the values in the range ${sourceRange}.`
  };
}

/**
 * Generate AVERAGE formula
 */
function generateAverageFormula(sourceRange: string, targetLocation: any, context: any): any {
  const address = getTargetAddress(targetLocation, context);
  const formula = `=AVERAGE(${sourceRange})`;

  return {
    address: address.cell,
    formula: formula,
    sheet: address.sheet,
    explanation: `I inserted ${formula} in ${address.sheet ? address.sheet + '!' : ''}${address.cell}. This calculates the average of all values in ${sourceRange}.`
  };
}

/**
 * Generate COUNT formula
 */
function generateCountFormula(sourceRange: string, targetLocation: any, context: any): any {
  const address = getTargetAddress(targetLocation, context);
  const formula = `=COUNT(${sourceRange})`;

  return {
    address: address.cell,
    formula: formula,
    sheet: address.sheet,
    explanation: `I inserted ${formula} in ${address.sheet ? address.sheet + '!' : ''}${address.cell}. This counts the number of cells containing numbers in ${sourceRange}.`
  };
}

/**
 * Generate MAX formula
 */
function generateMaxFormula(sourceRange: string, targetLocation: any, context: any): any {
  const address = getTargetAddress(targetLocation, context);
  const formula = `=MAX(${sourceRange})`;

  return {
    address: address.cell,
    formula: formula,
    sheet: address.sheet,
    explanation: `I inserted ${formula} in ${address.sheet ? address.sheet + '!' : ''}${address.cell}. This finds the highest value in ${sourceRange}.`
  };
}

/**
 * Generate MIN formula
 */
function generateMinFormula(sourceRange: string, targetLocation: any, context: any): any {
  const address = getTargetAddress(targetLocation, context);
  const formula = `=MIN(${sourceRange})`;

  return {
    address: address.cell,
    formula: formula,
    sheet: address.sheet,
    explanation: `I inserted ${formula} in ${address.sheet ? address.sheet + '!' : ''}${address.cell}. This finds the lowest value in ${sourceRange}.`
  };
}

/**
 * Generate growth/change formula
 */
function generateGrowthFormula(message: string, sourceRange: string, targetLocation: any, context: any): any {
  const address = getTargetAddress(targetLocation, context);

  // Try to detect current vs previous pattern
  if (message.includes('year over year') || message.includes('yoy')) {
    // Assume we have current year and previous year columns
    const currentCol = getColumnFromRange(sourceRange);
    const prevCol = getPreviousColumn(currentCol);
    const row = getRowFromRange(sourceRange);

    const formula = `=(${currentCol}${row}/${prevCol}${row}-1)*100`;
    return {
      address: address.cell,
      formula: formula,
      sheet: address.sheet,
      explanation: `I inserted a year-over-year growth formula in ${address.cell}. This calculates the percentage change between current year (${currentCol}${row}) and previous year (${prevCol}${row}).`
    };
  }

  // Generic percentage change formula
  const formula = `=(${sourceRange.split(':')[1]}/${sourceRange.split(':')[0]}-1)*100`;
  return {
    address: address.cell,
    formula: formula,
    sheet: address.sheet,
    explanation: `I inserted a growth calculation formula in ${address.cell}. This shows the percentage change from the first to last value in your selection.`
  };
}

/**
 * Generate percentage formula
 */
function generatePercentFormula(message: string, sourceRange: string, targetLocation: any, context: any): any {
  const address = getTargetAddress(targetLocation, context);

  // Simple percentage of total
  const formula = `=${sourceRange}/SUM(${expandRangeToColumn(sourceRange)})*100`;

  return {
    address: address.cell,
    formula: formula,
    sheet: address.sheet,
    explanation: `I inserted a percentage formula in ${address.cell}. This calculates what percentage each value represents of the total.`
  };
}

/**
 * Generate MULTIPLY formula
 */
function generateMultiplyFormula(message: string, sourceRange: string, targetLocation: any, context: any): any {
  const address = getTargetAddress(targetLocation, context);

  // Try to detect two ranges or cells to multiply
  const ranges = message.match(/([A-Z]+\d+(?::[A-Z]+\d+)?)/gi);

  if (ranges && ranges.length >= 2) {
    const formula = `=${ranges[0]}*${ranges[1]}`;
    return {
      address: address.cell,
      formula: formula,
      sheet: address.sheet,
      explanation: `I created a multiplication formula in ${address.cell}: ${formula}. This multiplies ${ranges[0]} by ${ranges[1]}.`
    };
  }

  // Default to multiplying selection by a factor
  const numberMatch = message.match(/(\d+(?:\.\d+)?)/);
  const factor = numberMatch ? numberMatch[1] : '2';
  const formula = `=${sourceRange}*${factor}`;

  return {
    address: address.cell,
    formula: formula,
    sheet: address.sheet,
    explanation: `I created a multiplication formula in ${address.cell}: ${formula}. This multiplies your selected range by ${factor}.`
  };
}

/**
 * Generate DIVIDE formula
 */
function generateDivideFormula(message: string, sourceRange: string, targetLocation: any, context: any): any {
  const address = getTargetAddress(targetLocation, context);

  // Try to detect two ranges or cells to divide
  const ranges = message.match(/([A-Z]+\d+(?::[A-Z]+\d+)?)/gi);

  if (ranges && ranges.length >= 2) {
    const formula = `=${ranges[0]}/${ranges[1]}`;
    return {
      address: address.cell,
      formula: formula,
      sheet: address.sheet,
      explanation: `I created a division formula in ${address.cell}: ${formula}. This divides ${ranges[0]} by ${ranges[1]}.`
    };
  }

  // Default to dividing selection by a number
  const numberMatch = message.match(/(\d+(?:\.\d+)?)/);
  const divisor = numberMatch ? numberMatch[1] : '2';
  const formula = `=${sourceRange}/${divisor}`;

  return {
    address: address.cell,
    formula: formula,
    sheet: address.sheet,
    explanation: `I created a division formula in ${address.cell}: ${formula}. This divides your selected range by ${divisor}.`
  };
}

/**
 * Generate IF formula
 */
function generateIfFormula(message: string, sourceRange: string, targetLocation: any, context: any): any {
  const address = getTargetAddress(targetLocation, context);

  // Try to detect condition keywords
  let condition = `${sourceRange}>0`;
  let trueValue = '"Yes"';
  let falseValue = '"No"';

  if (message.includes('greater than') || message.includes('>')) {
    const numberMatch = message.match(/greater than (\d+)/i) || message.match(/>(\d+)/);
    if (numberMatch) {
      condition = `${sourceRange}>${numberMatch[1]}`;
      trueValue = '"Above Threshold"';
      falseValue = '"Below Threshold"';
    }
  }

  if (message.includes('equal') || message.includes('=')) {
    trueValue = '"Match"';
    falseValue = '"No Match"';
  }

  const formula = `=IF(${condition},${trueValue},${falseValue})`;

  return {
    address: address.cell,
    formula: formula,
    sheet: address.sheet,
    explanation: `I created a conditional formula in ${address.cell}: ${formula}. This checks if ${condition} and returns ${trueValue} if true, ${falseValue} if false.`
  };
}

/**
 * Generate VLOOKUP formula
 */
function generateLookupFormula(message: string, sourceRange: string, targetLocation: any, context: any): any {
  const address = getTargetAddress(targetLocation, context);

  // Basic VLOOKUP template
  const lookupValue = sourceRange.split(':')[0] || 'A1';
  const tableArray = context?.usedRange?.address || 'A:D';
  const colIndex = '2';
  const exactMatch = 'FALSE';

  const formula = `=VLOOKUP(${lookupValue},${tableArray},${colIndex},${exactMatch})`;

  return {
    address: address.cell,
    formula: formula,
    sheet: address.sheet,
    explanation: `I created a VLOOKUP formula in ${address.cell}: ${formula}. This searches for ${lookupValue} in the first column of ${tableArray} and returns the value from column ${colIndex}.`
  };
}

/**
 * Generate CONCATENATE formula
 */
function generateConcatenateFormula(message: string, sourceRange: string, targetLocation: any, context: any): any {
  const address = getTargetAddress(targetLocation, context);

  // Try to detect multiple cells to concatenate
  const cellMatches = message.match(/([A-Z]+\d+)/gi);

  if (cellMatches && cellMatches.length >= 2) {
    const formula = `=CONCATENATE(${cellMatches.join(',')})`;
    return {
      address: address.cell,
      formula: formula,
      sheet: address.sheet,
      explanation: `I created a concatenation formula in ${address.cell}: ${formula}. This combines the text from ${cellMatches.join(', ')}.`
    };
  }

  // Default to concatenating range with space
  const formula = `=CONCATENATE(${sourceRange}," ")`;

  return {
    address: address.cell,
    formula: formula,
    sheet: address.sheet,
    explanation: `I created a concatenation formula in ${address.cell}: ${formula}. This combines text from your selection with spaces.`
  };
}

/**
 * Generate DATE formula
 */
function generateDateFormula(message: string, sourceRange: string, targetLocation: any, context: any): any {
  const address = getTargetAddress(targetLocation, context);

  let formula = '=TODAY()';
  let explanation = 'I inserted the TODAY() function';

  if (message.includes('now') || message.includes('current time')) {
    formula = '=NOW()';
    explanation = 'I inserted the NOW() function';
  } else if (message.includes('year')) {
    formula = '=YEAR(TODAY())';
    explanation = 'I inserted a formula to get the current year';
  } else if (message.includes('month')) {
    formula = '=MONTH(TODAY())';
    explanation = 'I inserted a formula to get the current month';
  } else if (message.includes('day')) {
    formula = '=DAY(TODAY())';
    explanation = 'I inserted a formula to get the current day';
  }

  return {
    address: address.cell,
    formula: formula,
    sheet: address.sheet,
    explanation: `${explanation} in ${address.cell}: ${formula}. This returns the current date/time information.`
  };
}

/**
 * Generate ROUND formula
 */
function generateRoundFormula(message: string, sourceRange: string, targetLocation: any, context: any): any {
  const address = getTargetAddress(targetLocation, context);

  // Try to detect decimal places
  const decimalMatch = message.match(/(\d+) decimal/i);
  const decimals = decimalMatch ? decimalMatch[1] : '2';

  let formula = `=ROUND(${sourceRange},${decimals})`;
  let explanation = `rounds to ${decimals} decimal places`;

  if (message.includes('round up')) {
    formula = `=ROUNDUP(${sourceRange},${decimals})`;
    explanation = `rounds up to ${decimals} decimal places`;
  } else if (message.includes('round down')) {
    formula = `=ROUNDDOWN(${sourceRange},${decimals})`;
    explanation = `rounds down to ${decimals} decimal places`;
  }

  return {
    address: address.cell,
    formula: formula,
    sheet: address.sheet,
    explanation: `I created a rounding formula in ${address.cell}: ${formula}. This ${explanation}.`
  };
}

/**
 * Get target address for formula placement
 */
function getTargetAddress(targetLocation: any, context: any): any {
  switch (targetLocation.type) {
    case 'explicit':
      return { cell: targetLocation.address, sheet: targetLocation.sheet };

    case 'next_column':
      const nextCol = getNextColumn(context);
      return { cell: nextCol, sheet: context?.sheetName };

    case 'next_row':
      const nextRow = getNextRow(context);
      return { cell: nextRow, sheet: context?.sheetName };

    case 'other_sheet':
      return { cell: targetLocation.address, sheet: targetLocation.sheet };

    case 'context_based':
    default:
      return { cell: getNextEmptyCell(context), sheet: context?.sheetName };
  }
}

/**
 * Get next column from current selection
 */
function getNextColumn(context: any): string {
  if (!context?.selectedRange) return 'B1';

  // Handle range like A1:A10 - get next column at first row
  const rangeMatch = context.selectedRange.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
  if (rangeMatch) {
    const endCol = rangeMatch[3];
    const startRow = rangeMatch[2];
    const nextCol = String.fromCharCode(endCol.charCodeAt(endCol.length - 1) + 1);
    return `${nextCol}${startRow}`;
  }

  // Handle single cell like A1
  const cellMatch = context.selectedRange.match(/([A-Z]+)(\d+)/);
  if (cellMatch) {
    const col = cellMatch[1];
    const row = cellMatch[2];
    const nextCol = String.fromCharCode(col.charCodeAt(col.length - 1) + 1);
    return `${nextCol}${row}`;
  }

  return 'B1';
}

/**
 * Get next row from current selection
 */
function getNextRow(context: any): string {
  if (!context?.selectedRange) return 'A2';

  // Handle range like A1:C10 - get next row at first column
  const rangeMatch = context.selectedRange.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
  if (rangeMatch) {
    const startCol = rangeMatch[1];
    const endRow = parseInt(rangeMatch[4]);
    return `${startCol}${endRow + 1}`;
  }

  // Handle single cell like A1
  const cellMatch = context.selectedRange.match(/([A-Z]+)(\d+)/);
  if (cellMatch) {
    const col = cellMatch[1];
    const row = parseInt(cellMatch[2]);
    return `${col}${row + 1}`;
  }

  return 'A2';
}

/**
 * Helper functions for range manipulation
 */
function getColumnFromRange(range: string): string {
  const match = range.match(/([A-Z]+)/);
  return match ? match[1] : 'A';
}

function getRowFromRange(range: string): string {
  const match = range.match(/(\d+)/);
  return match ? match[1] : '1';
}

function getPreviousColumn(col: string): string {
  if (col === 'A') return 'A';
  return String.fromCharCode(col.charCodeAt(0) - 1);
}

function expandRangeToColumn(range: string): string {
  // Convert B2:B10 to B:B for total column calculation
  const colMatch = range.match(/([A-Z]+)/);
  return colMatch ? `${colMatch[1]}:${colMatch[1]}` : range;
}

function getDefaultCellForSheet(): string {
  return 'A1';
}

/**
 * Validate Excel formula syntax
 */
function validateExcelFormula(formula: string): boolean {
  try {
    // Basic validation checks
    if (!formula || typeof formula !== 'string') return false;

    // Must start with =
    if (!formula.startsWith('=')) return false;

    // Check for balanced parentheses
    const openParens = (formula.match(/\(/g) || []).length;
    const closeParens = (formula.match(/\)/g) || []).length;
    if (openParens !== closeParens) return false;

    // Check for valid cell references (basic regex)
    const cellRefPattern = /\b[A-Z]+\d+\b/;
    const rangePattern = /\b[A-Z]+\d+:[A-Z]+\d+\b/;
    const sheetRefPattern = /\b[a-zA-Z0-9\s]+![A-Z]+\d+/;

    // Check for common Excel functions
    const excelFunctions = [
      'SUM', 'AVERAGE', 'COUNT', 'MAX', 'MIN', 'IF', 'VLOOKUP',
      'CONCATENATE', 'TODAY', 'NOW', 'YEAR', 'MONTH', 'DAY',
      'ROUND', 'ROUNDUP', 'ROUNDDOWN'
    ];

    const upperFormula = formula.toUpperCase();
    const hasValidFunction = excelFunctions.some(func => upperFormula.includes(func));
    const hasValidReference = cellRefPattern.test(formula) || rangePattern.test(formula) || sheetRefPattern.test(formula);
    const hasBasicMath = /[+\-*/]/.test(formula);

    // Formula should have either a function, valid reference, or basic math
    return hasValidFunction || hasValidReference || hasBasicMath;

  } catch (error) {
    return false;
  }
}

/**
 * Detect and generate chart from natural language
 */
function detectAndGenerateChart(message: string, context: any): any | null {
  const chartKeywords = [
    'chart', 'plot', 'graph', 'visualize', 'visual', 'diagram',
    'make a chart', 'create a chart', 'insert chart', 'add chart'
  ];

  const lowerMessage = message.toLowerCase();

  // Check if message contains chart intent with word boundaries
  const hasChartIntent = chartKeywords.some(keyword => {
    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return regex.test(lowerMessage);
  });
  if (!hasChartIntent) return null;

  // Detect chart type
  const chartType = detectChartType(lowerMessage);

  // Validate data selection
  if (!context?.selectedRange && !context?.dataPreview) {
    return {
      type: "chat",
      message: "Please select some data first to create a chart. I need to know which data you'd like to visualize."
    };
  }

  // Get chart range and sheet
  const chartRange = getChartRange(lowerMessage, context);
  const targetSheet = getChartTargetSheet(lowerMessage, context);

  // Generate chart title
  const chartTitle = generateChartTitle(lowerMessage, context, chartType);

  // Generate insights
  const insights = generateChartInsights(context, chartType, chartTitle);

  // Return dual action/chat response
  return {
    actions: [
      {
        type: "action",
        action: "insertChart",
        args: {
          range: chartRange,
          type: chartType,
          title: chartTitle,
          sheet: targetSheet
        }
      },
      {
        type: "chat",
        message: insights
      }
    ]
  };
}

/**
 * Detect chart type from message
 */
function detectChartType(message: string): string {
  const chartTypeMap: Record<string, string[]> = {
    'Line': ['line', 'trend', 'over time', 'timeline', 'progression'],
    'LineMarkers': ['line chart', 'line graph', 'line plot'],
    'BarClustered': ['bar', 'horizontal bar', 'bar chart'],
    'ColumnClustered': ['column', 'vertical bar', 'column chart'],
    'Pie': ['pie', 'pie chart', 'proportion', 'percentage breakdown'],
    'PieExploded3D': ['pie 3d', 'exploded pie'],
    'XYScatter': ['scatter', 'scatter plot', 'correlation', 'xy plot'],
    'XYScatterLines': ['scatter line', 'scatter with lines']
  };

  // Priority order for chart types
  const priorityOrder = [
    'PieExploded3D', 'LineMarkers', 'XYScatterLines', 'XYScatter',
    'BarClustered', 'ColumnClustered', 'Pie', 'Line'
  ];

  for (const chartType of priorityOrder) {
    const keywords = chartTypeMap[chartType];
    if (keywords && keywords.some(keyword => {
      const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return regex.test(message);
    })) {
      return chartType;
    }
  }

  // Default fallback
  return 'ColumnClustered';
}

/**
 * Get chart data range
 */
function getChartRange(message: string, context: any): string {
  // Check for explicit range reference
  const rangeMatch = message.match(/\b([A-Z]+\d+:[A-Z]+\d+)\b/i);
  if (rangeMatch) {
    return rangeMatch[0];
  }

  // Check for sheet-specific range
  const sheetRangeMatch = message.match(/\b([a-zA-Z0-9\s]+)!([A-Z]+\d+:[A-Z]+\d+)\b/i);
  if (sheetRangeMatch) {
    return sheetRangeMatch[0];
  }

  // Use current selection
  if (context?.selectedRange) {
    return context.selectedRange;
  }

  // Fallback to used range if available
  if (context?.usedRange?.address) {
    return context.usedRange.address;
  }

  return 'A1:B10'; // Final fallback
}

/**
 * Get target sheet for chart
 */
function getChartTargetSheet(message: string, context: any): string | undefined {
  // Check for explicit sheet reference
  const sheetMatches = [
    message.match(/\b(put|place|insert)\s+(in|on|to)\s+([a-zA-Z0-9\s]+)\s+(sheet|tab)\b/i),
    message.match(/\b(sheet|tab)\s*([a-zA-Z0-9\s]+)\b/i),
    message.match(/\b([a-zA-Z0-9\s]+)\s+(sheet|tab)\b/i)
  ];

  for (const sheetMatch of sheetMatches) {
    if (sheetMatch && context?.workbook?.sheetNames) {
      const sheetNamePart = sheetMatch[3] || sheetMatch[2] || sheetMatch[1];
      const targetSheet = context.workbook.sheetNames.find((name: string) =>
        name.toLowerCase().includes(sheetNamePart.toLowerCase().trim())
      );
      if (targetSheet) {
        return targetSheet;
      }
    }
  }

  // Return current sheet or undefined
  return context?.sheetName;
}

/**
 * Generate chart title from context
 */
function generateChartTitle(message: string, context: any, chartType: string): string {
  // Check for explicit title in message
  const titleMatch = message.match(/title[d]?\s*["']([^"']+)["']/i);
  if (titleMatch) {
    return titleMatch[1];
  }

  const namedMatch = message.match(/called\s+["']([^"']+)["']/i);
  if (namedMatch) {
    return namedMatch[1];
  }

  // Generate title from data context
  if (context?.dataPreview && Array.isArray(context.dataPreview) && context.dataPreview.length > 0) {
    const firstRow = context.dataPreview[0];
    if (Array.isArray(firstRow) && firstRow.length >= 2) {
      return `${firstRow[1]} by ${firstRow[0]}`;
    }
  }

  // Generate based on chart type and context
  const sheetName = context?.sheetName || 'Data';
  const chartTypeWord = chartType.includes('Line') ? 'Trend' :
                       chartType.includes('Pie') ? 'Breakdown' :
                       chartType.includes('Scatter') ? 'Correlation' : 'Analysis';

  return `${sheetName} ${chartTypeWord}`;
}

/**
 * Generate insights from chart data
 */
function generateChartInsights(context: any, chartType: string, chartTitle: string): string {
  let baseMessage = `I created a ${getChartTypeDescription(chartType)} titled "${chartTitle}".`;

  // Add data-driven insights if we have preview data
  if (context?.dataPreview && Array.isArray(context.dataPreview) && context.dataPreview.length > 1) {
    const dataInsights = analyzeDataForInsights(context.dataPreview, chartType);
    if (dataInsights) {
      baseMessage += ` ${dataInsights}`;
    }
  }

  // Add contextual suggestions
  const suggestions = getChartSuggestions(chartType, context);
  if (suggestions) {
    baseMessage += ` ${suggestions}`;
  }

  return baseMessage;
}

/**
 * Get human-readable chart type description
 */
function getChartTypeDescription(chartType: string): string {
  const descriptions: Record<string, string> = {
    'ColumnClustered': 'column chart',
    'ColumnStacked': 'stacked column chart',
    'BarClustered': 'bar chart',
    'BarStacked': 'stacked bar chart',
    'Line': 'line chart',
    'LineMarkers': 'line chart with markers',
    'LineMarkersStacked': 'stacked line chart',
    'Pie': 'pie chart',
    'PieExploded3D': '3D exploded pie chart',
    'Doughnut': 'doughnut chart',
    'XYScatter': 'scatter plot',
    'XYScatterLines': 'scatter plot with lines',
    'XYScatterLinesNoMarkers': 'scatter plot with connecting lines'
  };

  return descriptions[chartType] || 'chart';
}

/**
 * Analyze data to generate insights
 */
function analyzeDataForInsights(dataPreview: any[][], chartType: string): string | null {
  try {
    if (dataPreview.length < 2) return null;

    // Skip header row, analyze data rows
    const dataRows = dataPreview.slice(1);
    const numericColumns: number[] = [];

    // Find numeric columns
    for (let col = 0; col < dataRows[0].length; col++) {
      const hasNumbers = dataRows.some(row =>
        typeof row[col] === 'number' && !isNaN(row[col])
      );
      if (hasNumbers) {
        numericColumns.push(col);
      }
    }

    if (numericColumns.length === 0) return null;

    // Generate insights based on chart type and data
    if (chartType.includes('Pie')) {
      return generatePieChartInsights(dataRows, numericColumns[0]);
    } else if (chartType.includes('Line')) {
      return generateLineChartInsights(dataRows, numericColumns[0]);
    } else if (chartType.includes('Bar') || chartType.includes('Column')) {
      return generateBarColumnInsights(dataRows, numericColumns[0]);
    } else if (chartType.includes('Scatter')) {
      return generateScatterInsights(dataRows, numericColumns);
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Generate pie chart specific insights
 */
function generatePieChartInsights(dataRows: any[][], valueCol: number): string {
  const values = dataRows.map(row => ({
    label: row[0],
    value: typeof row[valueCol] === 'number' ? row[valueCol] : 0
  }));

  // Find largest segment
  const largest = values.reduce((max, current) =>
    current.value > max.value ? current : max
  );

  const total = values.reduce((sum, item) => sum + item.value, 0);
  const percentage = total > 0 ? Math.round((largest.value / total) * 100) : 0;

  return `${largest.label} represents the largest segment at ${percentage}% of the total.`;
}

/**
 * Generate line chart specific insights
 */
function generateLineChartInsights(dataRows: any[][], valueCol: number): string {
  const values = dataRows.map(row => typeof row[valueCol] === 'number' ? row[valueCol] : 0);

  if (values.length < 2) return "The trend shows your data over time.";

  const firstValue = values[0];
  const lastValue = values[values.length - 1];
  const maxValue = Math.max(...values);
  const maxIndex = values.indexOf(maxValue);

  if (lastValue > firstValue) {
    return `The trend shows an overall increase from ${firstValue} to ${lastValue}. Peak value of ${maxValue} was reached at data point ${maxIndex + 1}.`;
  } else if (lastValue < firstValue) {
    return `The trend shows an overall decrease from ${firstValue} to ${lastValue}. Peak value of ${maxValue} was reached at data point ${maxIndex + 1}.`;
  } else {
    return `The values remain relatively stable. Peak value of ${maxValue} was reached at data point ${maxIndex + 1}.`;
  }
}

/**
 * Generate bar/column chart insights
 */
function generateBarColumnInsights(dataRows: any[][], valueCol: number): string {
  const values = dataRows.map(row => ({
    label: row[0],
    value: typeof row[valueCol] === 'number' ? row[valueCol] : 0
  }));

  // Find highest and lowest
  const highest = values.reduce((max, current) =>
    current.value > max.value ? current : max
  );
  const lowest = values.reduce((min, current) =>
    current.value < min.value ? current : min
  );

  return `${highest.label} has the highest value (${highest.value}), while ${lowest.label} has the lowest (${lowest.value}).`;
}

/**
 * Generate scatter plot insights
 */
function generateScatterInsights(dataRows: any[][], numericColumns: number[]): string {
  if (numericColumns.length < 2) {
    return "This scatter plot shows the relationship between your variables.";
  }

  // Simple correlation analysis
  const pairs = dataRows.map(row => ({
    x: typeof row[numericColumns[0]] === 'number' ? row[numericColumns[0]] : 0,
    y: typeof row[numericColumns[1]] === 'number' ? row[numericColumns[1]] : 0
  }));

  if (pairs.length < 3) return "This scatter plot shows the relationship between your variables.";

  // Calculate simple correlation direction
  let positiveCorrelation = 0;
  for (let i = 1; i < pairs.length; i++) {
    if ((pairs[i].x > pairs[i-1].x && pairs[i].y > pairs[i-1].y) ||
        (pairs[i].x < pairs[i-1].x && pairs[i].y < pairs[i-1].y)) {
      positiveCorrelation++;
    }
  }

  const correlationRatio = positiveCorrelation / (pairs.length - 1);

  if (correlationRatio > 0.6) {
    return "The scatter plot shows a positive correlation between the variables.";
  } else if (correlationRatio < 0.4) {
    return "The scatter plot shows a negative correlation between the variables.";
  } else {
    return "The scatter plot shows the distribution of your data points.";
  }
}

/**
 * Get chart-specific suggestions
 */
function getChartSuggestions(chartType: string, context: any): string {
  if (chartType.includes('Line')) {
    return "You can right-click the chart to change line styles or add data labels.";
  } else if (chartType.includes('Pie')) {
    return "Consider using a bar chart if you have many categories for better readability.";
  } else if (chartType.includes('Scatter')) {
    return "You can add a trendline to better visualize the relationship.";
  } else {
    return "You can customize colors and labels by right-clicking the chart.";
  }
}

/**
 * Get contextual suggestions based on selected data
 */
function getContextualSuggestion(context: any): string {
  if (!context || !context.dataPreview) {
    return "What would you like me to help you with?";
  }

  const data = context.dataPreview;
  const hasNumbers = data.some((row: any[]) =>
    row.some(cell => typeof cell === 'number' && !isNaN(cell))
  );

  if (hasNumbers) {
    return "I notice your selection contains numbers. I can help you sum them up, create charts, find averages, or apply formatting. What would you like to do?";
  }

  return "I can help you format this data, add formulas, or create visualizations. What would you like me to do?";
}

// Simplified endpoints without authentication
export const clearConversation = async (req: Request, res: Response) => {
  try {
    logger.info('Conversation cleared');
    return res.json({
      success: true,
      message: 'Conversation history cleared'
    });
  } catch (error) {
    logger.error('Clear conversation error:', error);
    return res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
};

export const getDocumentContext = async (req: Request, res: Response) => {
  try {
    return res.json({
      success: true,
      data: {
        messageCount: 0,
        documentCount: 0,
        hasExcelStructure: false
      }
    });
  } catch (error) {
    logger.error('Get document context error:', error);
    return res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
};

export const testNubia = async (req: Request, res: Response) => {
  try {
    return res.json({
      success: true,
      message: 'Nubia Excel Add-in backend is running!',
      timestamp: new Date().toISOString(),
      version: 'Excel Add-in v1.0'
    });
  } catch (error) {
    logger.error('Test endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
};