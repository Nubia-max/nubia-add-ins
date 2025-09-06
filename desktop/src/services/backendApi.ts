export class BackendAPI {
  private baseUrl: string;
  
  constructor() {
    this.baseUrl = process.env.BACKEND_URL || 'http://localhost:3001';
  }
  
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    };
  }
  
  async processWithGPT(transactions: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/excel/process-transactions`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ transactions })
    });
    
    if (response.status === 401) {
      throw new Error('Please log in to continue');
    }
    
    if (response.status === 429) {
      const data = await response.json();
      this.showUpgradePrompt(data.error);
      throw new Error(data.error || 'Usage limit exceeded');
    }
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'API request failed');
    }
    
    const result = await response.json();
    return result.data;
  }
  
  async generateFormulas(description: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/excel/generate-formulas`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ description })
    });
    
    if (response.status === 401) {
      throw new Error('Please log in to continue');
    }
    
    if (response.status === 429) {
      const data = await response.json();
      this.showUpgradePrompt(data.error);
      throw new Error(data.error || 'Usage limit exceeded');
    }
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'API request failed');
    }
    
    const result = await response.json();
    return result.data;
  }
  
  async getUsageStats(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/excel/usage-stats`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    });
    
    if (response.status === 401) {
      throw new Error('Please log in to continue');
    }
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch usage stats');
    }
    
    const result = await response.json();
    return result.data;
  }
  
  private showUpgradePrompt(message: string): void {
    if (typeof window !== 'undefined' && (window as any).showUpgradePrompt) {
      (window as any).showUpgradePrompt(message);
    }
  }
}

export const backendAPI = new BackendAPI();