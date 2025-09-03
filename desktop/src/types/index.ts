export interface User {
  id: string;
  email: string;
  settings?: UserSettings;
  createdAt: Date;
}

export interface UserSettings {
  automationMode: 'visual' | 'background';
  notifications: boolean;
  autoMinimize: boolean;
  theme?: 'light' | 'dark' | 'auto';
}

export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  userId?: string;
}

export interface Chat {
  id: string;
  userId: string;
  messages: Message[];
  createdAt: Date;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials extends LoginCredentials {
  confirmPassword: string;
}

export interface AutomationTask {
  id: string;
  description: string;
  mode: 'visual' | 'background';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number;
  result?: string;
  error?: string;
}

export interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

export interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

export interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

export interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

export interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: any) => void;
  onend: () => void;
  onstart: () => void;
  onspeechstart: () => void;
  onspeechend: () => void;
  start(): void;
  stop(): void;
  abort(): void;
}

export interface LLMProvider {
  name: 'openai' | 'anthropic';
  displayName: string;
  model: string;
  apiKey?: string;
}

export interface LLMResponse {
  content: string;
  excelTask?: import('../services/excelParser').ExcelTask;
  metadata?: {
    provider: string;
    model: string;
    tokens?: number;
    processingTime?: number;
  };
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
    electronStore: any;
  }
}