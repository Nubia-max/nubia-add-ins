// Simple script to call the reset usage API endpoint
const http = require('http');

async function resetUsageViaAPI() {
  try {
    console.log('🔄 Calling reset usage API...');

    // Since the server is running on localhost:3001, we can call it directly
    // But we need an auth token. Let's check if there's a way to bypass auth for admin tasks

    const response = await fetch('http://localhost:3001/api/subscription/reset-usage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // We'll need proper auth here - let's see what happens first
      }
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Success:', result);
    } else {
      const error = await response.text();
      console.log('❌ Error:', response.status, error);
    }

  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

resetUsageViaAPI();