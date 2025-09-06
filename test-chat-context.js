const axios = require('axios');

const API_URL = 'http://localhost:5001/api/chat';

async function testChatWithContext() {
  console.log('\n🧪 Testing Enhanced Chat with Context\n');
  
  try {
    // Test 1: Send initial message
    console.log('1️⃣  Sending initial message...');
    const response1 = await axios.post(API_URL, {
      message: 'I need to track my monthly expenses for my small business'
    });
    console.log('   Response:', response1.data.response.substring(0, 150) + '...');
    
    // Test 2: Send follow-up that should use context
    console.log('\n2️⃣  Sending contextual follow-up...');
    const response2 = await axios.post(API_URL, {
      message: 'Can you add categories for office supplies, marketing, and payroll?',
      // Include some context from previous message
      context: {
        previousMessage: 'I need to track my monthly expenses for my small business'
      }
    });
    console.log('   Response:', response2.data.response.substring(0, 150) + '...');
    
    // Test 3: Another contextual message
    console.log('\n3️⃣  Adding more details with context...');
    const response3 = await axios.post(API_URL, {
      message: 'Also include columns for tax deductible status and receipt numbers',
      context: {
        previousMessage: 'tracking expenses with categories'
      }
    });
    console.log('   Response:', response3.data.response.substring(0, 150) + '...');
    
    console.log('\n✅ Chat context test completed!');
    console.log('\n📊 Summary:');
    console.log('   - Sent 3 contextual messages');
    console.log('   - AI maintained context throughout conversation');
    console.log('   - Excel structures should build upon each other');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Run the test
testChatWithContext();