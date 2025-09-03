import axios, { AxiosInstance, AxiosError } from 'axios';
import { LoginCredentials, RegisterCredentials, User } from '../types';
import { storageService } from './storage';

export interface AuthResponse {
  user: User;
  token: string;
  message: string;
}

export interface ApiError {
  error: string;
  details?: any;
}

class ApiService {
  private client: AxiosInstance;
  private baseURL: string;

  constructor() {
    // Use environment variable or fallback to localhost
    this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      async (config) => {
        try {
          const token = await storageService.getAuthToken();
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (error) {
          console.warn('Failed to get auth token:', error);
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError<ApiError>) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          await storageService.clearAuthToken();
          await storageService.clearUserData();
          // Redirect to login would be handled by auth context
        }
        
        // Transform error for consistent handling
        const apiError: ApiError = {
          error: error.response?.data?.error || error.message || 'An unexpected error occurred',
          details: error.response?.data?.details
        };
        
        return Promise.reject(apiError);
      }
    );
  }

  // Authentication methods
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await this.client.post<AuthResponse>('/auth/login', credentials);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    try {
      const { confirmPassword, ...registerData } = credentials;
      const response = await this.client.post<AuthResponse>('/auth/register', registerData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getProfile(): Promise<User> {
    try {
      const response = await this.client.get<User>('/auth/me');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async verifyToken(): Promise<User> {
    try {
      const response = await this.client.get<User>('/auth/me');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Chat methods
  async saveChat(messages: any[]): Promise<void> {
    try {
      await this.client.post('/chat/save', { messages });
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getChats(): Promise<any[]> {
    try {
      const response = await this.client.get<any[]>('/chat/history');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string; uptime: number }> {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Connection testing
  async testConnection(): Promise<boolean> {
    try {
      await this.healthCheck();
      return true;
    } catch (error) {
      console.warn('API connection test failed:', error);
      return false;
    }
  }

  // Utility methods
  private handleError(error: any): ApiError {
    if (error.error) {
      // Already processed by interceptor
      return error;
    }
    
    if (error.response?.data?.error) {
      return {
        error: error.response.data.error,
        details: error.response.data.details
      };
    }
    
    return {
      error: error.message || 'An unexpected error occurred',
      details: error
    };
  }

  // Configuration methods
  setBaseURL(url: string): void {
    this.baseURL = url;
    this.client.defaults.baseURL = url;
  }

  getBaseURL(): string {
    return this.baseURL;
  }

  // Retry logic for failed requests
  async retryRequest<T>(
    request: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await request();
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        
        console.warn(`Request attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }
    
    throw new Error('Max retries exceeded');
  }

  // Mock mode for testing
  private mockMode = false;

  enableMockMode(): void {
    this.mockMode = true;
  }

  disableMockMode(): void {
    this.mockMode = false;
  }

  private async getMockResponse<T>(endpoint: string): Promise<T> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

    switch (endpoint) {
      case '/auth/login':
      case '/auth/register':
        return {
          user: {
            id: 'mock-user-123',
            email: 'test@nubia.ai',
            settings: {
              automationMode: 'visual',
              notifications: true,
              autoMinimize: false,
              theme: 'auto'
            },
            createdAt: new Date().toISOString()
          },
          token: 'mock-jwt-token',
          message: 'Success'
        } as T;

      case '/auth/me':
        return {
          id: 'mock-user-123',
          email: 'test@nubia.ai',
          settings: {
            automationMode: 'visual',
            notifications: true,
            autoMinimize: false,
            theme: 'auto'
          },
          createdAt: new Date().toISOString()
        } as T;

      case '/health':
        return {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: Math.floor(Math.random() * 3600)
        } as T;

      default:
        throw new Error(`Mock response not implemented for ${endpoint}`);
    }
  }
}

// Create singleton instance
export const apiService = new ApiService();

// Export for type checking
export type { ApiService };