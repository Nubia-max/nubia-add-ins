const Store = window.require('electron-store');

export interface UserData {
  id: string;
  email: string;
  settings: {
    automationMode: 'visual' | 'background';
    notifications: boolean;
    autoMinimize: boolean;
    theme?: 'light' | 'dark' | 'auto';
  };
  createdAt?: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  metadata?: {
    excelTask?: boolean;
    taskType?: string;
    complexity?: 'simple' | 'complex';
  };
}

export interface ChatHistory {
  id: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface StorageData {
  authToken: string;
  userData: UserData;
  openaiApiKey: string;
  anthropicApiKey: string;
  currentProvider: 'openai' | 'anthropic';
  chatHistory: ChatHistory[];
  userPreferences: {
    isFirstTime: boolean;
    onboardingCompleted: boolean;
    expandedState: boolean;
    windowPosition: { x: number; y: number };
    theme: 'light' | 'dark' | 'auto';
  };
}

class ElectronStorageService {
  private store: any;

  constructor() {
    this.store = new Store({
      name: 'nubia-data',
      defaults: {
        userPreferences: {
          isFirstTime: true,
          onboardingCompleted: false,
          expandedState: false,
          windowPosition: { x: 0, y: 0 },
          theme: 'auto'
        },
        chatHistory: [],
        currentProvider: 'openai'
      }
    });
  }

  // Auth methods
  async setAuthToken(token: string): Promise<void> {
    this.store.set('authToken', token);
  }

  async getAuthToken(): Promise<string | null> {
    return this.store.get('authToken', null);
  }

  async clearAuthToken(): Promise<void> {
    this.store.delete('authToken');
  }

  // User data methods
  async setUserData(userData: UserData): Promise<void> {
    this.store.set('userData', userData);
  }

  async getUserData(): Promise<UserData | null> {
    return this.store.get('userData', null);
  }

  async clearUserData(): Promise<void> {
    this.store.delete('userData');
  }

  // API key methods
  async setOpenAIApiKey(key: string): Promise<void> {
    this.store.set('openaiApiKey', key);
  }

  async getOpenAIApiKey(): Promise<string | null> {
    return this.store.get('openaiApiKey', null);
  }

  async setAnthropicApiKey(key: string): Promise<void> {
    this.store.set('anthropicApiKey', key);
  }

  async getAnthropicApiKey(): Promise<string | null> {
    return this.store.get('anthropicApiKey', null);
  }

  // Provider methods
  async setCurrentProvider(provider: 'openai' | 'anthropic'): Promise<void> {
    this.store.set('currentProvider', provider);
  }

  async getCurrentProvider(): Promise<'openai' | 'anthropic'> {
    return this.store.get('currentProvider', 'openai');
  }

  // Chat history methods
  async saveChatHistory(chat: ChatHistory): Promise<void> {
    const chatHistory = await this.getChatHistory();
    const existingIndex = chatHistory.findIndex(c => c.id === chat.id);
    
    if (existingIndex >= 0) {
      chatHistory[existingIndex] = chat;
    } else {
      chatHistory.push(chat);
    }
    
    // Keep only last 50 chats
    if (chatHistory.length > 50) {
      chatHistory.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      chatHistory.splice(50);
    }
    
    this.store.set('chatHistory', chatHistory);
  }

  async getChatHistory(): Promise<ChatHistory[]> {
    return this.store.get('chatHistory', []);
  }

  async clearChatHistory(): Promise<void> {
    this.store.set('chatHistory', []);
  }

  // User preferences methods
  async setUserPreferences(preferences: Partial<StorageData['userPreferences']>): Promise<void> {
    const current = this.store.get('userPreferences', {});
    this.store.set('userPreferences', { ...current, ...preferences });
  }

  async getUserPreferences(): Promise<StorageData['userPreferences']> {
    return this.store.get('userPreferences', {
      isFirstTime: true,
      onboardingCompleted: false,
      expandedState: false,
      windowPosition: { x: 0, y: 0 },
      theme: 'auto'
    });
  }

  // Utility methods
  async clearAll(): Promise<void> {
    this.store.clear();
  }

  async export(): Promise<StorageData> {
    return this.store.store;
  }

  async import(data: Partial<StorageData>): Promise<void> {
    Object.entries(data).forEach(([key, value]) => {
      this.store.set(key, value);
    });
  }

  // Testing methods
  async setMockData(): Promise<void> {
    const mockUser: UserData = {
      id: 'mock-user-123',
      email: 'test@nubia.ai',
      settings: {
        automationMode: 'visual',
        notifications: true,
        autoMinimize: false,
        theme: 'auto'
      }
    };

    const mockChat: ChatHistory = {
      id: 'mock-chat-123',
      messages: [
        {
          id: '1',
          content: 'Hello! How can I help you with Excel automation today?',
          role: 'assistant',
          timestamp: new Date(),
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.setAuthToken('mock-jwt-token');
    await this.setUserData(mockUser);
    await this.saveChatHistory(mockChat);
    await this.setUserPreferences({
      isFirstTime: false,
      onboardingCompleted: true
    });
  }
}

export const storageService = new ElectronStorageService();

// Make storage available globally for easier access
declare global {
  interface Window {
    electronStore: ElectronStorageService;
  }
}

if (typeof window !== 'undefined') {
  window.electronStore = storageService;
}