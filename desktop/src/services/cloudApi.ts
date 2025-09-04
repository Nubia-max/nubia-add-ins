// Cloud API service for SaaS functionality
class CloudApiService {
  private baseUrl: string;
  private token: string | null;

  constructor() {
    this.baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://api.nubia.ai' 
      : 'http://localhost:5001';
    this.token = this.getStoredToken();
  }

  private getStoredToken(): string | null {
    return localStorage.getItem('nubia_auth_token');
  }

  private setStoredToken(token: string): void {
    localStorage.setItem('nubia_auth_token', token);
    this.token = token;
  }

  private clearStoredToken(): void {
    localStorage.removeItem('nubia_auth_token');
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

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        this.clearStoredToken();
        throw new Error('Authentication required. Please log in.');
      }
      throw new Error(data.error || 'API request failed');
    }

    return data;
  }

  // Authentication
  async register(email: string, password: string) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setStoredToken(data.token);
    return data;
  }

  async login(email: string, password: string) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setStoredToken(data.token);
    return data;
  }

  async logout() {
    this.clearStoredToken();
  }

  async getProfile() {
    return this.request('/auth/me');
  }

  // Subscription Management
  async getSubscription() {
    return this.request('/subscription/current');
  }

  async getSubscriptionTiers() {
    return this.request('/subscription/tiers');
  }

  async createSubscription(tier: string) {
    return this.request('/subscription/create', {
      method: 'POST',
      body: JSON.stringify({ tier }),
    });
  }

  async updateSubscription(tier: string) {
    return this.request('/subscription/update', {
      method: 'PUT',
      body: JSON.stringify({ tier }),
    });
  }

  async cancelSubscription(cancelAtPeriodEnd = true) {
    return this.request('/subscription/cancel', {
      method: 'POST',
      body: JSON.stringify({ cancelAtPeriodEnd }),
    });
  }

  // Excel Automation
  async processAutomation(command: string, context: any = {}, options: any = {}) {
    return this.request('/automation/process', {
      method: 'POST',
      body: JSON.stringify({ command, context, options }),
    });
  }

  async getAutomationHistory(limit = 50, offset = 0) {
    return this.request(`/automation/history?limit=${limit}&offset=${offset}`);
  }

  async getUsageAnalytics(days = 30) {
    return this.request(`/automation/analytics?days=${days}`);
  }

  // Templates
  async saveAutomationTemplate(template: {
    name: string;
    description?: string;
    commands: any[];
    category?: string;
    isPublic?: boolean;
  }) {
    return this.request('/automation/templates', {
      method: 'POST',
      body: JSON.stringify(template),
    });
  }

  async getAutomationTemplates(category?: string, isPublic?: boolean) {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (isPublic !== undefined) params.append('isPublic', String(isPublic));
    
    return this.request(`/automation/templates?${params}`);
  }

  async useAutomationTemplate(templateId: string) {
    return this.request(`/automation/templates/${templateId}/use`, {
      method: 'POST',
    });
  }

  // Health check
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // User state
  isAuthenticated(): boolean {
    return !!this.token;
  }

  getToken(): string | null {
    return this.token;
  }
}

export const cloudApi = new CloudApiService();
export default cloudApi;