// Test script to verify token refresh functionality
const fetch = require('node-fetch');

// Simulate the cloudApi behavior
class TestCloudApi {
  constructor() {
    this.baseUrl = 'http://localhost:3001';
    this.token = 'expired-token-simulation';
    this.refreshCount = 0;
  }

  async refreshToken() {
    this.refreshCount++;
    console.log(`🔄 Refresh attempt #${this.refreshCount}`);

    // Simulate successful refresh on first try
    if (this.refreshCount === 1) {
      this.token = 'new-refreshed-token';
      console.log('✅ Token refreshed successfully');
      return true;
    }

    console.log('❌ Token refresh failed');
    return false;
  }

  async request(endpoint, options = {}, retryCount = 0) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`,
      ...options.headers
    };

    console.log(`📡 Making request to ${endpoint} (attempt ${retryCount + 1})`);
    console.log(`🔑 Using token: ${this.token.substring(0, 20)}...`);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401 && retryCount === 0) {
          console.log('🔄 Token expired, attempting to refresh...');

          const refreshed = await this.refreshToken();
          if (refreshed) {
            console.log('✅ Token refreshed successfully, retrying request...');
            return this.request(endpoint, options, 1);
          } else {
            console.log('❌ Token refresh failed');
            throw new Error('Session expired. Please log in again.');
          }
        } else if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.');
        }
        throw new Error(data.error || `API request failed with status ${response.status}`);
      }

      return data;
    } catch (error) {
      throw error;
    }
  }
}

// Test the token refresh functionality
async function testTokenRefresh() {
  console.log('🧪 Testing automatic token refresh functionality...\n');

  const api = new TestCloudApi();

  try {
    // This should trigger a 401, then auto-refresh and retry
    const result = await api.request('/api/auth/me');
    console.log('\n✅ Test PASSED: Request succeeded after token refresh');
    console.log('📊 Result:', result);
  } catch (error) {
    console.log('\n❌ Test FAILED:', error.message);
  }
}

// Run the test
testTokenRefresh();