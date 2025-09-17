// DIRECT DEEPSEEK CALL: Bypass all app logic and call DeepSeek directly like the website
require('dotenv').config();
const OpenAI = require('./backend/node_modules/openai') || require('./node_modules/openai');

async function directDeepSeekCall() {
  console.log('🔍 DIRECT DEEPSEEK CALL - Bypass ALL app logic');
  console.log('═'.repeat(80));

  if (!process.env.DEEPSEEK_API_KEY) {
    console.log('❌ Please set DEEPSEEK_API_KEY environment variable');
    return;
  }

  const question = `P acquired 80% of S 3 years ago. Goodwill on acquisition was 80,000. The recoverable amount of goodwill at 31 December 20X1 is 65,000.

At 31 December 20X1:
- P had sales of 500,000 and cost of sales 300,000
- S had sales of 400,000 and cost of sales 250,000
- During the year S sold goods to P for 100,000 (cost to S was 70,000)
- At year end P still held 50% of these goods in inventory
- S's assets were revalued upward by 100,000 at acquisition (to be depreciated over 10 years)
- S paid dividends of 100,000 during the year
- P's profit for the year (before group adjustments) was 200,000
- S's profit for the year was 400,000

Prepare the consolidated income statement showing the profit attributable to non-controlling interests.`;

  try {
    console.log('🧠 CALLING DEEPSEEK DIRECTLY (like website)...');

    const client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com',
    });

    // Call 1: MINIMAL prompt (like website)
    console.log('\n📤 TEST 1: MINIMAL PROMPT (like website)');
    const minimalResponse = await client.chat.completions.create({
      model: 'deepseek-reasoner',
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: question
        }
      ],
    });

    const minimalAnswer = minimalResponse.choices[0].message.content;
    console.log('📥 MINIMAL Response length:', minimalAnswer.length);
    console.log('📥 MINIMAL Preview:', minimalAnswer.substring(0, 500) + '...');

    // Check for correct numbers
    const minimalHas132 = minimalAnswer.includes('132') || minimalAnswer.includes('1320');
    const minimalHas700 = minimalAnswer.includes('700') || minimalAnswer.includes('7000');
    const minimalHas1700 = minimalAnswer.includes('1,700') || minimalAnswer.includes('1700');

    console.log('📥 MINIMAL Contains NCI 132:', minimalHas132);
    console.log('📥 MINIMAL Contains total 700:', minimalHas700);
    console.log('📥 MINIMAL Contains revenue 1700:', minimalHas1700);

    // Call 2: WITH your app's system prompt
    console.log('\n📤 TEST 2: WITH YOUR APP\'S SYSTEM PROMPT');
    const { LEGENDARY_NUBIA_SYSTEM_PROMPT } = require('./backend/src/constants/systemPrompts');

    const appPromptResponse = await client.chat.completions.create({
      model: 'deepseek-reasoner',
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: LEGENDARY_NUBIA_SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: question
        }
      ],
    });

    const appAnswer = appPromptResponse.choices[0].message.content;
    console.log('📥 APP PROMPT Response length:', appAnswer.length);
    console.log('📥 APP PROMPT Preview:', appAnswer.substring(0, 500) + '...');

    // Check for correct numbers
    const appHas132 = appAnswer.includes('132') || appAnswer.includes('1320');
    const appHas700 = appAnswer.includes('700') || appAnswer.includes('7000');
    const appHas1700 = appAnswer.includes('1,700') || appAnswer.includes('1700');

    console.log('📥 APP PROMPT Contains NCI 132:', appHas132);
    console.log('📥 APP PROMPT Contains total 700:', appHas700);
    console.log('📥 APP PROMPT Contains revenue 1700:', appHas1700);

    console.log('\n🔍 COMPARISON ANALYSIS:');
    if (minimalHas132 && !appHas132) {
      console.log('❌ CULPRIT: Your LEGENDARY_NUBIA_SYSTEM_PROMPT is corrupting DeepSeek!');
    } else if (!minimalHas132 && !appHas132) {
      console.log('🔍 Both give wrong answer - might be API/model difference vs website');
    } else if (appHas132 && minimalHas132) {
      console.log('✅ Both give correct answer - problem is elsewhere in your app');
    } else {
      console.log('🔍 Mixed results - need deeper investigation');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  console.log('\n' + '═'.repeat(80));
}

directDeepSeekCall().catch(console.error);