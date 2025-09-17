// AUDIT: Find the exact calculation error compared to correct DeepSeek answer
require('dotenv').config();
const FinancialIntelligenceService = require('./backend/src/services/financialIntelligence');

async function auditCalculationError() {
  console.log('🔍 CALCULATION ERROR AUDIT');
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

  console.log('📊 CORRECT DEEPSEEK WEBSITE ANSWER:');
  console.log('📊 Revenue: 1,700');
  console.log('📊 Cost of Sales: (555)');
  console.log('📊 Total Profit: 700');
  console.log('📊 NCI: 132');
  console.log('📊 Parent: 568');

  console.log('\n🔍 CORRECT CALCULATION BREAKDOWN:');
  console.log('🔍 P Sales: 500 + S Sales: 400 - Intercompany: 100 = 800 Revenue');
  console.log('🔍 Wait... DeepSeek website shows 1,700 revenue, not 800...');
  console.log('🔍 This suggests: 1,000 + 800 - 100 = 1,700');
  console.log('🔍 But question says P=500, S=400... Something is wrong');

  console.log('\n🔍 ANALYZING YOUR APP\'S RESPONSE...');

  try {
    const financialIntelligence = new FinancialIntelligenceService();
    const result = await financialIntelligence.processFinancialCommand(question);

    if (result.chatResponse) {
      console.log('\n📄 YOUR APP\'S RESPONSE:');
      console.log(result.chatResponse);

      // Extract numbers from response
      const response = result.chatResponse;
      const nciMatch = response.match(/(\d+,?\d*)\s*(attributable to|non-controlling)/i);
      const totalMatch = response.match(/total.*?(\d+,?\d*)/i);

      if (nciMatch) {
        const nciValue = nciMatch[1].replace(',', '');
        console.log('\n❌ YOUR APP NCI:', nciValue);
        console.log('✅ CORRECT NCI: 132,000');
        console.log('🔍 DIFFERENCE:', (132000 - parseInt(nciValue)));
      }
    }

    if (result.structure) {
      console.log('\n📋 ANALYZING EXCEL STRUCTURE DATA:');
      const jsonStr = JSON.stringify(result.structure, null, 2);

      // Look for NCI calculations in the data
      const nciMatches = jsonStr.match(/"NCI.*?(\d+)"/gi) || [];
      const profitMatches = jsonStr.match(/".*profit.*?(\d+)"/gi) || [];

      console.log('📋 NCI references found:', nciMatches);
      console.log('📋 Profit references found:', profitMatches.slice(0, 5)); // First 5 only

      // Check if the numbers match correct calculations
      console.log('\n🧮 MANUAL CALCULATION CHECK:');
      console.log('🧮 S\'s reported profit: 400,000');
      console.log('🧮 Less: URP (5,000) - this reduces S\'s profit');
      console.log('🧮 Less: Extra depreciation (10,000)');
      console.log('🧮 S\'s adjusted profit: 400,000 - 5,000 - 10,000 = 385,000');
      console.log('🧮 NCI share (20%): 385,000 × 20% = 77,000');
      console.log('🧮 ❌ This gives 77,000, but correct answer is 132,000!');

      console.log('\n🔍 THE ISSUE: App is calculating URP wrong or missing something!');
      console.log('🔍 Website shows total profit 700k, app likely shows 600k');
      console.log('🔍 Difference of 100k suggests URP or other adjustment error');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  console.log('\n' + '═'.repeat(80));
}

auditCalculationError().catch(console.error);