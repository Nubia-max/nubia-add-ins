import dotenv from 'dotenv';
dotenv.config();

import OpenAI from 'openai';
import { logger } from '../utils/logger';

interface ExcelAnalysisRequest {
  command: string;
  fileContext: any;
  previousCommands?: string[];
  conversationHistory?: any[];
}

interface ExcelOperation {
  type: string; // Allow any operation type for unlimited Excel operations
  sheet?: string;
  target?: string; // Cell address or range
  value?: any;
  formula?: string;
  format?: any;
  options?: any;
  description: string;
  reasoning?: string;
  newName?: string; // For rename operations
  [key: string]: any; // Allow additional properties for flexibility
}

interface ExcelAnalysisResult {
  operations: ExcelOperation[];
  reasoning: string;
  summary: string;
  confidence: number;
  warnings?: string[];
  suggestions?: string[];
}

export class ExcelDeepSeekService {
  private client: OpenAI;

  constructor() {
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error('DEEPSEEK_API_KEY environment variable is required. Please set it in your .env file.');
    }

    this.client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com',
      timeout: 300000, // 5 minutes for Excel analysis
      maxRetries: 2
    });
  }

  // EXCEL COMMAND ANALYSIS: Deep analysis of Excel commands with file context
  async analyzeExcelCommand(params: ExcelAnalysisRequest): Promise<ExcelAnalysisResult> {
    try {
      logger.info(`Analyzing Excel command: ${params.command.substring(0, 100)}`);

      const systemPrompt = this.buildExcelSystemPrompt();
      const userPrompt = this.buildUserPrompt(params);

      console.log('🎯 Sending Excel command to DeepSeek Reasoner for analysis...');
      console.log('📊 File context sheets:', params.fileContext?.sheets?.length || 0);
      console.log('📝 Command:', params.command.substring(0, 100));

      // Add progress logging for long operations
      const progressInterval = setInterval(() => {
        console.log('🧠 DeepSeek is analyzing Excel operations... (this is normal for complex commands)');
      }, 15000);

      let response;
      try {
        response = await Promise.race([
          this.client.chat.completions.create({
            model: 'deepseek-reasoner',
            temperature: 0.1, // Low temperature for deterministic Excel operations
            messages: [
              {
                role: 'system',
                content: systemPrompt
              },
              {
                role: 'user',
                content: userPrompt
              }
            ],
            max_tokens: 8000
            // Note: reasoning mode is DeepSeek-specific, may not be available in all models
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('DeepSeek request timed out after 5 minutes')), 300000)
          )
        ]);
      } finally {
        clearInterval(progressInterval);
      }

      console.log('✅ DeepSeek Excel analysis complete!');

      const responseMessage = response.choices[0].message;
      const rawContent = responseMessage.content || '';

      // Parse the response
      const analysisResult = this.parseExcelAnalysisResponse(rawContent);

      logger.info(`Excel analysis completed: ${analysisResult.operations.length} operations identified`);

      return analysisResult;

    } catch (error) {
      logger.error('Error in Excel command analysis:', error);

      // Fallback analysis for simple commands
      return this.fallbackAnalysis(params.command, params.fileContext);
    }
  }

  // SMART COMMAND UNDERSTANDING: Enhanced command parsing with context
  async interpretVagueCommand(command: string, fileContext: any): Promise<ExcelAnalysisResult> {
    try {
      logger.info(`Interpreting vague command: ${command}`);

      // Enhanced system prompt for vague command interpretation
      const systemPrompt = `You are an Excel expert AI that specializes in understanding vague user commands and converting them into specific Excel operations.

The user has an Excel file with this context:
${JSON.stringify(fileContext, null, 2)}

Your task is to interpret vague commands like:
- "Fix this spreadsheet"
- "Clean up the data"
- "Make it look professional"
- "Analyze the trends"
- "Find the errors"
- "Improve the formatting"

Based on the file context, infer what the user likely wants and suggest specific operations.

Respond with a JSON object containing:
{
  "operations": [
    {
      "type": "operation_type",
      "sheet": "sheet_name",
      "target": "cell_or_range",
      "value": "new_value",
      "formula": "formula_if_applicable",
      "format": {"formatting_options"},
      "description": "what this operation does",
      "reasoning": "why this operation was suggested"
    }
  ],
  "reasoning": "overall explanation of command interpretation",
  "summary": "summary of what will be done",
  "confidence": 0.85,
  "suggestions": ["additional improvements that could be made"]
}`;

      const response = await this.client.chat.completions.create({
        model: 'deepseek-reasoner',
        temperature: 0.3, // Slightly higher for creative interpretation
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: `Please interpret this command and suggest specific Excel operations: "${command}"`
          }
        ],
        max_tokens: 6000
      });

      const rawContent = response.choices[0].message.content || '';
      return this.parseExcelAnalysisResponse(rawContent);

    } catch (error) {
      logger.error('Error interpreting vague command:', error);
      return this.fallbackAnalysis(command, fileContext);
    }
  }

  // CONTEXT-AWARE EDITING: Consider file structure and previous operations
  async generateContextAwareOperations(command: string, fileContext: any, previousCommands: string[] = []): Promise<ExcelAnalysisResult> {
    try {
      const contextPrompt = `
Previous commands in this session:
${previousCommands.map((cmd, i) => `${i + 1}. ${cmd}`).join('\n')}

Current file structure:
- Sheets: ${fileContext.sheets?.map((s: any) => s.name).join(', ') || 'Unknown'}
- Total rows: ${fileContext.totalRows || 0}
- Formulas: ${fileContext.formulas?.length || 0}

Current command: "${command}"

Consider the context and previous operations when generating new operations. Ensure consistency and avoid conflicts.`;

      const response = await this.client.chat.completions.create({
        model: 'deepseek-reasoner',
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content: this.buildExcelSystemPrompt()
          },
          {
            role: 'user',
            content: contextPrompt
          }
        ],
        max_tokens: 8000
      });

      const rawContent = response.choices[0].message.content || '';
      return this.parseExcelAnalysisResponse(rawContent);

    } catch (error) {
      logger.error('Error generating context-aware operations:', error);
      return this.fallbackAnalysis(command, fileContext);
    }
  }

  // SYSTEM PROMPT BUILDER
  private buildExcelSystemPrompt(): string {
    return `You are NUBIA EXCEL AGENT, an advanced AI specialized in Excel file analysis and automation.

CORE CAPABILITIES:
- Analyze Excel files and understand their structure
- Convert natural language commands into specific Excel operations
- Provide intelligent suggestions for data manipulation
- Handle complex multi-step Excel tasks
- Ensure data integrity and backup safety

EXCEL OPERATIONS YOU CAN PERFORM:
1. edit_cell - Change cell values
2. add_formula - Add Excel formulas (SUM, AVERAGE, VLOOKUP, etc.)
3. format_cell/format_range - Apply formatting (bold, colors, borders, etc.)
4. insert_row/delete_row - Add or remove rows
5. insert_column/delete_column - Add or remove columns
6. sort_data - Sort data ranges
7. filter_data - Apply filters
8. merge_cells/unmerge_cells - Merge/unmerge cell ranges
9. rename_sheet - Rename worksheets (use newName property)
10. copy_sheet - Copy worksheets
11. delete_sheet - Delete worksheets
12. move_sheet - Reorder worksheets
13. protect_sheet - Protect/unprotect worksheets
14. conditional_format - Apply conditional formatting
15. find_replace - Find and replace values
16. auto_fill - Auto-fill patterns and series
17. copy_paste - Copy and paste operations
18. Any other Excel operation - You have unlimited capabilities!

OPERATION FORMAT:
Always respond with valid JSON in this exact format:
{
  "operations": [
    {
      "type": "operation_type",
      "sheet": "Sheet1",
      "target": "A1" or "A1:C10",
      "value": "new_value",
      "formula": "=SUM(A1:A10)",
      "format": {
        "bold": true,
        "color": "FF0000",
        "backgroundColor": "FFFF00",
        "numberFormat": "$#,##0.00",
        "alignment": {"horizontal": "center"}
      },
      "options": {"sortOrder": "asc", "filterCriteria": ">100"},
      "description": "Clear description of what this operation does",
      "reasoning": "Why this operation is needed"
    }
  ],
  "reasoning": "Overall explanation of the command interpretation and approach",
  "summary": "Brief summary of what will be accomplished",
  "confidence": 0.95,
  "warnings": ["Any potential issues or things to be careful about"],
  "suggestions": ["Additional improvements that could be beneficial"]
}

CRITICAL RULES:
1. Always validate that target cells/ranges exist in the file context
2. Use exact sheet names from the file context
3. Provide clear reasoning for each operation
4. Consider data integrity and relationships
5. Suggest backups for destructive operations
6. Handle edge cases gracefully
7. Optimize for user intent, not just literal commands
8. ALWAYS respond with valid JSON - no extra text outside the JSON

CELL REFERENCE FORMAT:
- Single cell: "A1", "B5", "Z100"
- Range: "A1:C10", "B2:E20"
- Column: "A:A", "B:C"
- Row: "1:1", "5:10"

FORMULA GUIDELINES:
- Use proper Excel syntax
- Include cell references relative to the target sheet
- Test formulas for circular references
- Provide helpful formula descriptions

Remember: You are helping users edit their EXISTING Excel files intelligently. Focus on understanding their intent and providing precise, safe operations.`;
  }

  // USER PROMPT BUILDER
  private buildUserPrompt(params: ExcelAnalysisRequest): string {
    let prompt = `EXCEL FILE ANALYSIS REQUEST

USER COMMAND: "${params.command}"

FILE CONTEXT:
`;

    if (params.fileContext) {
      prompt += `File: ${params.fileContext.fileName}
Total Sheets: ${params.fileContext.sheets?.length || 0}
Total Rows: ${params.fileContext.totalRows || 0}
Has Formulas: ${params.fileContext.formulas?.length > 0 ? 'Yes' : 'No'}
Data Range: ${params.fileContext.dataRange || 'Unknown'}

SHEET DETAILS:
`;

      params.fileContext.sheets?.forEach((sheet: any, index: number) => {
        prompt += `${index + 1}. Sheet "${sheet.name}":
   - Rows: ${sheet.actualRowCount || sheet.rowCount || 0}
   - Columns: ${sheet.actualColumnCount || sheet.columnCount || 0}
   - Has Formulas: ${sheet.hasFormulas ? 'Yes' : 'No'}
   - Data Range: ${sheet.dataRange || 'Unknown'}
   - Headers: ${sheet.headers?.slice(0, 10).join(', ') || 'None detected'}
   - Sample Data (first 3 rows):
`;

        if (sheet.sampleData && sheet.sampleData.length > 0) {
          sheet.sampleData.slice(0, 3).forEach((row: any[], rowIndex: number) => {
            const rowData = row.slice(0, 8).map(cell =>
              cell === null || cell === undefined ? '' : String(cell).substring(0, 20)
            ).join(' | ');
            prompt += `     Row ${rowIndex + 1}: ${rowData}\n`;
          });
        }
        prompt += '\n';
      });

      if (params.fileContext.formulas && params.fileContext.formulas.length > 0) {
        prompt += `EXISTING FORMULAS:
`;
        params.fileContext.formulas.slice(0, 10).forEach((formula: any) => {
          prompt += `  ${formula.sheet}!${formula.cell}: ${formula.formula} (${formula.type})\n`;
        });
      }
    }

    if (params.previousCommands && params.previousCommands.length > 0) {
      prompt += `
PREVIOUS COMMANDS IN SESSION:
${params.previousCommands.map((cmd, i) => `${i + 1}. ${cmd}`).join('\n')}
`;
    }

    prompt += `
TASK: Analyze the user command and generate specific Excel operations to accomplish their request. Consider the file structure, existing data, and provide safe, effective operations.

Remember to:
1. Use exact sheet names from the context
2. Validate cell references exist in the data range
3. Provide clear descriptions and reasoning
4. Consider data relationships and integrity
5. Suggest appropriate formatting and formulas
6. RESPOND ONLY WITH VALID JSON - no additional text

Generate the operations now:`;

    return prompt;
  }

  // RESPONSE PARSER
  private parseExcelAnalysisResponse(rawContent: string): ExcelAnalysisResult {
    try {
      // Try to extract JSON from the response
      let jsonContent = rawContent.trim();

      // Remove markdown code blocks if present
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      // Find JSON content if wrapped in other text
      const jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonContent = jsonMatch[0];
      }

      const parsed = JSON.parse(jsonContent);

      // Validate the structure
      if (!parsed.operations || !Array.isArray(parsed.operations)) {
        throw new Error('Invalid response structure: missing operations array');
      }

      // Validate each operation
      parsed.operations.forEach((op: any, index: number) => {
        if (!op.type || !op.sheet || !op.target) {
          throw new Error(`Invalid operation at index ${index}: missing required fields`);
        }
      });

      return {
        operations: parsed.operations,
        reasoning: parsed.reasoning || 'Analysis completed',
        summary: parsed.summary || 'Operations generated successfully',
        confidence: parsed.confidence || 0.8,
        warnings: parsed.warnings || [],
        suggestions: parsed.suggestions || []
      };

    } catch (error) {
      logger.error('Error parsing Excel analysis response:', error);
      logger.error('Raw content:', rawContent);

      // Return empty result on parse failure
      return {
        operations: [],
        reasoning: 'Failed to parse AI response',
        summary: 'Could not generate operations',
        confidence: 0.0,
        warnings: ['Failed to parse AI response. Please try a simpler command.'],
        suggestions: []
      };
    }
  }

  // FALLBACK ANALYSIS: Simple rule-based analysis for common commands
  private fallbackAnalysis(command: string, fileContext: any): ExcelAnalysisResult {
    const operations: ExcelOperation[] = [];
    const lowerCommand = command.toLowerCase();

    const mainSheet = fileContext.sheets?.[0]?.name || 'Sheet1';

    // Basic command patterns
    if (lowerCommand.includes('change') && lowerCommand.includes('to')) {
      // Pattern: "Change A1 to 500"
      const match = command.match(/change\s+([A-Z]+\d+)\s+to\s+(.+)/i);
      if (match) {
        operations.push({
          type: 'edit_cell',
          sheet: mainSheet,
          target: match[1],
          value: match[2],
          description: `Change cell ${match[1]} to ${match[2]}`
        });
      }
    }

    if (lowerCommand.includes('bold') || lowerCommand.includes('format')) {
      // Basic formatting
      operations.push({
        type: 'format_range',
        sheet: mainSheet,
        target: 'A1:Z1', // Header row
        format: { bold: true },
        description: 'Make header row bold'
      });
    }

    if (lowerCommand.includes('sum') || lowerCommand.includes('total')) {
      // Add SUM formula
      operations.push({
        type: 'add_formula',
        sheet: mainSheet,
        target: 'A10', // Reasonable default
        formula: '=SUM(A1:A9)',
        description: 'Add SUM formula'
      });
    }

    return {
      operations,
      reasoning: 'Fallback analysis used due to AI processing error',
      summary: `Generated ${operations.length} basic operations`,
      confidence: 0.5,
      warnings: ['Using simplified command processing. For better results, try again.'],
      suggestions: ['Be more specific about which cells or ranges to modify']
    };
  }

  // COMMAND VALIDATION
  validateCommand(command: string): { valid: boolean; message?: string } {
    if (!command || typeof command !== 'string') {
      return { valid: false, message: 'Command must be a non-empty string' };
    }

    if (command.trim().length === 0) {
      return { valid: false, message: 'Command cannot be empty' };
    }

    if (command.length > 2000) {
      return { valid: false, message: 'Command too long (max 2000 characters)' };
    }

    return { valid: true };
  }

  // OPERATION VALIDATION
  validateOperations(operations: ExcelOperation[], fileContext: any): string[] {
    const warnings: string[] = [];

    operations.forEach((op, index) => {
      // Validate sheet exists
      if (fileContext.sheets && !fileContext.sheets.find((s: any) => s.name === op.sheet)) {
        warnings.push(`Operation ${index + 1}: Sheet '${op.sheet}' not found in file`);
      }

      // Validate cell references (basic check)
      if (op.target && !this.isValidCellReference(op.target)) {
        warnings.push(`Operation ${index + 1}: Invalid cell reference '${op.target}'`);
      }
    });

    return warnings;
  }

  private isValidCellReference(reference: string): boolean {
    // Basic Excel cell reference validation
    const patterns = [
      /^[A-Z]+\d+$/i,        // Single cell: A1, B5, AA100
      /^[A-Z]+\d+:[A-Z]+\d+$/i,  // Range: A1:C10
      /^[A-Z]+:[A-Z]+$/i,    // Column range: A:C
      /^\d+:\d+$/            // Row range: 1:10
    ];

    return patterns.some(pattern => pattern.test(reference));
  }
}

export default ExcelDeepSeekService;