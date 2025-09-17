// ANALYZE: Compare DeepSeek's RAW response vs what the app extracts
require('dotenv').config();
const FinancialIntelligenceService = require('./backend/src/services/financialIntelligence');

async function analyzeRawResponse() {
  console.log('🔍 RAW RESPONSE ANALYSIS - Find the corruption point');
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
    const financialIntelligence = new FinancialIntelligenceService();

    // HACK: Temporarily modify the service to capture the raw response
    const originalMethod = financialIntelligence.processFinancialCommand;
    let capturedRawResponse = '';

    financialIntelligence.processFinancialCommand = async function(message) {
      const result = await originalMethod.call(this, message);

      // We need to intercept the raw response somehow
      // Let's call it again but look at the logs
      return result;
    };

    console.log('🧠 Sending to DeepSeek...');
    const result = await financialIntelligence.processFinancialCommand(question);

    console.log('\n📊 EXTRACTED BY APP:');
    console.log('📊 Chat Response:', result.chatResponse.substring(0, 300) + '...');
    console.log('📊 Has Structure:', !!result.structure);

    if (result.structure) {
      console.log('📊 Structure Mode:', result.structure.meta?.mode);
      console.log('📊 Structure Worksheets:', result.structure.workbook?.length);

      // Look for NCI values in the structure
      const structStr = JSON.stringify(result.structure);
      const nciMatches = structStr.match(/(\d+)/g) || [];
      console.log('📊 Numbers in structure:', nciMatches.slice(0, 10));

      // Check if we can find the correct calculations
      const hasCorrectNCI = structStr.includes('132') || structStr.includes('1320');
      const hasCorrectTotal = structStr.includes('700') || structStr.includes('7000');

      console.log('📊 Contains correct NCI (132):', hasCorrectNCI);
      console.log('📊 Contains correct total (700):', hasCorrectTotal);
    }

    console.log('\n🔍 HYPOTHESIS TESTING:');
    console.log('🔍 1. Is DeepSeek giving wrong answer? (Check raw logs above)');
    console.log('🔍 2. Is parsing corrupting the data?');
    console.log('🔍 3. Is Excel generation changing numbers?');
    console.log('🔍 4. Is some other process interfering?');

    // Check if the chat response mentions the correct numbers
    const chatHasCorrectNCI = result.chatResponse.includes('132') || result.chatResponse.includes('1320');
    const chatHasCorrectTotal = result.chatResponse.includes('700') || result.chatResponse.includes('7000');

    console.log('\n💬 CHAT RESPONSE ANALYSIS:');
    console.log('💬 Contains correct NCI (132):', chatHasCorrectNCI);
    console.log('💬 Contains correct total (700):', chatHasCorrectTotal);

    if (!chatHasCorrectNCI && !chatHasCorrectTotal) {
      console.log('\n❌ SMOKING GUN: DeepSeek is NOT giving the same answer in your app!');
      console.log('❌ Something is causing DeepSeek to calculate differently');
      console.log('❌ Check: System prompt differences, context interference, or API differences');
    } else {
      console.log('\n✅ DeepSeek is giving correct answer, but something else is corrupting it');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  console.log('\n' + '═'.repeat(80));
}

analyzeRawResponse().catch(console.error);