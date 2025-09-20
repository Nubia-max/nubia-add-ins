/**
 * Multi-Intent Service for handling compound Excel requests
 * Detects and splits complex user messages into sequential tasks
 */

interface Task {
  intent: 'greeting' | 'formula' | 'formatting' | 'chart' | 'data-analysis' | 'general' | 'clear';
  task: string;
  dependencies: string[];
  priority: number;
}

interface CombinedResult {
  feedback: string;
  operations: any[];
  tasks: number;
  success: boolean;
}

interface MultiIntentDetection {
  hasMultiple: boolean;
  count: number;
  confidence: number;
}

export class MultiIntentService {
  private maxTasksPerRequest = 5;
  private sequentialExecution = true;

  /**
   * Detect if message contains multiple intents
   */
  async detectMultipleIntents(message: string): Promise<MultiIntentDetection> {
    // Quick heuristic checks for obvious multi-intent patterns
    const multiIntentIndicators = [
      /\b(and|then|also|plus|after|next|followed by)\b/gi,
      /[,;]/g, // Commas and semicolons often separate tasks
      /\b(first|second|third|finally|lastly)\b/gi,
      /\d+[\.\)]\s/g // Numbered lists (1. 2. 3.)
    ];

    const indicatorCount = multiIntentIndicators.reduce((count, pattern) => {
      const matches = message.match(pattern);
      return count + (matches ? matches.length : 0);
    }, 0);

    // Simple intent keywords count
    const intentKeywords = [
      // Greetings
      ['hi', 'hello', 'hey', 'good morning'],
      // Formulas
      ['sum', 'average', 'count', 'formula', 'calculate'],
      // Formatting
      ['bold', 'italic', 'color', 'format', 'highlight'],
      // Charts
      ['chart', 'graph', 'plot', 'visualize'],
      // Data analysis
      ['analyze', 'trends', 'insights', 'pivot'],
      // General actions
      ['create', 'add', 'insert', 'make', 'generate']
    ];

    let intentTypeCount = 0;
    for (const keywords of intentKeywords) {
      const hasKeyword = keywords.some(keyword =>
        new RegExp(`\\b${keyword}\\b`, 'i').test(message)
      );
      if (hasKeyword) intentTypeCount++;
    }

    // Determine if multiple intents exist
    const hasMultiple = indicatorCount > 0 || intentTypeCount > 1;
    const count = Math.max(intentTypeCount, indicatorCount + 1);
    const confidence = hasMultiple ? Math.min(0.6 + (indicatorCount * 0.1) + (intentTypeCount * 0.1), 0.95) : 0.3;

    return {
      hasMultiple,
      count: Math.min(count, this.maxTasksPerRequest),
      confidence
    };
  }

  /**
   * Split compound message into individual tasks using AI-like analysis
   */
  async splitIntoTasks(message: string): Promise<Task[]> {
    const tasks: Task[] = [];

    // Split by common separators and conjunctions
    const segments = this.segmentMessage(message);

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i].trim();
      if (!segment) continue;

      const intent = this.classifySegmentIntent(segment);
      const dependencies = this.identifyDependencies(segment, tasks);

      tasks.push({
        intent,
        task: this.cleanTaskDescription(segment),
        dependencies,
        priority: this.calculatePriority(intent, i)
      });
    }

    // Sort by priority (greetings first, then by dependencies)
    return this.sortTasksByPriority(tasks);
  }

  /**
   * Execute tasks sequentially with dependency handling
   */
  async executeTasks(tasks: Task[], context: any, executorFunction: Function): Promise<CombinedResult> {
    const results: any[] = [];
    const completedTasks: string[] = [];
    let updatedContext = { ...context };

    try {
      for (const task of tasks) {
        // Check if dependencies are met
        const dependenciesMet = task.dependencies.every(dep => completedTasks.includes(dep));

        if (!dependenciesMet) {
          results.push({
            task: task.task,
            status: 'skipped',
            reason: 'Dependencies not met',
            summary: `⚠️ Skipped: ${task.task} (dependencies not ready)`
          });
          continue;
        }

        // Execute the task
        try {
          const result = await executorFunction(task.task, updatedContext, task.intent);

          results.push({
            task: task.task,
            intent: task.intent,
            status: 'completed',
            result,
            summary: this.generateTaskSummary(task, result)
          });

          completedTasks.push(task.intent);

          // Update context for next task
          updatedContext = this.updateContextFromResult(updatedContext, result, task);

        } catch (error) {
          results.push({
            task: task.task,
            status: 'failed',
            error: error.message,
            summary: `❌ Failed: ${task.task} (${error.message})`
          });
        }
      }

      return {
        feedback: this.combineFeedback(results),
        operations: results.filter(r => r.status === 'completed').map(r => r.result),
        tasks: tasks.length,
        success: results.some(r => r.status === 'completed')
      };

    } catch (error) {
      return {
        feedback: `Error processing multi-intent request: ${error.message}`,
        operations: [],
        tasks: tasks.length,
        success: false
      };
    }
  }

  /**
   * Combine results into user-friendly feedback
   */
  private combineFeedback(results: any[]): string {
    const summaries = results.map(r => r.summary).filter(Boolean);

    if (summaries.length === 0) {
      return "No tasks were completed successfully.";
    }

    const header = `Completed ${summaries.length} task${summaries.length > 1 ? 's' : ''}:\n\n`;
    return header + summaries.join('\n');
  }

  /**
   * Segment message by separators and conjunctions
   */
  private segmentMessage(message: string): string[] {
    // Split by common separators
    let segments = [message];

    // Split by conjunctions that indicate separate tasks
    const separators = [
      /\s+and\s+(?:then\s+)?/gi,
      /\s*,\s*(?:and\s+)?(?:then\s+)?/gi,
      /\s+then\s+/gi,
      /\s*;\s*/gi,
      /\s+also\s+/gi,
      /\s+plus\s+/gi,
      /\s+after\s+that\s+/gi,
      /\s+next\s+/gi
    ];

    for (const separator of separators) {
      const newSegments: string[] = [];
      for (const segment of segments) {
        newSegments.push(...segment.split(separator));
      }
      segments = newSegments;
    }

    return segments.filter(s => s.trim().length > 0);
  }

  /**
   * Classify the intent of a message segment
   */
  private classifySegmentIntent(segment: string): Task['intent'] {
    const lower = segment.toLowerCase();

    // Greeting patterns
    if (/\b(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(lower)) {
      return 'greeting';
    }

    // Formula patterns
    if (/\b(sum|average|count|total|calculate|formula|max|min|if|vlookup)\b/.test(lower)) {
      return 'formula';
    }

    // Formatting patterns
    if (/\b(bold|italic|color|format|highlight|font|style|border)\b/.test(lower)) {
      return 'formatting';
    }

    // Chart patterns
    if (/\b(chart|graph|plot|visualize|diagram)\b/.test(lower)) {
      return 'chart';
    }

    // Data analysis patterns
    if (/\b(analyze|analysis|trends|insights|pivot|summary|report)\b/.test(lower)) {
      return 'data-analysis';
    }

    // Clear/delete patterns
    if (/\b(clear|delete|remove|clean)\b/.test(lower)) {
      return 'clear';
    }

    return 'general';
  }

  /**
   * Identify task dependencies
   */
  private identifyDependencies(segment: string, existingTasks: Task[]): string[] {
    const dependencies: string[] = [];
    const lower = segment.toLowerCase();

    // If this is a formatting task and there are formula tasks, it likely depends on them
    if (/\b(format|bold|color|style)\b/.test(lower)) {
      const formulaTasks = existingTasks.filter(t => t.intent === 'formula');
      if (formulaTasks.length > 0) {
        dependencies.push('formula');
      }
    }

    // Charts often depend on data being ready (formulas, formatting)
    if (/\b(chart|graph|plot)\b/.test(lower)) {
      const dataTasks = existingTasks.filter(t => ['formula', 'data-analysis'].includes(t.intent));
      if (dataTasks.length > 0) {
        dependencies.push(...dataTasks.map(t => t.intent));
      }
    }

    return dependencies;
  }

  /**
   * Calculate task priority (lower number = higher priority)
   */
  private calculatePriority(intent: Task['intent'], position: number): number {
    const basePriorities = {
      'greeting': 1,
      'clear': 2,
      'data-analysis': 3,
      'formula': 4,
      'formatting': 5,
      'chart': 6,
      'general': 7
    };

    return basePriorities[intent] + (position * 0.1);
  }

  /**
   * Sort tasks by priority and dependencies
   */
  private sortTasksByPriority(tasks: Task[]): Task[] {
    return tasks.sort((a, b) => {
      // Greetings always first
      if (a.intent === 'greeting' && b.intent !== 'greeting') return -1;
      if (b.intent === 'greeting' && a.intent !== 'greeting') return 1;

      // Then by priority
      if (a.priority !== b.priority) return a.priority - b.priority;

      // Then by dependency order
      if (a.dependencies.includes(b.intent)) return 1;
      if (b.dependencies.includes(a.intent)) return -1;

      return 0;
    });
  }

  /**
   * Clean and format task description
   */
  private cleanTaskDescription(segment: string): string {
    return segment
      .replace(/^(and|then|also|plus|after|next|first|second|third)\s+/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Generate user-friendly summary for completed task
   */
  private generateTaskSummary(task: Task, result: any): string {
    const taskVerbs = {
      'greeting': 'Acknowledged',
      'formula': 'Applied formula',
      'formatting': 'Applied formatting',
      'chart': 'Created chart',
      'data-analysis': 'Analyzed data',
      'clear': 'Cleared data',
      'general': 'Completed task'
    };

    const verb = taskVerbs[task.intent] || 'Completed';

    // Try to extract specifics from result if available
    if (result && typeof result === 'object') {
      if (result.type === 'action' && result.action) {
        return `✅ ${verb}: ${result.action} operation`;
      }
      if (result.message) {
        const shortMessage = result.message.substring(0, 60) + (result.message.length > 60 ? '...' : '');
        return `✅ ${verb}: ${shortMessage}`;
      }
    }

    return `✅ ${verb}: ${task.task}`;
  }

  /**
   * Update context with results from completed task
   */
  private updateContextFromResult(context: any, result: any, task: Task): any {
    const updatedContext = { ...context };

    // If a formula was applied, it might change the selected range or data
    if (task.intent === 'formula' && result && result.args) {
      if (result.args.address) {
        updatedContext.lastFormulaCell = result.args.address;
      }
      if (result.args.range) {
        updatedContext.selectedRange = result.args.range;
      }
    }

    // If formatting was applied, note the formatted range
    if (task.intent === 'formatting' && result && result.args) {
      if (result.args.range) {
        updatedContext.lastFormattedRange = result.args.range;
      }
    }

    return updatedContext;
  }
}