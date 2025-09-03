import { ExcelTask } from './excelParser';
import { AutomationProgress } from './automation';

export interface DemoScenario {
  id: string;
  name: string;
  description: string;
  tasks: ExcelTask[];
  category: 'basic' | 'intermediate' | 'advanced';
  estimatedDuration: number;
}

export interface DemoState {
  isActive: boolean;
  scenario: DemoScenario | null;
  currentTaskIndex: number;
  progress: number;
  logs: string[];
}

class DemoModeService {
  private demoState: DemoState = {
    isActive: false,
    scenario: null,
    currentTaskIndex: 0,
    progress: 0,
    logs: []
  };

  private scenarios: DemoScenario[] = [
    {
      id: 'basic_data_entry',
      name: 'Basic Data Entry Demo',
      description: 'Demonstrates basic data entry, formatting, and simple formulas',
      category: 'basic',
      estimatedDuration: 120,
      tasks: [
        {
          id: 'demo_task_1',
          type: 'create_workbook',
          description: 'Create new Excel workbook for sales data',
          complexity: 'simple',
          estimatedActions: 2,
          parameters: { fileName: 'Sales_Demo.xlsx' },
          mode: 'visual',
          priority: 1,
          status: 'pending',
          steps: [
            { id: '1', action: 'create_workbook', description: 'Create new workbook', parameters: {}, order: 1, estimatedTime: 5 },
            { id: '2', action: 'setup_structure', description: 'Set up worksheet structure', parameters: {}, order: 2, estimatedTime: 5 }
          ],
          metadata: { createdAt: new Date(), estimatedDuration: 10 }
        },
        {
          id: 'demo_task_2',
          type: 'enter_data',
          description: 'Enter sample sales data with headers',
          complexity: 'simple',
          estimatedActions: 8,
          parameters: {
            data: [
              ['Date', 'Product', 'Quantity', 'Price', 'Total'],
              ['2024-01-15', 'Laptop', '5', '$1200', '=C2*D2'],
              ['2024-01-16', 'Mouse', '25', '$25', '=C3*D3'],
              ['2024-01-17', 'Keyboard', '15', '$75', '=C4*D4']
            ]
          },
          mode: 'visual',
          priority: 1,
          status: 'pending',
          steps: [
            { id: '1', action: 'select_cell', description: 'Select starting cell A1', parameters: {}, order: 1, estimatedTime: 2 },
            { id: '2', action: 'enter_data', description: 'Enter column headers', parameters: {}, order: 2, estimatedTime: 5 },
            { id: '3', action: 'enter_data', description: 'Enter sales data rows', parameters: {}, order: 3, estimatedTime: 10 },
            { id: '4', action: 'insert_formula', description: 'Apply formulas in Total column', parameters: {}, order: 4, estimatedTime: 8 }
          ],
          metadata: { createdAt: new Date(), estimatedDuration: 25 }
        },
        {
          id: 'demo_task_3',
          type: 'format_table',
          description: 'Format data as professional table with styling',
          complexity: 'simple',
          estimatedActions: 5,
          parameters: { range: 'A1:E4', style: 'TableStyleMedium2' },
          mode: 'visual',
          priority: 1,
          status: 'pending',
          steps: [
            { id: '1', action: 'select_range', description: 'Select data range', parameters: {}, order: 1, estimatedTime: 3 },
            { id: '2', action: 'format_table', description: 'Apply table formatting', parameters: {}, order: 2, estimatedTime: 7 },
            { id: '3', action: 'add_filter', description: 'Add table filters', parameters: {}, order: 3, estimatedTime: 5 }
          ],
          metadata: { createdAt: new Date(), estimatedDuration: 15 }
        },
        {
          id: 'demo_task_4',
          type: 'create_chart',
          description: 'Create column chart showing sales by product',
          complexity: 'simple',
          estimatedActions: 6,
          parameters: { chartType: 'column', dataRange: 'B1:D4' },
          mode: 'visual',
          priority: 1,
          status: 'pending',
          steps: [
            { id: '1', action: 'select_range', description: 'Select chart data range', parameters: {}, order: 1, estimatedTime: 3 },
            { id: '2', action: 'create_chart', description: 'Insert column chart', parameters: {}, order: 2, estimatedTime: 10 },
            { id: '3', action: 'format_chart', description: 'Format chart title and labels', parameters: {}, order: 3, estimatedTime: 7 }
          ],
          metadata: { createdAt: new Date(), estimatedDuration: 20 }
        }
      ]
    },
    {
      id: 'financial_analysis',
      name: 'Financial Analysis Demo',
      description: 'Advanced financial calculations, pivot tables, and analysis',
      category: 'advanced',
      estimatedDuration: 300,
      tasks: [
        {
          id: 'demo_finance_1',
          type: 'create_workbook',
          description: 'Create financial analysis workbook with multiple sheets',
          complexity: 'complex',
          estimatedActions: 5,
          parameters: { fileName: 'Financial_Analysis.xlsx', sheets: ['Data', 'Analysis', 'Dashboard'] },
          mode: 'background',
          priority: 1,
          status: 'pending',
          steps: [
            { id: '1', action: 'create_workbook', description: 'Create workbook with multiple sheets', parameters: {}, order: 1, estimatedTime: 8 },
            { id: '2', action: 'setup_structure', description: 'Set up sheet structure', parameters: {}, order: 2, estimatedTime: 7 }
          ],
          metadata: { createdAt: new Date(), estimatedDuration: 15 }
        },
        {
          id: 'demo_finance_2',
          type: 'import_data',
          description: 'Import financial data from CSV with data validation',
          complexity: 'complex',
          estimatedActions: 12,
          parameters: { 
            source: 'financial_data.csv',
            validation: true,
            cleanData: true
          },
          mode: 'background',
          priority: 1,
          status: 'pending',
          steps: [
            { id: '1', action: 'import_data', description: 'Import CSV financial data', parameters: {}, order: 1, estimatedTime: 15 },
            { id: '2', action: 'validate_data', description: 'Validate data integrity', parameters: {}, order: 2, estimatedTime: 10 },
            { id: '3', action: 'format_data', description: 'Clean and format data', parameters: {}, order: 3, estimatedTime: 20 }
          ],
          metadata: { createdAt: new Date(), estimatedDuration: 45 }
        },
        {
          id: 'demo_finance_3',
          type: 'create_pivot_table',
          description: 'Create pivot table for financial analysis by department and month',
          complexity: 'complex',
          estimatedActions: 10,
          parameters: {
            sourceRange: 'Data!A1:F1000',
            pivotFields: {
              rows: ['Department', 'Month'],
              columns: ['Category'],
              values: ['Amount'],
              filters: ['Year']
            }
          },
          mode: 'background',
          priority: 1,
          status: 'pending',
          steps: [
            { id: '1', action: 'create_pivot_table', description: 'Create pivot table structure', parameters: {}, order: 1, estimatedTime: 20 },
            { id: '2', action: 'configure_fields', description: 'Configure fields and calculations', parameters: {}, order: 2, estimatedTime: 25 },
            { id: '3', action: 'format_pivot', description: 'Apply formatting and filters', parameters: {}, order: 3, estimatedTime: 15 }
          ],
          metadata: { createdAt: new Date(), estimatedDuration: 60 }
        },
        {
          id: 'demo_finance_4',
          type: 'advanced_formulas',
          description: 'Implement complex financial formulas and conditional logic',
          complexity: 'complex',
          estimatedActions: 15,
          parameters: {
            formulas: [
              'NPV calculations',
              'IRR analysis', 
              'Conditional formatting for variances',
              'Dynamic ranges with INDIRECT'
            ]
          },
          mode: 'background',
          priority: 1,
          status: 'pending',
          steps: [
            { id: '1', action: 'insert_formula', description: 'Implement NPV and IRR formulas', parameters: {}, order: 1, estimatedTime: 35 },
            { id: '2', action: 'apply_formatting', description: 'Add conditional formatting rules', parameters: {}, order: 2, estimatedTime: 30 },
            { id: '3', action: 'create_formula', description: 'Create dynamic range formulas', parameters: {}, order: 3, estimatedTime: 25 }
          ],
          metadata: { createdAt: new Date(), estimatedDuration: 90 }
        }
      ]
    },
    {
      id: 'dashboard_creation',
      name: 'Interactive Dashboard Demo',
      description: 'Create professional dashboard with charts, slicers, and interactivity',
      category: 'intermediate',
      estimatedDuration: 240,
      tasks: [
        {
          id: 'demo_dashboard_1',
          type: 'create_workbook',
          description: 'Set up dashboard workbook with data and visualization sheets',
          complexity: 'simple',
          estimatedActions: 4,
          parameters: { 
            fileName: 'Executive_Dashboard.xlsx',
            sheets: ['Raw Data', 'Calculations', 'Dashboard']
          },
          mode: 'visual',
          priority: 1,
          status: 'pending',
          steps: [
            { id: '1', action: 'create_workbook', description: 'Create multi-sheet workbook', parameters: {}, order: 1, estimatedTime: 10 },
            { id: '2', action: 'import_data', description: 'Import sample business data', parameters: {}, order: 2, estimatedTime: 10 }
          ],
          metadata: { createdAt: new Date(), estimatedDuration: 20 }
        },
        {
          id: 'demo_dashboard_2',
          type: 'create_charts',
          description: 'Create multiple chart types for different KPIs',
          complexity: 'complex',
          estimatedActions: 20,
          parameters: {
            charts: [
              { type: 'line', title: 'Revenue Trend', data: 'A1:B12' },
              { type: 'pie', title: 'Market Share', data: 'D1:E6' },
              { type: 'bar', title: 'Regional Performance', data: 'G1:H8' },
              { type: 'gauge', title: 'Goal Achievement', data: 'J1:K2' }
            ]
          },
          mode: 'visual',
          priority: 1,
          status: 'pending',
          steps: [
            { id: '1', action: 'create_chart', description: 'Create revenue trend line chart', parameters: {}, order: 1, estimatedTime: 20 },
            { id: '2', action: 'create_chart', description: 'Create market share pie chart', parameters: {}, order: 2, estimatedTime: 20 },
            { id: '3', action: 'create_chart', description: 'Create regional performance bar chart', parameters: {}, order: 3, estimatedTime: 20 },
            { id: '4', action: 'create_chart', description: 'Create KPI gauge charts', parameters: {}, order: 4, estimatedTime: 20 }
          ],
          metadata: { createdAt: new Date(), estimatedDuration: 80 }
        },
        {
          id: 'demo_dashboard_3',
          type: 'add_interactivity',
          description: 'Add slicers, drop-downs, and interactive elements',
          complexity: 'complex',
          estimatedActions: 12,
          parameters: {
            interactivity: [
              'Date range slicer',
              'Product category dropdown',
              'Region filter buttons',
              'Dynamic title updates'
            ]
          },
          mode: 'visual',
          priority: 1,
          status: 'pending',
          steps: [
            { id: '1', action: 'add_slicer', description: 'Add date range slicer', parameters: {}, order: 1, estimatedTime: 20 },
            { id: '2', action: 'create_dropdown', description: 'Create category dropdown', parameters: {}, order: 2, estimatedTime: 20 },
            { id: '3', action: 'link_filters', description: 'Link filters to charts', parameters: {}, order: 3, estimatedTime: 20 }
          ],
          metadata: { createdAt: new Date(), estimatedDuration: 60 }
        }
      ]
    }
  ];

  // Start demo scenario
  async startDemo(scenarioId: string, onProgress?: (progress: AutomationProgress) => void): Promise<boolean> {
    const scenario = this.scenarios.find(s => s.id === scenarioId);
    if (!scenario) {
      console.error(`Demo scenario not found: ${scenarioId}`);
      return false;
    }

    this.demoState = {
      isActive: true,
      scenario,
      currentTaskIndex: 0,
      progress: 0,
      logs: [`Started demo: ${scenario.name}`]
    };

    // Run through the scenario tasks
    await this.executeScenario(onProgress);
    return true;
  }

  private async executeScenario(onProgress?: (progress: AutomationProgress) => void): Promise<void> {
    if (!this.demoState.scenario) return;

    const { tasks } = this.demoState.scenario;
    
    for (let i = 0; i < tasks.length; i++) {
      this.demoState.currentTaskIndex = i;
      const task = tasks[i];
      
      this.addLog(`Executing task ${i + 1}/${tasks.length}: ${task.description}`);
      
      // Simulate task execution with progress updates
      await this.simulateTaskExecution(task, (progress) => {
        // Calculate overall progress across all tasks
        const taskProgress = (i / tasks.length) * 100 + (progress.progress / tasks.length);
        this.demoState.progress = Math.round(taskProgress);
        
        if (onProgress) {
          onProgress({
            taskId: task.id,
            status: progress.status,
            progress: this.demoState.progress,
            currentStep: `[Demo ${i + 1}/${tasks.length}] ${progress.currentStep}`,
            message: progress.message
          });
        }
      });
    }

    // Demo complete
    this.demoState.isActive = false;
    this.demoState.progress = 100;
    this.addLog('Demo completed successfully!');

    if (onProgress) {
      onProgress({
        taskId: 'demo_complete',
        status: 'completed',
        progress: 100,
        currentStep: 'Demo completed',
        message: 'All demo tasks completed successfully'
      });
    }
  }

  private async simulateTaskExecution(
    task: ExcelTask,
    onProgress: (progress: AutomationProgress) => void
  ): Promise<void> {
    const steps = task.steps;
    const stepDuration = (task.metadata.estimatedDuration * 1000) / steps.length;
    
    for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
      const step = steps[stepIndex];
      const stepProgress = Math.round(((stepIndex + 1) / steps.length) * 100);
      
      onProgress({
        taskId: task.id,
        status: stepIndex === steps.length - 1 ? 'completed' : 'in_progress',
        progress: stepProgress,
        currentStep: step.description,
        message: `Simulating: ${step.description}`
      });

      // Simulate realistic delay
      await this.delay(stepDuration);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private addLog(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    this.demoState.logs.push(`[${timestamp}] ${message}`);
    
    // Keep only last 50 logs
    if (this.demoState.logs.length > 50) {
      this.demoState.logs = this.demoState.logs.slice(-50);
    }
  }

  // Quick demo functions
  async runQuickDemo(type: 'chart' | 'table' | 'formula' | 'pivot', onProgress?: (progress: AutomationProgress) => void): Promise<void> {
    const quickTasks: Record<string, ExcelTask> = {
      chart: {
        id: 'quick_chart_demo',
        type: 'create_chart',
        description: 'Quick chart creation demo',
        complexity: 'simple',
        estimatedActions: 4,
        parameters: { chartType: 'column' },
        mode: 'visual',
        priority: 1,
        status: 'pending',
        steps: [
          { id: '1', action: 'generate_data', description: 'Generate sample data', parameters: {}, order: 1, estimatedTime: 3 },
          { id: '2', action: 'select_range', description: 'Select data range', parameters: {}, order: 2, estimatedTime: 2 },
          { id: '3', action: 'create_chart', description: 'Insert column chart', parameters: {}, order: 3, estimatedTime: 6 },
          { id: '4', action: 'format_chart', description: 'Format chart appearance', parameters: {}, order: 4, estimatedTime: 4 }
        ],
        metadata: { createdAt: new Date(), estimatedDuration: 15 }
      },
      table: {
        id: 'quick_table_demo',
        type: 'format_table',
        description: 'Quick table formatting demo',
        complexity: 'simple',
        estimatedActions: 3,
        parameters: { style: 'professional' },
        mode: 'visual',
        priority: 1,
        status: 'pending',
        steps: [
          { id: '1', action: 'generate_data', description: 'Create sample data set', parameters: {}, order: 1, estimatedTime: 3 },
          { id: '2', action: 'format_table', description: 'Apply table formatting', parameters: {}, order: 2, estimatedTime: 4 },
          { id: '3', action: 'add_filter', description: 'Add filters and sorting', parameters: {}, order: 3, estimatedTime: 3 }
        ],
        metadata: { createdAt: new Date(), estimatedDuration: 10 }
      },
      formula: {
        id: 'quick_formula_demo',
        type: 'create_formulas',
        description: 'Quick formula demonstration',
        complexity: 'simple',
        estimatedActions: 5,
        parameters: { formulaTypes: ['SUM', 'AVERAGE', 'VLOOKUP'] },
        mode: 'visual',
        priority: 1,
        status: 'pending',
        steps: [
          { id: '1', action: 'setup_data', description: 'Set up calculation data', parameters: {}, order: 1, estimatedTime: 4 },
          { id: '2', action: 'insert_formula', description: 'Add SUM formulas', parameters: {}, order: 2, estimatedTime: 4 },
          { id: '3', action: 'insert_formula', description: 'Create AVERAGE calculations', parameters: {}, order: 3, estimatedTime: 4 },
          { id: '4', action: 'insert_formula', description: 'Implement VLOOKUP function', parameters: {}, order: 4, estimatedTime: 5 },
          { id: '5', action: 'validate_data', description: 'Test and validate results', parameters: {}, order: 5, estimatedTime: 3 }
        ],
        metadata: { createdAt: new Date(), estimatedDuration: 20 }
      },
      pivot: {
        id: 'quick_pivot_demo',
        type: 'create_pivot_table',
        description: 'Quick pivot table demo',
        complexity: 'complex',
        estimatedActions: 6,
        parameters: { analysisType: 'sales_summary' },
        mode: 'background',
        priority: 1,
        status: 'pending',
        steps: [
          { id: '1', action: 'generate_data', description: 'Generate dataset for analysis', parameters: {}, order: 1, estimatedTime: 5 },
          { id: '2', action: 'create_pivot_table', description: 'Create pivot table structure', parameters: {}, order: 2, estimatedTime: 5 },
          { id: '3', action: 'configure_fields', description: 'Configure row and column fields', parameters: {}, order: 3, estimatedTime: 5 },
          { id: '4', action: 'add_calculation', description: 'Add value calculations', parameters: {}, order: 4, estimatedTime: 5 },
          { id: '5', action: 'format_pivot', description: 'Apply formatting and filters', parameters: {}, order: 5, estimatedTime: 5 },
          { id: '6', action: 'create_chart', description: 'Create pivot chart visualization', parameters: {}, order: 6, estimatedTime: 5 }
        ],
        metadata: { createdAt: new Date(), estimatedDuration: 30 }
      }
    };

    const task = quickTasks[type];
    if (!task) return;

    this.demoState = {
      isActive: true,
      scenario: null,
      currentTaskIndex: 0,
      progress: 0,
      logs: [`Started quick ${type} demo`]
    };

    await this.simulateTaskExecution(task, (progress) => {
      this.demoState.progress = progress.progress;
      this.addLog(`${progress.currentStep} (${progress.progress}%)`);
      
      if (onProgress) {
        onProgress({
          ...progress,
          currentStep: `[Quick Demo] ${progress.currentStep}`
        });
      }
    });

    this.demoState.isActive = false;
    this.addLog(`Quick ${type} demo completed!`);
  }

  // Demo control
  stopDemo(): void {
    this.demoState.isActive = false;
    this.addLog('Demo stopped by user');
  }

  resetDemo(): void {
    this.demoState = {
      isActive: false,
      scenario: null,
      currentTaskIndex: 0,
      progress: 0,
      logs: []
    };
  }

  // Getters
  getScenarios(): DemoScenario[] {
    return [...this.scenarios];
  }

  getDemoState(): DemoState {
    return { ...this.demoState };
  }

  isDemo(): boolean {
    return this.demoState.isActive;
  }

  getLogs(): string[] {
    return [...this.demoState.logs];
  }

  // Generate realistic demo data
  generateSampleData(type: 'sales' | 'financial' | 'inventory' | 'hr'): any[][] {
    const generators = {
      sales: () => [
        ['Date', 'Product', 'Region', 'Salesperson', 'Quantity', 'Revenue'],
        ['2024-01-15', 'Laptop Pro', 'North', 'Alice Johnson', 5, 12500],
        ['2024-01-16', 'Desktop PC', 'South', 'Bob Smith', 3, 4500],
        ['2024-01-17', 'Monitor 4K', 'East', 'Carol Davis', 12, 6000],
        ['2024-01-18', 'Keyboard Mech', 'West', 'Dave Wilson', 25, 3750],
        ['2024-01-19', 'Mouse Wireless', 'North', 'Alice Johnson', 50, 2500]
      ],
      financial: () => [
        ['Account', 'Category', 'Q1', 'Q2', 'Q3', 'Q4'],
        ['Revenue', 'Income', 125000, 135000, 142000, 158000],
        ['COGS', 'Expense', 75000, 81000, 85000, 95000],
        ['Marketing', 'Expense', 15000, 18000, 20000, 22000],
        ['Operations', 'Expense', 25000, 27000, 28000, 30000],
        ['Net Profit', 'Income', 10000, 9000, 9000, 11000]
      ],
      inventory: () => [
        ['SKU', 'Product Name', 'Category', 'Current Stock', 'Min Stock', 'Max Stock', 'Unit Cost'],
        ['LAP001', 'Laptop Pro 15"', 'Electronics', 25, 10, 50, 800],
        ['MON001', '4K Monitor 27"', 'Electronics', 15, 5, 30, 350],
        ['KEY001', 'Mechanical Keyboard', 'Accessories', 45, 20, 100, 120],
        ['MOU001', 'Wireless Mouse', 'Accessories', 60, 25, 150, 45],
        ['TAB001', 'Tablet Pro 12"', 'Electronics', 8, 5, 25, 650]
      ],
      hr: () => [
        ['Employee ID', 'Name', 'Department', 'Position', 'Hire Date', 'Salary'],
        ['EMP001', 'John Smith', 'Engineering', 'Senior Developer', '2022-03-15', 95000],
        ['EMP002', 'Jane Doe', 'Marketing', 'Marketing Manager', '2021-07-22', 75000],
        ['EMP003', 'Mike Johnson', 'Sales', 'Sales Representative', '2023-01-10', 55000],
        ['EMP004', 'Sarah Wilson', 'HR', 'HR Specialist', '2022-09-05', 60000],
        ['EMP005', 'Tom Brown', 'Engineering', 'QA Engineer', '2023-04-18', 70000]
      ]
    };

    return generators[type]();
  }
}

export const demoModeService = new DemoModeService();