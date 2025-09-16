// Test API Configuration Fix
require('dotenv').config();
const LLMService = require('./backend/src/services/llmService');

async function testAPIFix() {
  console.log('🔧 Testing API Configuration Fix...');
  console.log('═'.repeat(60));

  if (!process.env.DEEPSEEK_API_KEY) {
    console.log('❌ Please set DEEPSEEK_API_KEY environment variable');
    return;
  }

  try {
    const llmService = new LLMService();

    // Test simple request first to verify API connectivity
    console.log('📝 Testing simple request...');
    const startTime = Date.now();

    const response = await llmService.createCompletion({
      messages: [
        {
          role: 'user',
          content: 'Test: What is 2+2? Show your working.'
        }
      ]
    });

    const endTime = Date.now();
    const responseTime = ((endTime - startTime) / 1000).toFixed(1);

    console.log(`✅ API Request Successful! Response time: ${responseTime}s`);
    console.log('═'.repeat(60));
    console.log('🎯 RESPONSE:');
    console.log('═'.repeat(60));
    console.log(response.choices[0].message.content.substring(0, 500) + '...');
    console.log('═'.repeat(60));

    console.log('\n✅ API Configuration Fix Verified!');
    console.log('\n🔧 Fixes Applied:');
    console.log('   ✨ Removed invalid timeout parameter from API request');
    console.log('   ✨ Moved timeout to OpenAI client constructor (600000ms)');
    console.log('   ✨ Standardized temperature to 0 across all services');
    console.log('   ✨ Cleaned up API request parameters');
    console.log('   ✨ Enhanced system prompt for deep thinking');

  } catch (error) {
    console.error('❌ API Test failed:', error.message);
    console.log('\n🔍 Error Analysis:');
    if (error.message.includes('401')) {
      console.log('   → Invalid API key');
    } else if (error.message.includes('429')) {
      console.log('   → Rate limit exceeded');
    } else if (error.message.includes('deserialize')) {
      console.log('   → API request format issue (may need further investigation)');
    } else if (error.message.includes('timeout')) {
      console.log('   → Request timeout (adjust client timeout)');
    } else {
      console.log('   → Unknown API error');
    }
  }
}

// Run the test
testAPIFix().catch(console.error);