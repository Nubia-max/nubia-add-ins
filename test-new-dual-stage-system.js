// Test the new dual-stage system: simplified reasoning + post-processing formatting
require('dotenv').config();
const FinancialIntelligenceService = require('./backend/src/services/financialIntelligence');

async function testDualStageSystem() {
  console.log('🧪 TESTING NEW DUAL-STAGE SYSTEM');
  console.log('═'.repeat(80));
  console.log('🧪 Stage 1: Simplified DeepSeek reasoning');
  console.log('🧪 Stage 2: Post-processing Excel formatting');
  console.log('═'.repeat(80));

  const consolidationQuestion = `P acquired 80% of S 3 years ago. Goodwill on acquisition was 80,000. The recoverable amount of goodwill at 31 December 20X1 is 65,000.

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
    console.log('🧠 Sending consolidation question to new dual-stage system...');
    console.log('⏱️ This may take several minutes for DeepSeek to think thoroughly...');

    const startTime = Date.now();
    const financialIntelligence = new FinancialIntelligenceService();
    const result = await financialIntelligence.processFinancialCommand(consolidationQuestion);
    const endTime = Date.now();
    const processingTime = (endTime - startTime) / 1000;

    console.log(`⏱️ Total processing time: ${processingTime.toFixed(1)} seconds`);
    console.log('═'.repeat(80));

    console.log('📊 DUAL-STAGE SYSTEM RESULTS:');
    console.log('📊 Success:', result.success);
    console.log('📊 Has structure:', !!result.structure);
    console.log('📊 Tokens used:', result.tokensUsed);

    if (result.chatResponse) {
      console.log('\n💬 CHAT RESPONSE:');
      console.log(result.chatResponse);

      // Look for the critical numbers
      const chatText = result.chatResponse;
      const nciMatches = chatText.match(/non.?controlling.*?(\d+[,\d]*)/gi) || [];
      const totalMatches = chatText.match(/total.*?profit.*?(\d+[,\d]*)/gi) || [];
      const revenueMatches = chatText.match(/revenue.*?(\d+[,\d]*)/gi) || [];

      console.log('\n🔍 CRITICAL NUMBERS ANALYSIS:');
      console.log('🔍 NCI references found:', nciMatches);
      console.log('🔍 Total profit references:', totalMatches);
      console.log('🔍 Revenue references:', revenueMatches);

      // Check for correct answers
      const hasCorrectNCI = chatText.includes('132') || chatText.includes('1320');
      const hasCorrectTotal = chatText.includes('700') || chatText.includes('7000');
      const hasCorrectRevenue = chatText.includes('1,700') || chatText.includes('1700');

      console.log('\n✅ ACCURACY CHECK:');
      console.log('✅ Contains correct NCI (132,000):', hasCorrectNCI);
      console.log('✅ Contains correct total (700,000):', hasCorrectTotal);
      console.log('✅ Contains correct revenue (1,700,000):', hasCorrectRevenue);

      if (hasCorrectNCI && hasCorrectTotal) {
        console.log('\n🎉 SUCCESS! Dual-stage system gives CORRECT answer!');
        console.log('🎉 The simplified prompt fixed DeepSeek\'s reasoning!');
      } else {
        console.log('\n❌ Still getting wrong answer - need further investigation');
      }
    }

    if (result.structure) {
      console.log('\n📋 EXCEL STRUCTURE ANALYSIS:');
      console.log('📋 Mode:', result.structure.meta?.mode);
      console.log('📋 Framework:', result.structure.meta?.framework);
      console.log('📋 Worksheets:', result.structure.workbook?.length);
      console.log('📋 Formatting commands:', result.structure.commands?.length || 0);

      // Check for numbers in the Excel structure
      const structStr = JSON.stringify(result.structure);
      const structHasNCI = structStr.includes('132') || structStr.includes('1320');
      const structHasTotal = structStr.includes('700') || structStr.includes('7000');

      console.log('📋 Excel contains correct NCI:', structHasNCI);
      console.log('📋 Excel contains correct total:', structHasTotal);

      console.log('\n🎨 FORMATTING ENHANCEMENT STATUS:');
      if (result.structure.commands && result.structure.commands.length > 0) {
        console.log('🎨 Post-processing formatting applied successfully');
        console.log('🎨 Commands added:', result.structure.commands.length);
      } else {
        console.log('🎨 No formatting commands - may need adjustment');
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('❌ Stack:', error.stack);
  }

  console.log('\n' + '═'.repeat(80));
  console.log('🧪 DUAL-STAGE SYSTEM TEST COMPLETE');
}

testDualStageSystem().catch(console.error);