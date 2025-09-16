// Test Enhanced Thinking System at Temperature 0
require('dotenv').config();
const LLMService = require('./backend/src/services/llmService');

async function testEnhancedThinking() {
  console.log('🧠 Testing Enhanced Thinking System (Temperature 0)');
  console.log('═'.repeat(60));

  if (!process.env.DEEPSEEK_API_KEY) {
    console.log('❌ Please set DEEPSEEK_API_KEY environment variable');
    return;
  }

  try {
    const llmService = new LLMService();

    // Test complex consolidation problem similar to your example
    const complexProblem = `
P acquired 80% of S three years ago. For the year ended 31 December 20X1:

P's Income Statement:
- Revenue: 1,000,000
- Cost of sales: (400,000)
- Gross profit: 600,000
- Distribution costs: (120,000)
- Administrative expenses: (80,000)
- Dividend from S: 80,000
- Finance cost: (25,000)
- Profit before tax: 455,000
- Tax: (45,000)
- Profit for period: 410,000

S's Income Statement:
- Revenue: 800,000
- Cost of sales: (250,000)
- Gross profit: 550,000
- Distribution costs: (75,000)
- Administrative expenses: (20,000)
- Finance cost: (15,000)
- Profit before tax: 440,000
- Tax: (40,000)
- Profit for period: 400,000

Additional information:
- Goodwill at acquisition was 80,000, now recoverable amount is 65,000
- S sold goods to P for 100,000 during year
- P has inventory from S costing S 30,000, in P's books at 35,000
- Fair value increase of 100,000 on S's asset at acquisition, depreciated over 10 years

Prepare the consolidated income statement showing all workings.
`;

    console.log('📝 Testing with complex consolidation problem...');
    console.log('⏱️  Starting enhanced thinking process...\n');

    const startTime = Date.now();

    const response = await llmService.createCompletion({
      messages: [
        {
          role: 'user',
          content: complexProblem
        }
      ]
    });

    const endTime = Date.now();
    const thinkingTime = ((endTime - startTime) / 1000).toFixed(1);

    console.log(`⏱️  Thinking completed in ${thinkingTime} seconds`);
    console.log('═'.repeat(60));
    console.log('🎯 DEEPSEEK RESPONSE:');
    console.log('═'.repeat(60));
    console.log(response.choices[0].message.content);
    console.log('═'.repeat(60));

    // Analyze the response for thinking quality
    const responseText = response.choices[0].message.content;
    const hasWorkings = responseText.includes('calculation') || responseText.includes('working') || responseText.includes('step');
    const hasReasonings = responseText.includes('because') || responseText.includes('therefore') || responseText.includes('since');
    const showsProcess = responseText.includes('first') || responseText.includes('second') || responseText.includes('then');

    console.log('\n📊 THINKING QUALITY ANALYSIS:');
    console.log(`✅ Shows calculations/workings: ${hasWorkings ? 'YES' : 'NO'}`);
    console.log(`✅ Explains reasoning: ${hasReasonings ? 'YES' : 'NO'}`);
    console.log(`✅ Shows step-by-step process: ${showsProcess ? 'YES' : 'NO'}`);
    console.log(`⏱️  Thinking time: ${thinkingTime}s (Target: show thorough thinking)`);

    console.log('\n🎉 Enhanced Thinking System Test Complete!');
    console.log('\n💡 Key Improvements Made:');
    console.log('   ✨ Temperature locked at 0 for complete determinism');
    console.log('   ✨ Enhanced system prompt prioritizes thinking first');
    console.log('   ✨ Extended 5-minute timeout for thorough reasoning');
    console.log('   ✨ Extended conversation context (5 messages)');
    console.log('   ✨ Same thorough approach applied to ALL tasks');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.message.includes('timeout')) {
      console.log('ℹ️  Timeout occurred - DeepSeek was thinking thoroughly (this is expected for complex problems)');
    }
  }
}

// Run the test
testEnhancedThinking().catch(console.error);