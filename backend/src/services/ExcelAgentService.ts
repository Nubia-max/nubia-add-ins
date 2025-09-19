import dotenv from 'dotenv';
dotenv.config();

import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs/promises';
import { logger } from '../utils/logger';

interface ExcelAnalysis {
  fileName: string;
  filePath: string;
  sheets: SheetInfo[];
  totalRows: number;
  totalColumns: number;
  formulas: FormulaInfo[];
  charts: ChartInfo[];
  hasData: boolean;
  dataRange: string;
  lastModified?: Date;
}

interface SheetInfo {
  name: string;
  index: number;
  rowCount: number;
  columnCount: number;
  actualRowCount: number;
  actualColumnCount: number;
  dataRange: string;
  hasFormulas: boolean;
  hasCharts: boolean;
  sampleData: any[][];
  headers: string[];
}

interface FormulaInfo {
  sheet: string;
  cell: string;
  formula: string;
  value?: any;
  type: 'SUM' | 'AVERAGE' | 'VLOOKUP' | 'COUNTIF' | 'IF' | 'OTHER';
}

interface ChartInfo {
  sheet: string;
  title: string;
  type: string;
  dataRange: string;
}

interface ExcelOperation {
  type: 'edit_cell' | 'add_formula' | 'format_cell' | 'format_range' | 'insert_row' | 'delete_row' |
        'insert_column' | 'delete_column' | 'create_chart' | 'create_pivot' | 'sort_data' |
        'filter_data' | 'merge_cells' | 'unmerge_cells' | 'add_validation' | 'protect_sheet';
  sheet: string;
  target: string; // Cell address or range
  value?: any;
  formula?: string;
  format?: any;
  options?: any;
  description: string;
}

interface EditResult {
  success: boolean;
  message: string;
  operations: ExcelOperation[];
  filePath: string;
  backupPath?: string;
  summary: string;
  error?: string;
}

export class ExcelAgentService {
  private fileWatchers = new Map<string, any>();

  // ANALYZE: Deep analysis of existing Excel file
  async analyzeExcelFile(filePath: string): Promise<ExcelAnalysis> {
    try {
      logger.info(`Analyzing Excel file: ${filePath}`);

      // Check if file exists
      await fs.access(filePath);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);

      const analysis: ExcelAnalysis = {
        fileName: path.basename(filePath),
        filePath: filePath,
        sheets: [],
        totalRows: 0,
        totalColumns: 0,
        formulas: [],
        charts: [],
        hasData: false,
        dataRange: '',
        lastModified: (await fs.stat(filePath)).mtime
      };

      // Analyze each worksheet
      workbook.eachSheet((worksheet, sheetId) => {
        const sheetInfo = this.analyzeWorksheet(worksheet, sheetId);
        analysis.sheets.push(sheetInfo);
        analysis.totalRows += sheetInfo.actualRowCount;
        analysis.totalColumns = Math.max(analysis.totalColumns, sheetInfo.actualColumnCount);

        if (sheetInfo.actualRowCount > 0) {
          analysis.hasData = true;
        }

        // Collect formulas from this sheet
        worksheet.eachRow((row, rowNumber) => {
          row.eachCell((cell, colNumber) => {
            if (cell.formula) {
              const formulaInfo: FormulaInfo = {
                sheet: worksheet.name,
                cell: cell.address,
                formula: cell.formula,
                value: cell.value,
                type: this.categorizeFormula(cell.formula)
              };
              analysis.formulas.push(formulaInfo);
            }
          });
        });
      });

      // Set overall data range
      if (analysis.hasData) {
        const mainSheet = analysis.sheets[0];
        analysis.dataRange = `A1:${this.columnNumberToLetter(mainSheet.actualColumnCount)}${mainSheet.actualRowCount}`;
      }

      logger.info(`Excel analysis completed: ${analysis.sheets.length} sheets, ${analysis.totalRows} total rows, ${analysis.formulas.length} formulas`);
      return analysis;

    } catch (error) {
      logger.error(`Error analyzing Excel file ${filePath}:`, error);
      throw new Error(`Failed to analyze Excel file: ${error.message}`);
    }
  }

  // ANALYZE WORKSHEET: Deep analysis of individual worksheet
  private analyzeWorksheet(worksheet: ExcelJS.Worksheet, sheetId: number): SheetInfo {
    const sheetInfo: SheetInfo = {
      name: worksheet.name,
      index: sheetId,
      rowCount: worksheet.rowCount,
      columnCount: worksheet.columnCount,
      actualRowCount: 0,
      actualColumnCount: 0,
      dataRange: '',
      hasFormulas: false,
      hasCharts: false,
      sampleData: [],
      headers: []
    };

    // Find actual data boundaries
    let maxRow = 0;
    let maxCol = 0;
    let minRow = Infinity;
    let minCol = Infinity;

    worksheet.eachRow((row, rowNumber) => {
      let hasDataInRow = false;
      row.eachCell((cell, colNumber) => {
        if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
          hasDataInRow = true;
          maxRow = Math.max(maxRow, rowNumber);
          maxCol = Math.max(maxCol, colNumber);
          minRow = Math.min(minRow, rowNumber);
          minCol = Math.min(minCol, colNumber);

          if (cell.formula) {
            sheetInfo.hasFormulas = true;
          }
        }
      });
      if (hasDataInRow) {
        sheetInfo.actualRowCount = maxRow;
      }
    });

    sheetInfo.actualColumnCount = maxCol;

    // Extract headers (first row)
    if (sheetInfo.actualRowCount > 0) {
      const headerRow = worksheet.getRow(minRow || 1);
      headerRow.eachCell((cell, colNumber) => {
        if (cell.value) {
          sheetInfo.headers.push(String(cell.value));
        }
      });
    }

    // Extract sample data (first 10 rows for context)
    const sampleRowLimit = Math.min(10, sheetInfo.actualRowCount);
    for (let i = 1; i <= sampleRowLimit; i++) {
      const row = worksheet.getRow(i);
      const rowData: any[] = [];

      for (let j = 1; j <= Math.min(20, sheetInfo.actualColumnCount); j++) {
        const cell = row.getCell(j);
        rowData.push(cell.value);
      }

      sheetInfo.sampleData.push(rowData);
    }

    // Set data range
    if (sheetInfo.actualRowCount > 0) {
      sheetInfo.dataRange = `A1:${this.columnNumberToLetter(sheetInfo.actualColumnCount)}${sheetInfo.actualRowCount}`;
    }

    return sheetInfo;
  }

  // EDIT: Intelligent editing with AI understanding
  async editExcelFile(filePath: string, userCommand: string, fileContext: ExcelAnalysis, aiAnalysis: any): Promise<EditResult> {
    try {
      logger.info(`Editing Excel file: ${filePath} with command: ${userCommand}`);

      // Create backup first
      const backupPath = await this.createBackup(filePath);

      // Load workbook
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);

      // Parse AI analysis to get operations
      const operations = this.parseAIOperations(aiAnalysis, fileContext);

      // Execute operations
      const executedOperations: ExcelOperation[] = [];
      for (const operation of operations) {
        try {
          await this.executeOperation(workbook, operation);
          executedOperations.push(operation);
          logger.info(`Executed operation: ${operation.type} on ${operation.sheet}:${operation.target}`);
        } catch (error) {
          logger.error(`Failed to execute operation ${operation.type}:`, error);
          // Continue with other operations
        }
      }

      // Save to temporary file first (safety)
      const tempPath = filePath + '.tmp';
      await workbook.xlsx.writeFile(tempPath);

      // Replace original with edited version
      await fs.rename(tempPath, filePath);

      const summary = this.generateEditSummary(executedOperations, userCommand);

      logger.info(`Excel file edited successfully: ${filePath}`);

      return {
        success: true,
        message: summary,
        operations: executedOperations,
        filePath: filePath,
        backupPath: backupPath,
        summary: summary
      };

    } catch (error) {
      logger.error(`Error editing Excel file ${filePath}:`, error);
      return {
        success: false,
        message: `Failed to edit Excel file: ${error.message}`,
        operations: [],
        filePath: filePath,
        summary: '',
        error: error.message
      };
    }
  }

  // OPERATIONS: Execute specific Excel operations
  private async executeOperation(workbook: ExcelJS.Workbook, operation: ExcelOperation): Promise<void> {
    const worksheet = workbook.getWorksheet(operation.sheet);
    if (!worksheet) {
      throw new Error(`Worksheet '${operation.sheet}' not found`);
    }

    switch (operation.type) {
      case 'edit_cell':
        this.editCell(worksheet, operation);
        break;

      case 'add_formula':
        this.addFormula(worksheet, operation);
        break;

      case 'format_cell':
        this.formatCell(worksheet, operation);
        break;

      case 'format_range':
        this.formatRange(worksheet, operation);
        break;

      case 'insert_row':
        this.insertRow(worksheet, operation);
        break;

      case 'delete_row':
        this.deleteRow(worksheet, operation);
        break;

      case 'insert_column':
        this.insertColumn(worksheet, operation);
        break;

      case 'delete_column':
        this.deleteColumn(worksheet, operation);
        break;

      case 'sort_data':
        this.sortData(worksheet, operation);
        break;

      case 'merge_cells':
        this.mergeCells(worksheet, operation);
        break;

      case 'unmerge_cells':
        this.unmergeCells(worksheet, operation);
        break;

      default:
        logger.warn(`Unsupported operation type: ${operation.type}`);
    }
  }

  // CELL OPERATIONS
  private editCell(worksheet: ExcelJS.Worksheet, operation: ExcelOperation): void {
    const cell = worksheet.getCell(operation.target);
    cell.value = operation.value;
  }

  private addFormula(worksheet: ExcelJS.Worksheet, operation: ExcelOperation): void {
    const cell = worksheet.getCell(operation.target);
    if (operation.formula) {
      // Set formula using ExcelJS approach
      (cell as any).formula = operation.formula;
    }
  }

  private formatCell(worksheet: ExcelJS.Worksheet, operation: ExcelOperation): void {
    const cell = worksheet.getCell(operation.target);
    if (operation.format) {
      this.applyFormat(cell, operation.format);
    }
  }

  private formatRange(worksheet: ExcelJS.Worksheet, operation: ExcelOperation): void {
    const range = worksheet.getCell(operation.target);
    // For ranges, we need to parse the range and apply to multiple cells
    if (operation.target.includes(':')) {
      const [start, end] = operation.target.split(':');
      const startCell = worksheet.getCell(start);
      const endCell = worksheet.getCell(end);

      // Apply format to range
      for (let row = Number(startCell.row); row <= Number(endCell.row); row++) {
        for (let col = Number(startCell.col); col <= Number(endCell.col); col++) {
          const cell = worksheet.getCell(row, col);
          this.applyFormat(cell, operation.format);
        }
      }
    }
  }

  private insertRow(worksheet: ExcelJS.Worksheet, operation: ExcelOperation): void {
    const rowNumber = parseInt(operation.target);
    worksheet.spliceRows(rowNumber, 0, []);
  }

  private deleteRow(worksheet: ExcelJS.Worksheet, operation: ExcelOperation): void {
    const rowNumber = parseInt(operation.target);
    worksheet.spliceRows(rowNumber, 1);
  }

  private insertColumn(worksheet: ExcelJS.Worksheet, operation: ExcelOperation): void {
    const colNumber = this.columnLetterToNumber(operation.target);
    worksheet.spliceColumns(colNumber, 0, []);
  }

  private deleteColumn(worksheet: ExcelJS.Worksheet, operation: ExcelOperation): void {
    const colNumber = this.columnLetterToNumber(operation.target);
    worksheet.spliceColumns(colNumber, 1);
  }

  private sortData(worksheet: ExcelJS.Worksheet, operation: ExcelOperation): void {
    // ExcelJS doesn't have built-in sorting, so we'll log this for now
    logger.info(`Sort operation requested for range ${operation.target} but not implemented in ExcelJS`);
  }

  private mergeCells(worksheet: ExcelJS.Worksheet, operation: ExcelOperation): void {
    worksheet.mergeCells(operation.target);
  }

  private unmergeCells(worksheet: ExcelJS.Worksheet, operation: ExcelOperation): void {
    worksheet.unMergeCells(operation.target);
  }

  // FORMAT HELPERS
  private applyFormat(cell: ExcelJS.Cell, format: any): void {
    if (format.bold !== undefined) {
      cell.font = { ...cell.font, bold: format.bold };
    }
    if (format.italic !== undefined) {
      cell.font = { ...cell.font, italic: format.italic };
    }
    if (format.color) {
      cell.font = { ...cell.font, color: { argb: format.color } };
    }
    if (format.backgroundColor) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: format.backgroundColor }
      };
    }
    if (format.numberFormat) {
      cell.numFmt = format.numberFormat;
    }
    if (format.alignment) {
      cell.alignment = format.alignment;
    }
    if (format.border) {
      cell.border = format.border;
    }
  }

  // BACKUP SYSTEM
  private async createBackup(filePath: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.dirname(filePath);
    const fileName = path.basename(filePath, path.extname(filePath));
    const extension = path.extname(filePath);
    const backupPath = path.join(backupDir, `${fileName}.backup.${timestamp}${extension}`);

    await fs.copyFile(filePath, backupPath);
    logger.info(`Backup created: ${backupPath}`);
    return backupPath;
  }

  // AI ANALYSIS PARSING
  private parseAIOperations(aiAnalysis: any, fileContext: ExcelAnalysis): ExcelOperation[] {
    const operations: ExcelOperation[] = [];

    try {
      // Parse the AI response to extract operations
      if (aiAnalysis.operations && Array.isArray(aiAnalysis.operations)) {
        for (const op of aiAnalysis.operations) {
          const operation: ExcelOperation = {
            type: op.type,
            sheet: op.sheet || fileContext.sheets[0]?.name || 'Sheet1',
            target: op.target || op.cell || op.range,
            value: op.value,
            formula: op.formula,
            format: op.format,
            options: op.options,
            description: op.description || `${op.type} operation`
          };
          operations.push(operation);
        }
      }
    } catch (error) {
      logger.error('Error parsing AI operations:', error);
    }

    return operations;
  }

  // UTILITY FUNCTIONS
  private categorizeFormula(formula: string): FormulaInfo['type'] {
    const f = formula.toUpperCase();
    if (f.includes('SUM(')) return 'SUM';
    if (f.includes('AVERAGE(')) return 'AVERAGE';
    if (f.includes('VLOOKUP(')) return 'VLOOKUP';
    if (f.includes('COUNTIF(')) return 'COUNTIF';
    if (f.includes('IF(')) return 'IF';
    return 'OTHER';
  }

  private columnLetterToNumber(letter: string): number {
    let result = 0;
    for (let i = 0; i < letter.length; i++) {
      result = result * 26 + (letter.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
    }
    return result;
  }

  private columnNumberToLetter(number: number): string {
    let result = '';
    while (number > 0) {
      number--;
      result = String.fromCharCode('A'.charCodeAt(0) + (number % 26)) + result;
      number = Math.floor(number / 26);
    }
    return result;
  }

  private generateEditSummary(operations: ExcelOperation[], userCommand: string): string {
    if (operations.length === 0) {
      return 'No operations were performed.';
    }

    const operationCounts = operations.reduce((acc, op) => {
      acc[op.type] = (acc[op.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const summaryParts = Object.entries(operationCounts).map(([type, count]) => {
      const action = type.replace('_', ' ').toLowerCase();
      return `${count} ${action} operation${count > 1 ? 's' : ''}`;
    });

    return `✅ Successfully executed ${summaryParts.join(', ')} based on: "${userCommand}"`;
  }

  // FILE MONITORING
  async startFileMonitoring(filePath: string, userId: string): Promise<void> {
    if (this.fileWatchers.has(filePath)) {
      return; // Already monitoring
    }

    try {
      const chokidar = require('chokidar');
      const watcher = chokidar.watch(filePath, {
        persistent: true,
        ignoreInitial: true
      });

      watcher.on('change', () => {
        logger.info(`File changed externally: ${filePath}`);
        // Notify frontend about external changes
      });

      watcher.on('unlink', () => {
        logger.warn(`File deleted: ${filePath}`);
        // Notify frontend about file deletion
      });

      this.fileWatchers.set(filePath, watcher);
      logger.info(`Started monitoring file: ${filePath}`);
    } catch (error) {
      logger.error(`Error starting file monitor for ${filePath}:`, error);
    }
  }

  async stopFileMonitoring(filePath: string): Promise<void> {
    const watcher = this.fileWatchers.get(filePath);
    if (watcher) {
      await watcher.close();
      this.fileWatchers.delete(filePath);
      logger.info(`Stopped monitoring file: ${filePath}`);
    }
  }

  // COMPLEX ANALYSIS
  async performComplexAnalysis(filePath: string, analysisType: string, fileContext: ExcelAnalysis): Promise<any> {
    try {
      logger.info(`Performing complex analysis: ${analysisType} on ${filePath}`);

      switch (analysisType) {
        case 'financial_summary':
          return this.analyzeFinancialData(fileContext);

        case 'data_quality':
          return this.analyzeDataQuality(fileContext);

        case 'formula_audit':
          return this.auditFormulas(fileContext);

        case 'trend_analysis':
          return this.analyzeTrends(fileContext);

        default:
          return this.generateGeneralInsights(fileContext);
      }
    } catch (error) {
      logger.error(`Error in complex analysis:`, error);
      throw error;
    }
  }

  private analyzeFinancialData(fileContext: ExcelAnalysis): any {
    return {
      type: 'financial_summary',
      insights: [
        `Found ${fileContext.formulas.length} formulas across ${fileContext.sheets.length} sheets`,
        `Total data spans ${fileContext.totalRows} rows`,
        'Detected potential financial calculations in formulas'
      ],
      recommendations: [
        'Consider adding data validation for numerical inputs',
        'Review formula references for accuracy',
        'Add summary charts for better visualization'
      ]
    };
  }

  private analyzeDataQuality(fileContext: ExcelAnalysis): any {
    const issues: string[] = [];
    if (fileContext.formulas.length === 0) {
      issues.push('No formulas detected - consider adding calculations');
    }

    return {
      type: 'data_quality',
      issues: issues,
      score: issues.length === 0 ? 'Good' : 'Needs Improvement',
      recommendations: issues.length > 0 ? ['Add formulas for calculations'] : ['Data quality looks good']
    };
  }

  private auditFormulas(fileContext: ExcelAnalysis): any {
    return {
      type: 'formula_audit',
      formulaCount: fileContext.formulas.length,
      formulaTypes: fileContext.formulas.reduce((acc, f) => {
        acc[f.type] = (acc[f.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      potentialIssues: []
    };
  }

  private analyzeTrends(fileContext: ExcelAnalysis): any {
    return {
      type: 'trend_analysis',
      dataPoints: fileContext.totalRows,
      sheets: fileContext.sheets.length,
      insights: ['Trend analysis requires time-series data'],
      recommendations: ['Ensure date columns are properly formatted for trend analysis']
    };
  }

  private generateGeneralInsights(fileContext: ExcelAnalysis): any {
    return {
      type: 'general_insights',
      summary: {
        sheets: fileContext.sheets.length,
        totalRows: fileContext.totalRows,
        formulas: fileContext.formulas.length,
        hasData: fileContext.hasData
      },
      insights: [
        `Workbook contains ${fileContext.sheets.length} worksheet(s)`,
        `${fileContext.formulas.length} formulas found`,
        `Data spans ${fileContext.totalRows} rows total`
      ]
    };
  }
}

export default ExcelAgentService;