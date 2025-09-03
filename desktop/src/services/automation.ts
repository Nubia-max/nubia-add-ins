import { ExcelTask } from './excelParser';
import { demoModeService } from './demoMode';
import { errorHandler } from './errorHandler';

export interface AutomationProgress {
  taskId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'aborted';
  progress: number; // 0-100
  currentStep?: string;
  message?: string;
  error?: string;
  estimatedTimeRemaining?: number; // in seconds
}

export interface AutomationResponse {
  success: boolean;
  taskId: string;
  message: string;
  estimatedDuration?: number;
  mode?: string;
}

export interface TaskQueue {
  id: string;
  task: ExcelTask;
  status: 'queued' | 'running' | 'completed' | 'failed';
  priority: number;
  addedAt: Date;
}

class AutomationService {
  private baseUrl: string;
  private websocket: WebSocket | null = null;
  private taskQueue: TaskQueue[] = [];
  private progressCallbacks: Map<string, (progress: AutomationProgress) => void> = new Map();
  private isServiceAvailable = false;
  private connectionCheckInterval: NodeJS.Timeout | null = null;
  private maxRetries = 3;
  private currentMode: 'visual' | 'background' = 'background';

  constructor() {
    this.baseUrl = process.env.REACT_APP_AUTOMATION_URL || 'http://localhost:8000';
    this.startConnectionCheck();
  }

  // Connection management
  private startConnectionCheck(): void {
    this.checkServiceHealth();
    this.connectionCheckInterval = setInterval(() => {
      this.checkServiceHealth();
    }, 30000); // Check every 30 seconds
  }

  private async checkServiceHealth(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        timeout: 5000
      });
      
      if (response.ok) {
        const health = await response.json();
        this.isServiceAvailable = health.status === 'healthy';
        
        // Connect WebSocket if not already connected
        if (this.isServiceAvailable && !this.websocket) {
          await this.connectWebSocket();
        }
      } else {
        this.isServiceAvailable = false;
      }
    } catch (error: any) {
      console.warn('Automation service not available:', error);
      this.isServiceAvailable = false;
      this.websocket = null;
      
      // Handle service connection error
      await errorHandler.handleServiceError(
        'Automation service connection failed',
        error.message,
        { url: this.baseUrl }
      );
    }
  }

  private async connectWebSocket(): Promise<void> {
    try {
      const wsUrl = this.baseUrl.replace('http', 'ws') + '/ws';
      this.websocket = new WebSocket(wsUrl);

      this.websocket.onopen = () => {
        console.log('Connected to automation service WebSocket');
      };

      this.websocket.onmessage = (event) => {
        try {
          const progress: AutomationProgress = JSON.parse(event.data);
          this.handleProgressUpdate(progress);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      this.websocket.onclose = () => {
        console.log('WebSocket connection closed');
        this.websocket = null;
        // Attempt to reconnect after delay
        setTimeout(() => {
          if (this.isServiceAvailable) {
            this.connectWebSocket();
          }
        }, 5000);
      };

    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      this.websocket = null;
    }
  }

  private handleProgressUpdate(progress: AutomationProgress): void {
    const callback = this.progressCallbacks.get(progress.taskId);
    if (callback) {
      callback(progress);
    }

    // Update task queue status
    const queuedTask = this.taskQueue.find(qt => qt.task.id === progress.taskId);
    if (queuedTask) {
      queuedTask.status = progress.status === 'completed' ? 'completed' : 
                         progress.status === 'failed' ? 'failed' : 'running';
    }

    // Clean up completed tasks
    if (progress.status === 'completed' || progress.status === 'failed' || progress.status === 'aborted') {
      setTimeout(() => {
        this.progressCallbacks.delete(progress.taskId);
      }, 5000); // Keep callback for 5 seconds after completion
    }
  }

  // Public API methods
  async executeTask(
    task: ExcelTask, 
    onProgress?: (progress: AutomationProgress) => void
  ): Promise<AutomationResponse> {
    if (!this.isServiceAvailable) {
      return this.handleOfflineMode(task);
    }

    try {
      // Register progress callback
      if (onProgress) {
        this.progressCallbacks.set(task.id, onProgress);
      }

      // Add to queue
      this.taskQueue.push({
        id: task.id,
        task,
        status: 'queued',
        priority: task.priority,
        addedAt: new Date()
      });

      // Send to automation service
      const response = await fetch(`${this.baseUrl}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ task })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to execute task');
      }

      const result = await response.json();
      
      // Update queue status
      const queuedTask = this.taskQueue.find(qt => qt.id === task.id);
      if (queuedTask) {
        queuedTask.status = 'running';
      }

      return {
        success: true,
        taskId: task.id,
        message: result.message,
        estimatedDuration: result.estimated_duration,
        mode: result.mode
      };

    } catch (error: any) {
      // Handle error through error service
      await errorHandler.handleTaskError(
        task.id,
        'Failed to execute automation task',
        error.message || 'Unknown automation error'
      );
      
      // Remove from queue on error
      this.taskQueue = this.taskQueue.filter(qt => qt.id !== task.id);
      
      return {
        success: false,
        taskId: task.id,
        message: error.message || 'Automation execution failed'
      };
    }
  }

  async getTaskStatus(taskId: string): Promise<AutomationProgress | null> {
    if (!this.isServiceAvailable) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/status/${taskId}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Failed to get task status:', error);
    }
    return null;
  }

  async abortTask(taskId: string): Promise<boolean> {
    if (!this.isServiceAvailable) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/abort/${taskId}`, {
        method: 'POST'
      });

      if (response.ok) {
        // Remove from queue
        this.taskQueue = this.taskQueue.filter(qt => qt.id !== taskId);
        // Clean up callback
        this.progressCallbacks.delete(taskId);
        return true;
      }
    } catch (error) {
      console.error('Failed to abort task:', error);
    }
    return false;
  }

  async getActiveTasksList(): Promise<any[]> {
    if (!this.isServiceAvailable) {
      return [];
    }

    try {
      const response = await fetch(`${this.baseUrl}/tasks`);
      if (response.ok) {
        const result = await response.json();
        return result.active_tasks || [];
      }
    } catch (error) {
      console.error('Failed to get active tasks:', error);
    }
    return [];
  }

  // Mode switching
  setDefaultMode(mode: 'visual' | 'background'): void {
    this.currentMode = mode;
  }

  getDefaultMode(): 'visual' | 'background' {
    return this.currentMode;
  }

  // Intelligent mode suggestion
  suggestMode(task: ExcelTask): 'visual' | 'background' {
    // Use background mode for complex tasks or when Excel might not be available
    if (task.complexity === 'complex' || task.estimatedActions > 20) {
      return 'background';
    }

    // Use visual mode for simple tasks that benefit from user visibility
    if (task.type === 'create_chart' || task.type === 'format_cells') {
      return 'visual';
    }

    return this.currentMode;
  }

  switchTaskMode(taskId: string, newMode: 'visual' | 'background'): Promise<boolean> {
    // This would require the task to be restarted with the new mode
    // For now, we'll just abort and suggest restart
    return this.abortTask(taskId);
  }

  // Queue management
  getTaskQueue(): TaskQueue[] {
    return [...this.taskQueue].sort((a, b) => b.priority - a.priority);
  }

  clearCompletedTasks(): void {
    this.taskQueue = this.taskQueue.filter(qt => 
      qt.status !== 'completed' && qt.status !== 'failed'
    );
  }

  getQueueLength(): number {
    return this.taskQueue.filter(qt => qt.status === 'queued').length;
  }

  // Service status
  isAvailable(): boolean {
    return this.isServiceAvailable;
  }

  getServiceInfo(): { available: boolean; url: string; wsConnected: boolean } {
    return {
      available: this.isServiceAvailable,
      url: this.baseUrl,
      wsConnected: this.websocket?.readyState === WebSocket.OPEN
    };
  }

  // Offline/Demo mode handling
  private async handleOfflineMode(task: ExcelTask): Promise<AutomationResponse> {
    console.log('Automation service offline, running demo mode');
    
    // If demo mode service is available, use it for more realistic simulation
    if (demoModeService) {
      // Run quick demo based on task type
      const demoType = this.mapTaskTypeToDemo(task.type);
      if (demoType) {
        setTimeout(() => {
          demoModeService.runQuickDemo(demoType, (progress) => {
            this.handleProgressUpdate(progress);
          });
        }, 100);
      } else {
        // Fallback to regular simulation
        setTimeout(() => {
          this.simulateTaskExecution(task);
        }, 100);
      }
    } else {
      // Fallback to regular simulation
      setTimeout(() => {
        this.simulateTaskExecution(task);
      }, 100);
    }

    return {
      success: true,
      taskId: task.id,
      message: 'Task started in demo mode (automation service offline)',
      estimatedDuration: task.metadata.estimatedDuration,
      mode: 'demo'
    };
  }

  private mapTaskTypeToDemo(taskType: string): 'chart' | 'table' | 'formula' | 'pivot' | null {
    const mapping: Record<string, 'chart' | 'table' | 'formula' | 'pivot'> = {
      'create_chart': 'chart',
      'format_table': 'table', 
      'format_cells': 'table',
      'create_formulas': 'formula',
      'sum_formula': 'formula',
      'create_pivot_table': 'pivot'
    };
    
    return mapping[taskType] || null;
  }

  private async simulateTaskExecution(task: ExcelTask): Promise<void> {
    const callback = this.progressCallbacks.get(task.id);
    if (!callback) return;

    // Simulate progress updates
    for (let i = 0; i <= 100; i += 20) {
      const currentStepIndex = Math.floor((i / 100) * task.steps.length);
      const currentStep = task.steps[currentStepIndex]?.description || 'Processing...';
      
      callback({
        taskId: task.id,
        status: i === 100 ? 'completed' : 'in_progress',
        progress: i,
        currentStep,
        message: i === 100 ? 'Demo task completed' : `Simulating: ${currentStep}`,
        estimatedTimeRemaining: Math.max(0, (100 - i) / 20 * 2) // 2 seconds per step
      });

      if (i < 100) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      }
    }

    // Clean up
    setTimeout(() => {
      this.progressCallbacks.delete(task.id);
    }, 3000);
  }

  // Error recovery
  async retryFailedTask(taskId: string): Promise<AutomationResponse | null> {
    const queuedTask = this.taskQueue.find(qt => qt.id === taskId && qt.status === 'failed');
    if (!queuedTask) {
      return null;
    }

    // Create new task with same parameters but new ID
    const newTask: ExcelTask = {
      ...queuedTask.task,
      id: `${queuedTask.task.id}_retry_${Date.now()}`,
      status: 'pending'
    };

    return this.executeTask(newTask);
  }

  // Utility methods
  estimateTimeRemaining(progress: number, estimatedDuration: number): number {
    if (progress === 0) return estimatedDuration;
    const elapsed = (progress / 100) * estimatedDuration;
    return Math.max(0, estimatedDuration - elapsed);
  }

  formatProgressMessage(progress: AutomationProgress): string {
    if (progress.error) {
      return `Error: ${progress.error}`;
    }
    
    if (progress.status === 'completed') {
      return 'Task completed successfully';
    }
    
    if (progress.status === 'failed') {
      return 'Task failed';
    }
    
    if (progress.currentStep) {
      return `${progress.currentStep} (${progress.progress}%)`;
    }
    
    return `Processing... (${progress.progress}%)`;
  }

  // Cleanup
  destroy(): void {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
    }
    
    if (this.websocket) {
      this.websocket.close();
    }
    
    this.progressCallbacks.clear();
    this.taskQueue = [];
  }
}

export const automationService = new AutomationService();