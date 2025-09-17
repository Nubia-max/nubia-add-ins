// Quick test: Just the reasoning stage without Excel enhancement to avoid timeout
require('dotenv').config();
const { LEGENDARY_NUBIA_SYSTEM_PROMPT } = require('./backend/src/constants/systemPrompts');
const OpenAI = require('./backend/node_modules/openai') || require('./node_modules/openai');

async function testReasoningOnly() {
  console.log('🧠 TESTING SIMPLIFIED REASONING ONLY (no post-processing)');
  console.log('═'.repeat(80));

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
    const client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com',
    });

    console.log('📊 SYSTEM PROMPT LENGTH:', LEGENDARY_NUBIA_SYSTEM_PROMPT.length);
    console.log('📊 SYSTEM PROMPT FIRST 200 CHARS:', LEGENDARY_NUBIA_SYSTEM_PROMPT.substring(0, 200));

    const response = await client.chat.completions.create({
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
      max_tokens: 16000,
      reasoning: true
    });

    const answer = response.choices[0].message.content;
    console.log('\n📝 DEEPSEEK RESPONSE:');
    console.log(answer);

    // Check for the key numbers
    const hasCorrectNCI = answer.includes('132') || answer.includes('1320');
    const hasCorrect75 = answer.includes('75') || answer.includes('750');
    const hasCorrectTotal = answer.includes('700') || answer.includes('7000');
    const hasCorrectRevenue = answer.includes('1,700') || answer.includes('1700');

    console.log('\n🔍 NUMBER ANALYSIS:');
    console.log('🔍 Contains NCI 132,000:', hasCorrectNCI);
    console.log('🔍 Contains NCI 75,000:', hasCorrect75);
    console.log('🔍 Contains total 700,000:', hasCorrectTotal);
    console.log('🔍 Contains revenue 1,700,000:', hasCorrectRevenue);

    console.log('\n📊 EXPECTED CORRECT ANSWER (from website):');
    console.log('📊 Revenue: 1,700,000 (not 800,000)');
    console.log('📊 Total Profit: 700,000');
    console.log('📊 NCI: 132,000 (not 75,000)');

    console.log('\n🔍 ISSUE ANALYSIS:');
    if (hasCorrect75 && !hasCorrectNCI) {
      console.log('❌ Still calculating NCI wrong - getting 75k instead of 132k');
      console.log('❌ This suggests the URP calculation or other adjustment is wrong');
      console.log('🔍 Correct calc: S profit 400k - 10k depreciation = 390k, NCI 20% = 78k base');
      console.log('🔍 But website shows 132k - there must be additional factors');
    } else if (hasCorrectNCI) {
      console.log('✅ Simplified prompt fixed the NCI calculation!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testReasoningOnly().catch(console.error);