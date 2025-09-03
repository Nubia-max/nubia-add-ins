export interface ExcelTask {
  command: string;
  type: 'formula' | 'chart' | 'pivot' | 'data_entry' | 'formatting' | 'analysis';
  complexity: 'simple' | 'complex';
  steps: string[];
}

export function analyzeExcelCommand(message: string): ExcelTask | null {
  const lower = message.toLowerCase();
  
  // Detect formula requests
  if (lower.includes('formula') || lower.includes('calculate') || lower.includes('sum') || lower.includes('average') || lower.includes('vlookup')) {
    return {
      command: message,
      type: 'formula',
      complexity: 'simple',
      steps: [
        '1. Opening Excel',
        '2. Selecting target cell',
        '3. Writing formula',
        '4. Applying to range',
        '5. Formatting results'
      ]
    };
  }
  
  // Detect chart requests
  if (lower.includes('chart') || lower.includes('graph') || lower.includes('visualization') || lower.includes('plot')) {
    return {
      command: message,
      type: 'chart',
      complexity: 'complex',
      steps: [
        '1. Analyzing data range',
        '2. Selecting chart type',
        '3. Creating visualization',
        '4. Applying styling',
        '5. Adding labels and legend'
      ]
    };
  }
  
  // Detect pivot table requests
  if (lower.includes('pivot') || lower.includes('summarize') || lower.includes('group by')) {
    return {
      command: message,
      type: 'pivot',
      complexity: 'complex',
      steps: [
        '1. Selecting data range',
        '2. Creating pivot table',
        '3. Configuring fields',
        '4. Applying filters',
        '5. Formatting output'
      ]
    };
  }
  
  // Detect data entry requests
  if (lower.includes('enter data') || lower.includes('input') || lower.includes('fill cells')) {
    return {
      command: message,
      type: 'data_entry',
      complexity: 'simple',
      steps: [
        '1. Navigating to cells',
        '2. Entering data',
        '3. Validating entries',
        '4. Auto-filling patterns',
        '5. Saving changes'
      ]
    };
  }
  
  // Detect formatting requests
  if (lower.includes('format') || lower.includes('style') || lower.includes('color') || lower.includes('bold')) {
    return {
      command: message,
      type: 'formatting',
      complexity: 'simple',
      steps: [
        '1. Selecting range',
        '2. Opening format menu',
        '3. Applying styles',
        '4. Adjusting layout',
        '5. Preview changes'
      ]
    };
  }
  
  // Detect analysis requests
  if (lower.includes('analyze') || lower.includes('trend') || lower.includes('correlation') || lower.includes('statistics')) {
    return {
      command: message,
      type: 'analysis',
      complexity: 'complex',
      steps: [
        '1. Loading data',
        '2. Running analysis',
        '3. Generating insights',
        '4. Creating report',
        '5. Exporting results'
      ]
    };
  }
  
  return null;
}

export function simulateExcelAutomation(task: ExcelTask, onProgress?: (step: number, stepText: string) => void): Promise<string> {
  return new Promise((resolve) => {
    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < task.steps.length) {
        if (onProgress) {
          onProgress(currentStep, task.steps[currentStep]);
        }
        currentStep++;
      } else {
        clearInterval(interval);
        resolve(`✅ Excel task completed: ${task.command}`);
      }
    }, 1500); // 1.5 seconds per step for realistic feel
  });
}

export function getAutomationModeDescription(mode: 'visual' | 'background'): string {
  return mode === 'visual' 
    ? 'Shows Excel window and automation steps visually'
    : 'Runs automation in background without showing Excel';
}