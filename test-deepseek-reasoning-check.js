// Check if DeepSeek Reasoner is actually thinking deeply
require('dotenv').config();
const OpenAI = require('./backend/node_modules/openai') || require('./node_modules/openai');

async function checkDeepSeekReasoning() {
  console.log('🧠 CHECKING IF DEEPSEEK REASONER IS ACTUALLY THINKING');
  console.log('═'.repeat(80));

  if (!process.env.DEEPSEEK_API_KEY) {
    console.log('❌ Please set DEEPSEEK_API_KEY environment variable');
    return;
  }

  const client = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: 'https://api.deepseek.com',
  });

  // Simple test question that should trigger reasoning
  const question = `Solve this step by step: If a company has 100 shares outstanding and the share price increases from $10 to $15, what is the percentage increase in market capitalization?`;

  try {
    console.log('🧠 Testing DeepSeek Reasoner with reasoning enabled...');

    const response = await client.chat.completions.create({
      model: 'deepseek-reasoner',
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: question
        }
      ],
      max_tokens: 4000,
      reasoning: true  // This should enable thinking
    });

    const responseMessage = response.choices[0].message;

    console.log('📊 RESPONSE ANALYSIS:');
    console.log('📊 Response object keys:', Object.keys(response));
    console.log('📊 Choice keys:', Object.keys(response.choices[0]));
    console.log('📊 Message keys:', Object.keys(responseMessage));

    // Check for reasoning content
    console.log('📊 Has reasoning property:', 'reasoning' in responseMessage);
    console.log('📊 Has reasoning_content property:', 'reasoning_content' in responseMessage);

    if (responseMessage.reasoning_content) {
      console.log('\n✅ REASONING DETECTED!');
      console.log('🧠 Reasoning content length:', responseMessage.reasoning_content.length);
      console.log('🧠 Reasoning preview (first 500 chars):');
      console.log(responseMessage.reasoning_content.substring(0, 500));
      console.log('🧠 Reasoning preview (last 200 chars):');
      console.log(responseMessage.reasoning_content.slice(-200));
    } else if (responseMessage.reasoning) {
      console.log('\n✅ REASONING DETECTED (alternative format)!');
      console.log('🧠 Reasoning content length:', responseMessage.reasoning.length);
      console.log('🧠 Reasoning preview:', responseMessage.reasoning.substring(0, 500));
    } else {
      console.log('\n❌ NO REASONING DETECTED!');
      console.log('❌ DeepSeek is NOT thinking deeply');
      console.log('❌ This explains why you\'re getting wrong answers');
    }

    console.log('\n📝 Regular response content:');
    console.log(responseMessage.content);

    console.log('\n🔍 DIAGNOSIS:');
    if (responseMessage.reasoning_content || responseMessage.reasoning) {
      console.log('✅ DeepSeek Reasoner is working - should give better accounting answers');
    } else {
      console.log('❌ DeepSeek Reasoner is NOT thinking properly');
      console.log('❌ This is why you\'re getting simplified/wrong calculations');
      console.log('🔧 Possible fixes:');
      console.log('🔧 1. Check API key permissions for reasoning model');
      console.log('🔧 2. Try different reasoning parameter format');
      console.log('🔧 3. Check if reasoning requires specific message format');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('reasoning')) {
      console.log('❌ Reasoning parameter might not be supported');
    }
  }

  console.log('\n' + '═'.repeat(80));
}

checkDeepSeekReasoning().catch(console.error);