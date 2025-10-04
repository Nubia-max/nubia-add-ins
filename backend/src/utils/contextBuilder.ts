/**
 * Context Builder Utility
 * Purpose: Generate structured JSON representation of Excel worksheet context
 *
 * Features:
 * - Extract worksheet names and structure
 * - Sample data (first 20 rows × 10 cols) for AI reasoning
 * - Named ranges, formulas, and charts
 * - Structured context for better AI understanding
 */

import { logger } from './logger';

export interface ExcelSheetData {
  name: string;
  activeRange: string | null;
  sampleData: any[][];
  namedRanges: NamedRange[];
  formulas: Formula[];
  charts: Chart[];
  rowCount?: number;
  colCount?: number;
  hasData?: boolean;
}

export interface ExcelWorkbookContext {
  name?: string;
  workbookName?: string;  // Frontend compatibility
  sheets: ExcelSheetData[];
  worksheets?: ExcelSheetData[];  // Frontend compatibility
  activeSheet?: string;
  selectedRange?: string;
  totalSheets?: number;
  contextSummary?: string;
  timestamp?: string;
}

export interface NamedRange {
  name: string;
  range: string;
  scope?: string;
}

export interface Formula {
  cell: string;
  formula: string;
  result?: any;
}

export interface Chart {
  name: string;
  type: string;
  dataRange?: string;
  position?: string;
}

/**
 * Build comprehensive Excel context for AI processing
 * Extracts and structures Excel data for better AI reasoning
 */
export async function buildExcelContext(context: any): Promise<ExcelWorkbookContext> {
  try {
    if (!context) {
      logger.debug('No context provided, returning empty context');
      return { sheets: [] };
    }

    logger.debug('Building Excel context from input:', {
      hasWorkbookName: !!context.workbookName,
      worksheetCount: context.worksheets?.length || 0,
      hasActiveSheet: !!context.activeSheet,
      hasSelectedRange: !!context.selectedRange
    });

    const workbook: ExcelWorkbookContext = {
      name: context.workbookName || 'Untitled Workbook',
      workbookName: context.workbookName || 'Untitled Workbook',  // Frontend compatibility
      sheets: [],
      worksheets: [],  // Will be populated with same data as sheets
      activeSheet: context.activeSheet,
      selectedRange: context.selectedRange,
      totalSheets: context.worksheets?.length || 0,
      timestamp: new Date().toISOString()
    };

    // Process each worksheet
    for (const sheet of context.worksheets || []) {
      const sheetData = await buildSheetContext(sheet);
      workbook.sheets.push(sheetData);
      workbook.worksheets!.push(sheetData);  // Populate both for compatibility
    }

    // Generate context summary for AI
    workbook.contextSummary = generateContextSummary(workbook);

    logger.debug('Excel context built successfully:', {
      workbookName: workbook.name,
      sheetsProcessed: workbook.sheets.length,
      activeSheet: workbook.activeSheet,
      summaryLength: workbook.contextSummary?.length || 0
    });

    return workbook;

  } catch (error) {
    logger.error('Error building Excel context:', error);
    return {
      name: 'Error Workbook',
      workbookName: 'Error Workbook',
      sheets: [],
      worksheets: [],
      contextSummary: 'Error: Unable to process Excel context',
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Build context for a single worksheet
 */
async function buildSheetContext(sheet: any): Promise<ExcelSheetData> {
  try {
    const sheetData: ExcelSheetData = {
      name: sheet.name || 'Untitled Sheet',
      activeRange: sheet.activeRange || null,
      sampleData: [],
      namedRanges: [],
      formulas: [],
      charts: [],
      hasData: false
    };

    // Extract sample data (first 20 rows × 10 cols)
    if (sheet.cells && Array.isArray(sheet.cells)) {
      sheetData.sampleData = sheet.cells
        .slice(0, 20) // First 20 rows
        .map((row: any) => {
          if (Array.isArray(row)) {
            return row.slice(0, 10); // First 10 columns
          }
          return [];
        });

      sheetData.rowCount = sheet.cells.length;
      sheetData.colCount = sheet.cells[0]?.length || 0;
      sheetData.hasData = sheetData.sampleData.some(row =>
        row.some(cell => cell !== null && cell !== undefined && cell !== '')
      );
    }

    // Extract named ranges
    if (sheet.namedRanges && Array.isArray(sheet.namedRanges)) {
      sheetData.namedRanges = sheet.namedRanges.map((range: any) => ({
        name: range.name || '',
        range: range.range || '',
        scope: range.scope || 'Workbook'
      }));
    }

    // Extract formulas
    if (sheet.formulas && Array.isArray(sheet.formulas)) {
      sheetData.formulas = sheet.formulas.map((formula: any) => ({
        cell: formula.cell || '',
        formula: formula.formula || '',
        result: formula.result
      }));
    }

    // Extract charts
    if (sheet.charts && Array.isArray(sheet.charts)) {
      sheetData.charts = sheet.charts.map((chart: any) => ({
        name: chart.name || '',
        type: chart.type || 'Unknown',
        dataRange: chart.dataRange,
        position: chart.position
      }));
    }

    logger.debug(`Sheet context built for "${sheetData.name}":`, {
      hasData: sheetData.hasData,
      sampleRows: sheetData.sampleData.length,
      namedRanges: sheetData.namedRanges.length,
      formulas: sheetData.formulas.length,
      charts: sheetData.charts.length
    });

    return sheetData;

  } catch (error) {
    logger.warn('Error building sheet context:', error);
    return {
      name: sheet.name || 'Error Sheet',
      activeRange: null,
      sampleData: [],
      namedRanges: [],
      formulas: [],
      charts: [],
      hasData: false
    };
  }
}

/**
 * Generate a human-readable summary of the Excel context for AI reasoning
 */
function generateContextSummary(workbook: ExcelWorkbookContext): string {
  try {
    const parts: string[] = [];

    // Workbook overview
    parts.push(`Workbook: "${workbook.name}" with ${workbook.totalSheets} sheet(s)`);

    if (workbook.activeSheet) {
      parts.push(`Active sheet: "${workbook.activeSheet}"`);
    }

    if (workbook.selectedRange) {
      parts.push(`Selected range: ${workbook.selectedRange}`);
    }

    // Sheet summaries
    workbook.sheets.forEach(sheet => {
      const sheetParts: string[] = [];

      if (sheet.hasData) {
        sheetParts.push(`${sheet.rowCount} rows × ${sheet.colCount} cols`);
      } else {
        sheetParts.push('empty');
      }

      if (sheet.namedRanges.length > 0) {
        sheetParts.push(`${sheet.namedRanges.length} named ranges`);
      }

      if (sheet.formulas.length > 0) {
        sheetParts.push(`${sheet.formulas.length} formulas`);
      }

      if (sheet.charts.length > 0) {
        sheetParts.push(`${sheet.charts.length} charts`);
      }

      parts.push(`Sheet "${sheet.name}": ${sheetParts.join(', ')}`);
    });

    return parts.join('. ');

  } catch (error) {
    logger.warn('Error generating context summary:', error);
    return 'Context summary unavailable';
  }
}

/**
 * Extract specific data types from Excel context for targeted analysis
 */
export function extractDataTypes(context: ExcelWorkbookContext): {
  numbers: number[];
  dates: Date[];
  text: string[];
  formulas: string[];
} {
  const result = {
    numbers: [] as number[],
    dates: [] as Date[],
    text: [] as string[],
    formulas: [] as string[]
  };

  try {
    context.sheets.forEach(sheet => {
      // Extract data from sample data
      sheet.sampleData.forEach(row => {
        row.forEach(cell => {
          if (typeof cell === 'number') {
            result.numbers.push(cell);
          } else if (cell instanceof Date) {
            result.dates.push(cell);
          } else if (typeof cell === 'string' && cell.trim()) {
            result.text.push(cell);
          }
        });
      });

      // Extract formulas
      sheet.formulas.forEach(formula => {
        if (formula.formula) {
          result.formulas.push(formula.formula);
        }
      });
    });

  } catch (error) {
    logger.warn('Error extracting data types:', error);
  }

  return result;
}

/**
 * Find relevant data ranges based on user query
 */
export function findRelevantRanges(context: ExcelWorkbookContext, query: string): {
  sheets: string[];
  ranges: string[];
  namedRanges: NamedRange[];
} {
  const result = {
    sheets: [] as string[],
    ranges: [] as string[],
    namedRanges: [] as NamedRange[]
  };

  try {
    const queryLower = query.toLowerCase();

    context.sheets.forEach(sheet => {
      // Check if sheet name is relevant
      if (sheet.name.toLowerCase().includes(queryLower)) {
        result.sheets.push(sheet.name);
      }

      // Check named ranges
      sheet.namedRanges.forEach(range => {
        if (range.name.toLowerCase().includes(queryLower)) {
          result.namedRanges.push(range);
        }
      });

      // Add active range if present
      if (sheet.activeRange) {
        result.ranges.push(sheet.activeRange);
      }
    });

  } catch (error) {
    logger.warn('Error finding relevant ranges:', error);
  }

  return result;
}

// Export types and utilities
export {
  buildSheetContext,
  generateContextSummary
};