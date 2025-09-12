// Cloud API service for SaaS functionality
class CloudApiService {
  private baseUrl: string;
  private token: string | null;

  constructor() {
    this.baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://api.nubia.ai' 
      : 'http://localhost:3001';
    this.token = null;
    this.initializeToken();
  }

  private async initializeToken(): Promise<void> {
    this.token = await this.getStoredToken();
  }

  private async getStoredToken(): Promise<string | null> {
    // Check if we're in Electron
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      return await (window as any).electronAPI.getData('nubia_auth_token');
    }
    // Fallback to localStorage for web
    return localStorage.getItem('nubia_auth_token');
  }

  private async setStoredToken(token: string): Promise<void> {
    // Check if we're in Electron
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      await (window as any).electronAPI.storeData('nubia_auth_token', token);
    } else {
      // Fallback to localStorage for web
      localStorage.setItem('nubia_auth_token', token);
    }
    this.token = token;
  }

  private async clearStoredToken(): Promise<void> {
    // Check if we're in Electron
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      await (window as any).electronAPI.removeData('nubia_auth_token');
    } else {
      // Fallback to localStorage for web
      localStorage.removeItem('nubia_auth_token');
    }
    this.token = null;
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('Failed to parse JSON response:', jsonError);
        throw new Error('Invalid server response');
      }

      if (!response.ok) {
        if (response.status === 401) {
          await this.clearStoredToken();
          throw new Error(data.error || 'Authentication required. Please log in.');
        }
        throw new Error(data.error || `API request failed with status ${response.status}`);
      }

      return data;
    } catch (error) {
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        console.error('Network error:', error);
        throw new Error('Unable to connect to server. Please check your connection.');
      }
      throw error;
    }
  }

  // Authentication
  async register(email: string, password: string) {
    const data = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await this.setStoredToken(data.token);
    return data;
  }

  async login(email: string, password: string) {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await this.setStoredToken(data.token);
    return data;
  }

  async logout() {
    await this.clearStoredToken();
  }

  async getProfile() {
    return this.request('/api/auth/me');
  }

  // Subscription Management
  async getSubscription() {
    return this.request('/api/subscription/current');
  }

  async getSubscriptionTiers() {
    return this.request('/api/subscription/tiers');
  }

  async createSubscription(tier: string) {
    return this.request('/api/subscription/create', {
      method: 'POST',
      body: JSON.stringify({ tier }),
    });
  }

  async updateSubscription(tier: string) {
    return this.request('/api/subscription/update', {
      method: 'PUT',
      body: JSON.stringify({ tier }),
    });
  }

  async cancelSubscription(cancelAtPeriodEnd = true) {
    return this.request('/api/subscription/cancel', {
      method: 'POST',
      body: JSON.stringify({ cancelAtPeriodEnd }),
    });
  }

  // GPT-Driven Financial Document Generation
  async generateFinancialDocument(command: string, context: any = {}, options: any = {}) {
    return this.request('/api/financial/generate', {
      method: 'POST',
      body: JSON.stringify({ command, context, options }),
    });
  }

  // Universal chat endpoint - GPT decides everything with conversation memory
  async sendChatMessage(message: string, includeContext: boolean = true) {
    return this.request('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message, includeContext }),
    });
  }

  // Conversation memory management
  async clearConversationHistory() {
    return this.request('/api/chat/clear', {
      method: 'POST',
    });
  }

  async getConversationHistory() {
    return this.request('/api/chat/history');
  }

  // Excel Generation with complete GPT freedom
  async generateExcel(userInput: string) {
    return this.request('/api/generate-excel', {
      method: 'POST',
      body: JSON.stringify({ userInput }),
    });
  }

  // Excel Automation (Legacy - kept for compatibility)
  async processAutomation(command: string, context: any = {}, options: any = {}) {
    return this.request('/api/automation/process', {
      method: 'POST',
      body: JSON.stringify({ command, context, options }),
    });
  }

  async getAutomationHistory(limit = 50, offset = 0) {
    return this.request(`/api/automation/history?limit=${limit}&offset=${offset}`);
  }

  async getUsageAnalytics(days = 30) {
    return this.request(`/api/automation/analytics?days=${days}`);
  }

  // Templates
  async saveAutomationTemplate(template: {
    name: string;
    description?: string;
    commands: any[];
    category?: string;
    isPublic?: boolean;
  }) {
    return this.request('/api/automation/templates', {
      method: 'POST',
      body: JSON.stringify(template),
    });
  }

  async getAutomationTemplates(category?: string, isPublic?: boolean) {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (isPublic !== undefined) params.append('isPublic', String(isPublic));
    
    return this.request(`/api/automation/templates?${params}`);
  }

  async useAutomationTemplate(templateId: string) {
    return this.request(`/api/automation/templates/${templateId}/use`, {
      method: 'POST',
    });
  }

  // Health check
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // User state
  async isAuthenticated(): Promise<boolean> {
    if (!this.token) {
      this.token = await this.getStoredToken();
    }
    
    if (!this.token) {
      return false;
    }
    
    // Validate token with backend
    try {
      await this.getProfile();
      return true;
    } catch (error) {
      // Token is invalid, clear it
      await this.clearStoredToken();
      return false;
    }
  }

  getToken(): string | null {
    return this.token;
  }
}

export const cloudApi = new CloudApiService();
export default cloudApi;