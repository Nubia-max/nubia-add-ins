import { ExcelTask } from './excelParser';
import { AutomationProgress } from './automation';

export interface ErrorInfo {
  id: string;
  type: 'service' | 'task' | 'network' | 'parsing' | 'validation' | 'system';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details?: string;
  timestamp: Date;
  taskId?: string;
  context?: Record<string, any>;
  resolved: boolean;
  retryCount: number;
  maxRetries: number;
}

export interface RecoveryAction {
  id: string;
  name: string;
  description: string;
  action: () => Promise<boolean>;
  automatic: boolean;
  priority: number;
}

export interface ErrorHandlerConfig {
  maxRetries: number;
  retryDelayMs: number;
  enableAutoRecovery: boolean;
  enableUserNotifications: boolean;
  logErrors: boolean;
}

class ErrorHandlerService {
  private errors: Map<string, ErrorInfo> = new Map();
  private errorListeners: ((error: ErrorInfo) => void)[] = [];
  private recoveryActions: Map<string, RecoveryAction[]> = new Map();
  private config: ErrorHandlerConfig = {
    maxRetries: 3,
    retryDelayMs: 2000,
    enableAutoRecovery: true,
    enableUserNotifications: true,
    logErrors: true
  };

  constructor() {
    this.setupDefaultRecoveryActions();
    this.setupGlobalErrorHandlers();
  }

  private setupDefaultRecoveryActions(): void {
    // Service connection recovery
    this.addRecoveryAction('service', {
      id: 'reconnect_service',
      name: 'Reconnect to Automation Service',
      description: 'Attempt to reconnect to the Python automation service',
      action: async () => {
        try {
          // In a real implementation, this would attempt to reconnect
          await this.delay(1000);
          console.log('Attempting to reconnect to automation service...');
          return Math.random() > 0.3; // 70% success rate for demo
        } catch (error) {
          return false;
        }
      },
      automatic: true,
      priority: 1
    });

    // Task retry recovery
    this.addRecoveryAction('task', {
      id: 'retry_task',
      name: 'Retry Failed Task',
      description: 'Retry the failed Excel automation task',
      action: async () => {
        try {
          await this.delay(2000);
          console.log('Retrying failed task...');
          return Math.random() > 0.4; // 60% success rate for demo
        } catch (error) {
          return false;
        }
      },
      automatic: false,
      priority: 2
    });

    // Network recovery
    this.addRecoveryAction('network', {
      id: 'check_connectivity',
      name: 'Check Network Connectivity',
      description: 'Verify network connection and DNS resolution',
      action: async () => {
        try {
          // Check if we can reach a known endpoint
          const response = await fetch('https://httpbin.org/status/200', { 
            method: 'GET',
            timeout: 5000 
          });
          return response.ok;
        } catch (error) {
          return false;
        }
      },
      automatic: true,
      priority: 1
    });

    // Excel file recovery
    this.addRecoveryAction('validation', {
      id: 'validate_excel_file',
      name: 'Validate Excel File',
      description: 'Check if the Excel file is accessible and not corrupted',
      action: async () => {
        try {
          await this.delay(1000);
          console.log('Validating Excel file integrity...');
          return Math.random() > 0.2; // 80% success rate for demo
        } catch (error) {
          return false;
        }
      },
      automatic: true,
      priority: 2
    });

    // System resource recovery
    this.addRecoveryAction('system', {
      id: 'free_resources',
      name: 'Free System Resources',
      description: 'Close unused processes and free memory',
      action: async () => {
        try {
          await this.delay(1500);
          console.log('Freeing system resources...');
          return true; // Always successful for demo
        } catch (error) {
          return false;
        }
      },
      automatic: true,
      priority: 3
    });
  }

  private setupGlobalErrorHandlers(): void {
    // Handle unhandled promise rejections
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', (event) => {
        this.handleError({
          type: 'system',
          severity: 'high',
          message: 'Unhandled promise rejection',
          details: event.reason?.toString() || 'Unknown error',
          context: { source: 'unhandledrejection' }
        });
      });

      // Handle general JavaScript errors
      window.addEventListener('error', (event) => {
        this.handleError({
          type: 'system',
          severity: 'medium',
          message: event.message || 'JavaScript error',
          details: `${event.filename}:${event.lineno}:${event.colno}`,
          context: { source: 'javascript', error: event.error }
        });
      });
    }
  }

  // Main error handling method
  async handleError(errorData: Partial<ErrorInfo>): Promise<ErrorInfo> {
    const error: ErrorInfo = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: errorData.type || 'system',
      severity: errorData.severity || 'medium',
      message: errorData.message || 'Unknown error',
      details: errorData.details,
      timestamp: new Date(),
      taskId: errorData.taskId,
      context: errorData.context || {},
      resolved: false,
      retryCount: 0,
      maxRetries: errorData.type === 'network' ? 5 : this.config.maxRetries
    };

    this.errors.set(error.id, error);

    // Log error if enabled
    if (this.config.logErrors) {
      console.error(`[ErrorHandler] ${error.type.toUpperCase()}: ${error.message}`, {
        details: error.details,
        context: error.context
      });
    }

    // Notify listeners
    this.notifyErrorListeners(error);

    // Attempt automatic recovery if enabled
    if (this.config.enableAutoRecovery) {
      await this.attemptAutoRecovery(error);
    }

    return error;
  }

  // Specific error handling methods
  async handleServiceError(message: string, details?: string, context?: Record<string, any>): Promise<ErrorInfo> {
    return this.handleError({
      type: 'service',
      severity: 'high',
      message,
      details,
      context
    });
  }

  async handleTaskError(taskId: string, message: string, details?: string): Promise<ErrorInfo> {
    return this.handleError({
      type: 'task',
      severity: 'medium',
      message,
      details,
      taskId,
      context: { taskId }
    });
  }

  async handleNetworkError(message: string, url?: string): Promise<ErrorInfo> {
    return this.handleError({
      type: 'network',
      severity: 'high',
      message,
      details: url ? `Failed to connect to: ${url}` : undefined,
      context: { url }
    });
  }

  async handleParsingError(message: string, input?: string): Promise<ErrorInfo> {
    return this.handleError({
      type: 'parsing',
      severity: 'low',
      message,
      details: input ? `Input: ${input.substring(0, 100)}...` : undefined,
      context: { input: input?.substring(0, 500) }
    });
  }

  async handleValidationError(message: string, data?: any): Promise<ErrorInfo> {
    return this.handleError({
      type: 'validation',
      severity: 'medium',
      message,
      details: data ? `Invalid data: ${JSON.stringify(data).substring(0, 200)}...` : undefined,
      context: { data }
    });
  }

  // Recovery methods
  async attemptAutoRecovery(error: ErrorInfo): Promise<boolean> {
    const actions = this.recoveryActions.get(error.type) || [];
    const automaticActions = actions
      .filter(action => action.automatic)
      .sort((a, b) => a.priority - b.priority);

    for (const action of automaticActions) {
      try {
        console.log(`[Recovery] Attempting automatic recovery: ${action.name}`);
        const success = await action.action();
        
        if (success) {
          error.resolved = true;
          this.errors.set(error.id, error);
          console.log(`[Recovery] Successfully recovered using: ${action.name}`);
          return true;
        }
      } catch (recoveryError) {
        console.error(`[Recovery] Failed to execute recovery action ${action.name}:`, recoveryError);
      }
    }

    return false;
  }

  async executeRecoveryAction(errorId: string, actionId: string): Promise<boolean> {
    const error = this.errors.get(errorId);
    if (!error) {
      console.error(`Error not found: ${errorId}`);
      return false;
    }

    const actions = this.recoveryActions.get(error.type) || [];
    const action = actions.find(a => a.id === actionId);
    
    if (!action) {
      console.error(`Recovery action not found: ${actionId}`);
      return false;
    }

    try {
      console.log(`[Recovery] Executing manual recovery: ${action.name}`);
      const success = await action.action();
      
      if (success) {
        error.resolved = true;
        this.errors.set(errorId, error);
        console.log(`[Recovery] Successfully recovered using: ${action.name}`);
      }
      
      return success;
    } catch (recoveryError) {
      console.error(`[Recovery] Failed to execute recovery action ${action.name}:`, recoveryError);
      return false;
    }
  }

  // Retry logic
  async retryOperation<T>(
    operation: () => Promise<T>,
    errorType: ErrorInfo['type'] = 'system',
    context?: Record<string, any>
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        if (attempt < this.config.maxRetries) {
          console.warn(`[Retry] Attempt ${attempt} failed, retrying in ${this.config.retryDelayMs}ms:`, error.message);
          await this.delay(this.config.retryDelayMs * attempt); // Exponential backoff
        }
      }
    }

    // All retries failed, handle the error
    await this.handleError({
      type: errorType,
      severity: 'high',
      message: `Operation failed after ${this.config.maxRetries} attempts`,
      details: lastError?.message,
      context: { ...context, attempts: this.config.maxRetries }
    });

    throw lastError!;
  }

  // Task-specific error handling
  async handleTaskProgress(taskId: string, progress: AutomationProgress): Promise<void> {
    if (progress.status === 'failed' && progress.error) {
      await this.handleTaskError(taskId, 'Task execution failed', progress.error);
    }
  }

  async handleTaskTimeout(taskId: string, timeoutMs: number): Promise<ErrorInfo> {
    return this.handleError({
      type: 'task',
      severity: 'medium',
      message: 'Task execution timeout',
      details: `Task ${taskId} exceeded ${timeoutMs}ms timeout`,
      taskId,
      context: { timeoutMs }
    });
  }

  // Error management
  addRecoveryAction(errorType: ErrorInfo['type'], action: RecoveryAction): void {
    if (!this.recoveryActions.has(errorType)) {
      this.recoveryActions.set(errorType, []);
    }
    this.recoveryActions.get(errorType)!.push(action);
  }

  addErrorListener(listener: (error: ErrorInfo) => void): void {
    this.errorListeners.push(listener);
  }

  removeErrorListener(listener: (error: ErrorInfo) => void): void {
    const index = this.errorListeners.indexOf(listener);
    if (index > -1) {
      this.errorListeners.splice(index, 1);
    }
  }

  private notifyErrorListeners(error: ErrorInfo): void {
    this.errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (listenerError) {
        console.error('Error in error listener:', listenerError);
      }
    });
  }

  // Utilities
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Getters and status
  getErrors(type?: ErrorInfo['type'], resolved?: boolean): ErrorInfo[] {
    return Array.from(this.errors.values())
      .filter(error => {
        if (type && error.type !== type) return false;
        if (resolved !== undefined && error.resolved !== resolved) return false;
        return true;
      })
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getError(errorId: string): ErrorInfo | undefined {
    return this.errors.get(errorId);
  }

  getRecoveryActions(errorType: ErrorInfo['type']): RecoveryAction[] {
    return this.recoveryActions.get(errorType) || [];
  }

  clearResolvedErrors(): void {
    Array.from(this.errors.entries()).forEach(([id, error]) => {
      if (error.resolved) {
        this.errors.delete(id);
      }
    });
  }

  clearAllErrors(): void {
    this.errors.clear();
  }

  getErrorStats(): {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    resolved: number;
    unresolved: number;
  } {
    const errors = Array.from(this.errors.values());
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    
    errors.forEach(error => {
      byType[error.type] = (byType[error.type] || 0) + 1;
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;
    });

    return {
      total: errors.length,
      byType,
      bySeverity,
      resolved: errors.filter(e => e.resolved).length,
      unresolved: errors.filter(e => !e.resolved).length
    };
  }

  updateConfig(newConfig: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): ErrorHandlerConfig {
    return { ...this.config };
  }
}

export const errorHandler = new ErrorHandlerService();