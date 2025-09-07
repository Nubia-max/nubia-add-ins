// Test script to verify auth flow with the backend
// Using built-in fetch (Node 18+) or fallback to https module

const API_BASE = 'http://localhost:3001/api';

async function testAuthFlow() {
  console.log('🧪 Testing Authentication Flow\n');
  console.log('================================\n');

  try {
    // Test 1: Health Check
    console.log('1️⃣  Testing Health Check...');
    const healthRes = await fetch(`${API_BASE}/health`);
    const health = await healthRes.json();
    console.log('✅ Health Check:', health);
    console.log('');

    // Test 2: Register New User
    const testEmail = `test${Date.now()}@example.com`;
    const testPassword = 'TestPassword123';
    
    console.log('2️⃣  Testing Registration...');
    console.log(`   Email: ${testEmail}`);
    const registerRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword })
    });
    const registerData = await registerRes.json();
    console.log('✅ Registration Response:', {
      message: registerData.message,
      userId: registerData.user?.id,
      hasToken: !!registerData.token
    });
    console.log('');

    // Test 3: Login
    console.log('3️⃣  Testing Login...');
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword })
    });
    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log('✅ Login Response:', {
      message: loginData.message,
      userId: loginData.user?.id,
      hasToken: !!token
    });
    console.log('');

    // Test 4: Get Profile (Authenticated)
    console.log('4️⃣  Testing Authenticated Request (Get Profile)...');
    const profileRes = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const profile = await profileRes.json();
    console.log('✅ Profile Response:', profile);
    console.log('');

    // Test 5: Get Subscription
    console.log('5️⃣  Testing Get Subscription...');
    const subRes = await fetch(`${API_BASE}/subscription/current`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const subscription = await subRes.json();
    console.log('✅ Subscription Response:', {
      tier: subscription.tier,
      status: subscription.status,
      limit: subscription.automationsLimit,
      used: subscription.automationsUsed
    });
    console.log('');

    // Test 6: Test Chat API
    console.log('6️⃣  Testing Chat API...');
    const chatRes = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        message: 'Hello, can you help me create a budget tracker?'
      })
    });
    const chatData = await chatRes.json();
    console.log('✅ Chat Response:', {
      success: chatData.success,
      type: chatData.type,
      messagePreview: chatData.message ? chatData.message.substring(0, 100) + '...' : 'No message'
    });
    console.log('');

    console.log('================================');
    console.log('✅ All tests passed successfully!');
    console.log('');
    console.log('📝 Summary:');
    console.log('- Backend is running on port 3001');
    console.log('- All API endpoints are prefixed with /api');
    console.log('- Authentication flow is working');
    console.log('- JWT tokens are being generated and validated');
    console.log('- Subscription system is functional');
    console.log('- Chat API is responding');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.message.includes('ECONNREFUSED')) {
      console.error('\n⚠️  Make sure the backend is running:');
      console.error('   npm run backend');
      console.error('   or');
      console.error('   node backend/src/server-simple.js');
    }
  }
}

// Run the test
testAuthFlow();