// Common types used across the application

export interface User {
  id: string;
  email: string;
  settings?: UserSettings;
  createdAt: Date;
  updatedAt?: Date;
}

export interface UserSettings {
  automationMode: AutomationMode;
  notifications: boolean;
  autoMinimize: boolean;
  theme?: 'light' | 'dark';
  language?: string;
}

export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  userId?: string;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  taskId?: string;
  automationType?: string;
  fileAttachments?: string[];
}

export interface Chat {
  id: string;
  userId: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

// User state (simplified without authentication)
export interface UserState {
  user: User | null;
  isLoading: boolean;
}

// API Response types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Error types
export interface APIError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}

// Automation types
export type AutomationMode = 'visual' | 'background';
export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'aborted';
export type TaskComplexity = 'simple' | 'complex';

export interface AutomationTask {
  id: string;
  description: string;
  mode: AutomationMode;
  status: TaskStatus;
  complexity: TaskComplexity;
  progress?: number;
  result?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  estimatedDuration?: number;
}

export interface TaskRequest {
  task: string;
  mode: AutomationMode;
}

export interface TaskResponse {
  taskId: string;
  status: TaskStatus;
  message: string;
  progress?: number;
  result?: string;
  error?: string;
  complexity?: TaskComplexity;
}

// WebSocket message types
export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: Date;
}

export interface TaskUpdateMessage extends WebSocketMessage {
  type: 'task_update';
  data: {
    taskId: string;
    status: TaskStatus;
    progress?: number;
    message?: string;
    result?: string;
    error?: string;
  };
}

export interface ChatMessage extends WebSocketMessage {
  type: 'chat_message';
  data: Message;
}

// File and storage types
export interface FileInfo {
  name: string;
  size: number;
  type: string;
  lastModified: Date;
  path?: string;
}

export interface ExcelFileInfo extends FileInfo {
  sheets: string[];
  hasData: boolean;
}

// Application state types
export interface AppState {
  user: UserState;
  chat: {
    messages: Message[];
    isLoading: boolean;
    error?: string;
  };
  automation: {
    tasks: AutomationTask[];
    activeTask?: AutomationTask;
    isConnected: boolean;
  };
  ui: {
    isExpanded: boolean;
    showSettings: boolean;
    theme: 'light' | 'dark';
  };
}