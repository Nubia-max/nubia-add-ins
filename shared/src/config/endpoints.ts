// API Endpoint Configuration
export const API_CONFIG = {
  // Backend API endpoints
  BACKEND: {
    BASE_URL: process.env.BACKEND_URL || 'http://localhost:3001',
    AUTH: {
      REGISTER: '/auth/register',
      LOGIN: '/auth/login',
      PROFILE: '/auth/me',
    },
    CHAT: {
      HISTORY: '/chat/history',
      SEND: '/chat/send',
    },
    HEALTH: '/health',
  },

  // Automation service endpoints
  AUTOMATION: {
    BASE_URL: process.env.AUTOMATION_URL || 'http://localhost:8000',
    EXECUTE: '/execute',
    STATUS: '/status',
    ABORT: '/abort',
    TASKS: '/tasks',
    WEBSOCKET: '/ws',
    HEALTH: '/health',
  },
};

// WebSocket endpoints
export const WEBSOCKET_CONFIG = {
  BACKEND: `${API_CONFIG.BACKEND.BASE_URL}`,
  AUTOMATION: `${API_CONFIG.AUTOMATION.BASE_URL.replace('http', 'ws')}/ws`,
};

// Default ports
export const PORTS = {
  DESKTOP: process.env.DESKTOP_PORT ? parseInt(process.env.DESKTOP_PORT) : 3000,
  BACKEND: process.env.BACKEND_PORT ? parseInt(process.env.BACKEND_PORT) : 3001,
  AUTOMATION: process.env.AUTOMATION_PORT ? parseInt(process.env.AUTOMATION_PORT) : 8000,
  DATABASE: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT) : 5432,
};

// CORS configuration
export const CORS_CONFIG = {
  ORIGINS: [
    'http://localhost:3000',
    'http://localhost:3001',
    process.env.CORS_ORIGIN || 'http://localhost:3000',
  ],
  METHODS: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  HEADERS: ['Content-Type', 'Authorization'],
};