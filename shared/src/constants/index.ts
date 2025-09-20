// Application constants

// Application metadata
export const APP_CONFIG = {
  NAME: 'Nubia',
  VERSION: '1.0.0',
  DESCRIPTION: 'Excel Automation Assistant',
  AUTHOR: 'Nubia Team',
  HOMEPAGE: 'https://github.com/nubia-team/nubia',
} as const;

// UI Constants
export const UI_CONSTANTS = {
  BUBBLE_SIZE: {
    WIDTH: 80,
    HEIGHT: 80,
  },
  EXPANDED_SIZE: {
    WIDTH: 400,
    HEIGHT: 600,
  },
  ANIMATION_DURATION: 300,
  DEBOUNCE_DELAY: 300,
} as const;

// Storage keys
export const STORAGE_KEYS = {
  USER_SETTINGS: 'nubia-settings',
  CHAT_HISTORY: 'nubia-chat-history',
  LAST_POSITION: 'nubia-position',
  THEME: 'nubia-theme',
} as const;

// Message limits and validation
export const MESSAGE_LIMITS = {
  MAX_LENGTH: 5000,
  MIN_LENGTH: 1,
  MAX_ATTACHMENTS: 5,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
} as const;

// Task configuration
export const TASK_CONFIG = {
  MAX_CONCURRENT_TASKS: 3,
  DEFAULT_TIMEOUT: 300000, // 5 minutes
  PROGRESS_UPDATE_INTERVAL: 1000, // 1 second
  MAX_RETRIES: 3,
} as const;

// Excel automation constants
export const EXCEL_CONSTANTS = {
  SUPPORTED_FORMATS: ['.xlsx', '.xls', '.xlsm', '.csv'],
  MAX_ROWS: 1048576,
  MAX_COLUMNS: 16384,
  DEFAULT_SHEET_NAME: 'Sheet1',
} as const;

// Error messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  TASK_FAILED: 'Task execution failed. Please try again.',
  FILE_NOT_FOUND: 'File not found or inaccessible.',
  PERMISSION_DENIED: 'Permission denied. Check file access rights.',
  EXCEL_NOT_FOUND: 'Microsoft Excel not found or not accessible.',
  WEBSOCKET_ERROR: 'Real-time connection lost. Reconnecting...',
} as const;

// Success messages
export const SUCCESS_MESSAGES = {
  TASK_COMPLETED: 'Task completed successfully!',
  FILE_SAVED: 'File saved successfully!',
  SETTINGS_SAVED: 'Settings saved successfully!',
} as const;

// Validation patterns
export const VALIDATION_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
  PHONE: /^\+?[\d\s\-\(\)]+$/,
} as const;

// Time constants
export const TIME_CONSTANTS = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
} as const;

// WebSocket event types
export const WEBSOCKET_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  MESSAGE: 'message',
  TASK_UPDATE: 'task_update',
  PROGRESS_UPDATE: 'progress_update',
  ERROR: 'error',
  TYPING: 'typing',
  STOP_TYPING: 'stop_typing',
} as const;

// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// Rate limiting
export const RATE_LIMITS = {
  REQUESTS_PER_MINUTE: 60,
  TASKS_PER_HOUR: 100,
  MESSAGES_PER_MINUTE: 30,
} as const;

// Environment types
export type Environment = 'development' | 'production' | 'test';

// Feature flags
export const FEATURE_FLAGS = {
  ENABLE_VOICE_RECORDING: true,
  ENABLE_FILE_UPLOAD: true,
  ENABLE_BACKGROUND_MODE: true,
  ENABLE_ADVANCED_CHARTS: true,
  ENABLE_MACRO_EXECUTION: false, // Disabled by default for security
  ENABLE_TELEMETRY: true,
} as const;