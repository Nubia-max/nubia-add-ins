// Export all shared types, configs, and constants
export * from './types/common';
export * from './config/endpoints';
export * from './constants/index';

// Re-export commonly used types with aliases for convenience
export type {
  User as NubiaUser,
  Message as ChatMessage,
  AutomationTask as Task,
  TaskRequest as ExecuteTaskRequest,
  TaskResponse as TaskExecutionResponse,
} from './types/common';