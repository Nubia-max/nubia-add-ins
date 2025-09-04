export const config = {
  appName: 'Nubia',
  version: '1.0.0',
  author: 'Nubia Team',
  description: 'AI-powered Excel automation assistant',
  
  api: {
    baseUrl: process.env.NODE_ENV === 'development' 
      ? 'http://localhost:5001' 
      : 'https://api.nubia.ai',
    timeout: 30000
  },
  
  features: {
    aiEnabled: true,
    excelAutomation: true,
    voiceInput: false, // Future feature
    cloudSync: true,   // Enabled for SaaS
    analytics: true,
    autoUpdater: true,
    subscriptions: true // New SaaS feature
  },
  
  ui: {
    theme: 'modern',
    primaryColor: '#667eea',
    secondaryColor: '#764ba2',
    animations: true,
    soundEffects: false
  },
  
  automation: {
    defaultMode: 'visual', // 'visual' | 'background'
    simulationSpeed: 1500, // ms per step
    maxSteps: 10,
    enableProgressBar: true
  },
  
  ai: {
    defaultModel: 'gpt-3.5-turbo',
    maxTokens: 1000,
    temperature: 0.7,
    enableMarkdown: true,
    enableCodeHighlighting: true
  },
  
  storage: {
    encryptApiKeys: true,
    saveConversations: true,
    maxConversations: 100,
    autoCleanup: true
  },
  
  shortcuts: {
    sendMessage: 'Ctrl+Enter',
    newLine: 'Shift+Enter',
    closeChat: 'Escape',
    openSettings: 'Ctrl+,',
    exportChat: 'Ctrl+E'
  },
  
  support: {
    email: 'support@nubia.ai',
    website: 'https://nubia.ai',
    documentation: 'https://docs.nubia.ai',
    github: 'https://github.com/nubia-ai/nubia'
  },
  
  build: {
    environment: process.env.NODE_ENV || 'development',
    buildDate: new Date().toISOString(),
    commit: process.env.COMMIT_HASH || 'dev'
  }
};

export type Config = typeof config;

export const getFeatureFlag = (flag: keyof typeof config.features): boolean => {
  return config.features[flag];
};

export const getShortcut = (action: keyof typeof config.shortcuts): string => {
  return config.shortcuts[action];
};

export const isProduction = (): boolean => {
  return config.build.environment === 'production';
};

export const isDevelopment = (): boolean => {
  return config.build.environment === 'development';
};