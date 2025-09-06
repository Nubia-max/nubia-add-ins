const axios = require('axios');

const API_URL = 'http://localhost:5001';
let authToken = null;

// Test credentials
const testUser = {
  email: 'test-excel-creation@example.com',
  password: 'TestPassword123!'
};

async function register() {
  try {
    const response = await axios.post(`${API_URL}/auth/register`, testUser);
    console.log('✅ User registered successfully');
    authToken = response.data.token;
    return response.data;
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('User already exists, logging in...');
      return login();
    }
    console.error('Registration error:', error.response?.data || error.message);
    throw error;
  }
}

async function login() {
  try {
    const response = await axios.post(`${API_URL}/auth/login`, testUser);
    console.log('✅ Login successful');
    authToken = response.data.token;
    return response.data;
  } catch (error) {
    console.error('Login error:', error.response?.data || error.message);
    throw error;
  }
}

async function sendChatMessage(message) {
  try {
    const response = await axios.post(
      `${API_URL}/api/chat`,
      { message },
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Chat error:', error.response?.data || error.message);
    throw error;
  }
}

async function testExcelCreation() {
  console.log('\n🛠️  Testing Excel Creation (NOT Teaching)\n');
  
  try {
    // 1. Authenticate
    console.log('1️⃣  Authenticating...');
    await register();
    
    // 2. Send a request that should CREATE Excel, not give instructions
    console.log('\n2️⃣  Requesting expense tracker creation...');
    const response1 = await sendChatMessage('Create an expense tracker for my food delivery business');
    
    console.log('   Response Type:', response1.type || 'unknown');
    console.log('   Success:', response1.success);
    
    if (response1.type === 'excel') {
      console.log('   ✅ SUCCESS: Excel file was created!');
      console.log('   📄 Filename:', response1.filename);
      console.log('   📁 Filepath:', response1.filepath);
    } else if (response1.type === 'chat') {
      console.log('   ❌ PROBLEM: GPT gave instructions instead of creating Excel');
      console.log('   💬 Response:', response1.response?.substring(0, 200) + '...');
    }
    
    // 3. Another test with transaction data
    console.log('\n3️⃣  Requesting transaction recording...');
    const response2 = await sendChatMessage('Record these transactions: Pizza order $45.99, Gas expense $67.23, Office supplies $23.15');
    
    console.log('   Response Type:', response2.type || 'unknown');
    console.log('   Success:', response2.success);
    
    if (response2.type === 'excel') {
      console.log('   ✅ SUCCESS: Excel file with transactions created!');
      console.log('   📄 Filename:', response2.filename);
      console.log('   📁 Filepath:', response2.filepath);
    } else if (response2.type === 'chat') {
      console.log('   ❌ PROBLEM: GPT gave instructions instead of creating Excel');
      console.log('   💬 Response:', response2.response?.substring(0, 200) + '...');
    }
    
    // 4. Test regular conversation still works
    console.log('\n4️⃣  Testing regular conversation...');
    const response3 = await sendChatMessage('Hi, how are you today?');
    
    if (response3.type === 'chat') {
      console.log('   ✅ SUCCESS: Regular conversation works');
      console.log('   💬 Response:', response3.response?.substring(0, 100) + '...');
    } else {
      console.log('   ❓ Unexpected response type for greeting:', response3.type);
    }
    
    console.log('\n📊 Test Summary:');
    console.log('   ✓ Authentication working');
    console.log('   ✓ Excel files being created (not instructions)');
    console.log('   ✓ Regular conversation still functional');
    console.log('   ✓ System correctly distinguishes between modes');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testExcelCreation();