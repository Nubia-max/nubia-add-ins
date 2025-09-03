export interface ExcelTask {
  id: string;
  type: ExcelTaskType;
  description: string;
  complexity: 'simple' | 'complex';
  estimatedActions: number;
  parameters: ExcelTaskParameters;
  mode: 'visual' | 'background';
  priority: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  steps: ExcelStep[];
  metadata: {
    createdAt: Date;
    estimatedDuration: number; // in seconds
    requiredFiles?: string[];
    outputFiles?: string[];
  };
}

export interface ExcelStep {
  id: string;
  action: ExcelAction;
  description: string;
  parameters: Record<string, any>;
  order: number;
  estimatedTime: number; // in milliseconds
}

export type ExcelTaskType = 
  | 'create_spreadsheet'
  | 'add_data'
  | 'create_chart'
  | 'create_formula'
  | 'create_pivot_table'
  | 'format_cells'
  | 'import_data'
  | 'export_data'
  | 'generate_report'
  | 'data_analysis'
  | 'macro_automation';

export type ExcelAction = 
  | 'new_workbook'
  | 'open_file'
  | 'save_file'
  | 'add_worksheet'
  | 'select_range'
  | 'enter_data'
  | 'create_formula'
  | 'format_range'
  | 'create_chart'
  | 'insert_pivot'
  | 'sort_data'
  | 'filter_data'
  | 'copy_paste'
  | 'delete_rows'
  | 'insert_rows'
  | 'merge_cells'
  | 'freeze_panes'
  | 'protect_sheet';

export interface ExcelTaskParameters {
  fileName?: string;
  worksheetName?: string;
  dataRange?: string;
  chartType?: 'bar' | 'line' | 'pie' | 'scatter' | 'column';
  formulaType?: 'sum' | 'average' | 'count' | 'vlookup' | 'if' | 'custom';
  data?: any[][];
  headers?: string[];
  pivotFields?: {
    rows: string[];
    columns: string[];
    values: string[];
    filters?: string[];
  };
  formatting?: {
    bold?: boolean;
    italic?: boolean;
    fontSize?: number;
    backgroundColor?: string;
    textColor?: string;
    numberFormat?: string;
  };
  customFormula?: string;
  importSource?: {
    type: 'csv' | 'json' | 'xml' | 'database';
    path: string;
    delimiter?: string;
  };
}

export interface ParseResult {
  success: boolean;
  task?: ExcelTask;
  error?: string;
  confidence: number; // 0-1, how confident we are in the parsing
  alternatives?: ExcelTask[]; // alternative interpretations
}

class ExcelParser {
  private taskCounter = 0;

  // Keywords for different Excel operations
  private readonly keywords = {
    create_spreadsheet: [
      'create', 'new', 'make', 'generate', 'build', 'set up', 'initialize',
      'spreadsheet', 'workbook', 'excel file', 'worksheet', 'sheet'
    ],
    add_data: [
      'add', 'insert', 'enter', 'input', 'put', 'fill', 'populate',
      'data', 'information', 'values', 'numbers', 'text', 'entries'
    ],
    create_chart: [
      'chart', 'graph', 'plot', 'visualization', 'visual', 'bar chart',
      'line chart', 'pie chart', 'scatter plot', 'histogram', 'dashboard'
    ],
    create_formula: [
      'formula', 'calculation', 'compute', 'calculate', 'sum', 'average',
      'count', 'vlookup', 'if statement', 'function', 'equation'
    ],
    create_pivot_table: [
      'pivot', 'pivot table', 'summary', 'aggregate', 'group', 'analyze',
      'cross-tab', 'breakdown', 'summarize'
    ],
    format_cells: [
      'format', 'style', 'color', 'bold', 'italic', 'font', 'border',
      'alignment', 'number format', 'currency', 'percentage'
    ],
    import_data: [
      'import', 'load', 'open', 'read', 'fetch', 'get', 'pull',
      'csv', 'json', 'database', 'file', 'data source'
    ],
    export_data: [
      'export', 'save', 'download', 'output', 'generate', 'extract'
    ],
    generate_report: [
      'report', 'summary', 'analysis', 'overview', 'dashboard',
      'financial report', 'profit and loss', 'balance sheet', 'income statement'
    ],
    data_analysis: [
      'analyze', 'analysis', 'statistics', 'trend', 'correlation',
      'regression', 'forecast', 'prediction', 'insights'
    ]
  };

  // Common Excel tasks with predefined templates
  private readonly taskTemplates: Record<string, Partial<ExcelTask>> = {
    monthly_budget: {
      type: 'create_spreadsheet',
      description: 'Create a monthly budget spreadsheet',
      complexity: 'simple',
      estimatedActions: 15,
      parameters: {
        fileName: 'Monthly Budget.xlsx',
        worksheetName: 'Budget',
        headers: ['Category', 'Budgeted', 'Actual', 'Difference', 'Percentage'],
        data: [
          ['Housing', '1500', '', '=C2-B2', '=C2/B2*100'],
          ['Transportation', '500', '', '=C3-B3', '=C3/B3*100'],
          ['Food', '600', '', '=C4-B4', '=C4/B4*100'],
          ['Entertainment', '200', '', '=C5-B5', '=C5/B5*100'],
          ['Savings', '300', '', '=C6-B6', '=C6/B6*100']
        ]
      }
    },
    profit_loss: {
      type: 'generate_report',
      description: 'Generate a profit and loss statement',
      complexity: 'complex',
      estimatedActions: 25,
      parameters: {
        fileName: 'Profit & Loss Statement.xlsx',
        worksheetName: 'P&L',
        headers: ['Item', 'Amount', 'Percentage']
      }
    },
    transaction_log: {
      type: 'add_data',
      description: 'Add transaction data to ledger',
      complexity: 'simple',
      estimatedActions: 5,
      parameters: {
        headers: ['Date', 'Description', 'Category', 'Amount', 'Balance']
      }
    }
  };

  parse(input: string): ParseResult {
    const normalizedInput = input.toLowerCase().trim();
    
    // Check for predefined templates first
    const templateMatch = this.matchTemplate(normalizedInput);
    if (templateMatch) {
      return {
        success: true,
        task: this.createTaskFromTemplate(templateMatch, input),
        confidence: 0.9
      };
    }

    // Parse general Excel commands
    const taskType = this.identifyTaskType(normalizedInput);
    if (!taskType) {
      return {
        success: false,
        error: 'Could not identify Excel operation',
        confidence: 0
      };
    }

    const parameters = this.extractParameters(normalizedInput, taskType);
    const steps = this.generateSteps(taskType, parameters);
    const estimatedActions = steps.length;
    const complexity = estimatedActions > 20 ? 'complex' : 'simple';

    const task: ExcelTask = {
      id: this.generateTaskId(),
      type: taskType,
      description: input,
      complexity,
      estimatedActions,
      parameters,
      mode: complexity === 'complex' ? 'background' : 'visual',
      priority: 1,
      status: 'pending',
      steps,
      metadata: {
        createdAt: new Date(),
        estimatedDuration: this.estimateExecutionTime(steps),
        outputFiles: parameters.fileName ? [parameters.fileName] : undefined
      }
    };

    return {
      success: true,
      task,
      confidence: this.calculateConfidence(normalizedInput, taskType),
      alternatives: this.generateAlternatives(normalizedInput, taskType)
    };
  }

  private matchTemplate(input: string): string | null {
    const templates = {
      'monthly budget': 'monthly_budget',
      'budget spreadsheet': 'monthly_budget',
      'budget template': 'monthly_budget',
      'profit and loss': 'profit_loss',
      'p&l statement': 'profit_loss',
      'income statement': 'profit_loss',
      'transaction': 'transaction_log',
      'ledger': 'transaction_log',
      'expenses': 'transaction_log'
    };

    for (const [pattern, template] of Object.entries(templates)) {
      if (input.includes(pattern)) {
        return template;
      }
    }

    return null;
  }

  private createTaskFromTemplate(templateKey: string, originalInput: string): ExcelTask {
    const template = this.taskTemplates[templateKey];
    const steps = this.generateStepsFromTemplate(template);
    
    return {
      id: this.generateTaskId(),
      type: template.type!,
      description: originalInput,
      complexity: template.complexity!,
      estimatedActions: template.estimatedActions!,
      parameters: template.parameters!,
      mode: template.complexity === 'complex' ? 'background' : 'visual',
      priority: 1,
      status: 'pending',
      steps,
      metadata: {
        createdAt: new Date(),
        estimatedDuration: this.estimateExecutionTime(steps),
        outputFiles: template.parameters?.fileName ? [template.parameters.fileName] : undefined
      }
    };
  }

  private identifyTaskType(input: string): ExcelTaskType | null {
    let bestMatch: { type: ExcelTaskType; score: number } | null = null;

    for (const [type, keywords] of Object.entries(this.keywords)) {
      const score = this.calculateKeywordScore(input, keywords);
      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { type: type as ExcelTaskType, score };
      }
    }

    return bestMatch?.score > 0.3 ? bestMatch.type : null;
  }

  private calculateKeywordScore(input: string, keywords: string[]): number {
    let matches = 0;
    let totalWeight = 0;

    for (const keyword of keywords) {
      const weight = keyword.split(' ').length; // Multi-word keywords have higher weight
      if (input.includes(keyword)) {
        matches += weight;
      }
      totalWeight += weight;
    }

    return matches / totalWeight;
  }

  private extractParameters(input: string, taskType: ExcelTaskType): ExcelTaskParameters {
    const params: ExcelTaskParameters = {};

    // Extract file names
    const fileNameMatch = input.match(/(?:file|spreadsheet|workbook)\s+(?:called|named|titled)\s+"([^"]+)"/);
    if (fileNameMatch) {
      params.fileName = fileNameMatch[1].endsWith('.xlsx') ? fileNameMatch[1] : `${fileNameMatch[1]}.xlsx`;
    }

    // Extract data from text
    const dataMatches = input.match(/(?:add|insert|enter).*?:\s*(.+)/);
    if (dataMatches) {
      params.data = this.parseDataFromText(dataMatches[1]);
    }

    // Extract chart types
    const chartTypes = ['bar', 'line', 'pie', 'scatter', 'column'];
    for (const type of chartTypes) {
      if (input.includes(type)) {
        params.chartType = type as any;
        break;
      }
    }

    // Extract ranges
    const rangeMatch = input.match(/(?:range|cells?)\s+([A-Z]+\d+(?::[A-Z]+\d+)?)/i);
    if (rangeMatch) {
      params.dataRange = rangeMatch[1].toUpperCase();
    }

    // Extract formulas
    const formulaMatch = input.match(/(?:formula|calculate|compute)\s+(.+?)(?:\s|$)/);
    if (formulaMatch) {
      params.customFormula = formulaMatch[1];
    }

    return params;
  }

  private parseDataFromText(text: string): any[][] {
    // Parse simple data formats like "Coffee $5, Lunch $12, Dinner $20"
    const entries = text.split(',').map(entry => entry.trim());
    const data: any[][] = [];

    for (const entry of entries) {
      const match = entry.match(/(.+?)\s+\$?(\d+(?:\.\d{2})?)/);
      if (match) {
        data.push([match[1].trim(), parseFloat(match[2])]);
      }
    }

    return data.length > 0 ? data : [[text]];
  }

  private generateSteps(taskType: ExcelTaskType, parameters: ExcelTaskParameters): ExcelStep[] {
    const steps: ExcelStep[] = [];
    let order = 1;

    switch (taskType) {
      case 'create_spreadsheet':
        steps.push(
          this.createStep('new_workbook', 'Create new workbook', {}, order++, 1000),
          this.createStep('add_worksheet', 'Add worksheet', { name: parameters.worksheetName || 'Sheet1' }, order++, 500)
        );
        if (parameters.headers) {
          steps.push(this.createStep('enter_data', 'Add headers', { range: 'A1', data: [parameters.headers] }, order++, 800));
        }
        break;

      case 'add_data':
        if (parameters.data) {
          steps.push(this.createStep('enter_data', 'Enter data', { data: parameters.data }, order++, 500));
        }
        break;

      case 'create_chart':
        steps.push(
          this.createStep('select_range', 'Select data range', { range: parameters.dataRange || 'A1:B10' }, order++, 300),
          this.createStep('create_chart', 'Insert chart', { type: parameters.chartType || 'column' }, order++, 2000)
        );
        break;

      case 'create_formula':
        steps.push(
          this.createStep('select_range', 'Select cell for formula', { range: 'A1' }, order++, 200),
          this.createStep('create_formula', 'Enter formula', { formula: parameters.customFormula || '=SUM(A1:A10)' }, order++, 500)
        );
        break;

      case 'create_pivot_table':
        steps.push(
          this.createStep('select_range', 'Select data range', { range: parameters.dataRange || 'A1:E100' }, order++, 300),
          this.createStep('insert_pivot', 'Create pivot table', parameters.pivotFields || {}, order++, 3000)
        );
        break;

      default:
        steps.push(this.createStep('new_workbook', 'Create workbook', {}, order++, 1000));
    }

    // Always add a save step at the end
    if (parameters.fileName) {
      steps.push(this.createStep('save_file', 'Save file', { fileName: parameters.fileName }, order++, 1000));
    }

    return steps;
  }

  private generateStepsFromTemplate(template: Partial<ExcelTask>): ExcelStep[] {
    if (!template.parameters) return [];

    const steps: ExcelStep[] = [];
    let order = 1;

    steps.push(this.createStep('new_workbook', 'Create new workbook', {}, order++, 1000));
    
    if (template.parameters.worksheetName) {
      steps.push(this.createStep('add_worksheet', 'Add worksheet', { name: template.parameters.worksheetName }, order++, 500));
    }

    if (template.parameters.headers) {
      steps.push(this.createStep('enter_data', 'Add headers', { range: 'A1', data: [template.parameters.headers] }, order++, 800));
    }

    if (template.parameters.data) {
      steps.push(this.createStep('enter_data', 'Enter template data', { data: template.parameters.data }, order++, 1500));
    }

    if (template.parameters.fileName) {
      steps.push(this.createStep('save_file', 'Save file', { fileName: template.parameters.fileName }, order++, 1000));
    }

    return steps;
  }

  private createStep(action: ExcelAction, description: string, parameters: Record<string, any>, order: number, estimatedTime: number): ExcelStep {
    return {
      id: `step_${order}`,
      action,
      description,
      parameters,
      order,
      estimatedTime
    };
  }

  private estimateExecutionTime(steps: ExcelStep[]): number {
    return Math.round(steps.reduce((total, step) => total + step.estimatedTime, 0) / 1000);
  }

  private calculateConfidence(input: string, taskType: ExcelTaskType): number {
    const keywords = this.keywords[taskType] || [];
    const score = this.calculateKeywordScore(input, keywords);
    
    // Additional confidence factors
    let confidence = score;
    
    // Boost confidence for clear file operations
    if (input.includes('file') || input.includes('spreadsheet')) confidence += 0.1;
    
    // Boost confidence for specific Excel terms
    if (input.includes('excel') || input.includes('worksheet')) confidence += 0.2;
    
    // Reduce confidence for vague requests
    if (input.length < 10) confidence -= 0.2;
    
    return Math.max(0, Math.min(1, confidence));
  }

  private generateAlternatives(input: string, primaryType: ExcelTaskType): ExcelTask[] {
    // Generate 1-2 alternative interpretations
    const alternatives: ExcelTask[] = [];
    
    // If primary is create_spreadsheet, alternative could be add_data
    if (primaryType === 'create_spreadsheet' && input.includes('data')) {
      const altParams = this.extractParameters(input, 'add_data');
      const altSteps = this.generateSteps('add_data', altParams);
      
      alternatives.push({
        id: this.generateTaskId(),
        type: 'add_data',
        description: `Alternative: ${input}`,
        complexity: 'simple',
        estimatedActions: altSteps.length,
        parameters: altParams,
        mode: 'visual',
        priority: 2,
        status: 'pending',
        steps: altSteps,
        metadata: {
          createdAt: new Date(),
          estimatedDuration: this.estimateExecutionTime(altSteps)
        }
      });
    }

    return alternatives;
  }

  private generateTaskId(): string {
    return `excel_task_${++this.taskCounter}_${Date.now()}`;
  }

  // Public utility methods
  parseQuickAction(actionType: string): ParseResult {
    const quickActions: Record<string, string> = {
      'new_spreadsheet': 'Create new spreadsheet',
      'import_data': 'Import data from file',
      'generate_report': 'Generate financial report',
      'create_chart': 'Create chart from selected data',
      'build_pivot': 'Build pivot table analysis'
    };

    const description = quickActions[actionType];
    if (!description) {
      return {
        success: false,
        error: 'Unknown quick action',
        confidence: 0
      };
    }

    return this.parse(description);
  }

  validateTask(task: ExcelTask): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!task.id || !task.type || !task.description) {
      errors.push('Missing required task fields');
    }

    if (task.steps.length === 0) {
      errors.push('Task has no execution steps');
    }

    if (task.estimatedActions !== task.steps.length) {
      errors.push('Estimated actions count does not match steps');
    }

    // Validate step sequence
    for (let i = 0; i < task.steps.length; i++) {
      if (task.steps[i].order !== i + 1) {
        errors.push(`Step ${i + 1} has incorrect order`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  estimateComplexity(input: string): 'simple' | 'complex' {
    const complexityIndicators = [
      'pivot', 'macro', 'multiple sheets', 'complex formula', 
      'vba', 'advanced', 'automation', 'batch', 'bulk'
    ];

    const hasComplexIndicators = complexityIndicators.some(indicator => 
      input.toLowerCase().includes(indicator)
    );

    const estimatedSteps = Math.max(5, Math.min(50, input.split(' ').length));
    
    return hasComplexIndicators || estimatedSteps > 20 ? 'complex' : 'simple';
  }
}

export const excelParser = new ExcelParser();