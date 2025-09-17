// Test DeepSeek Reasoner with exact consolidation question
require('dotenv').config();
const FinancialIntelligenceService = require('./backend/src/services/financialIntelligence');

async function testDeepSeekReasoning() {
  console.log('🔍 TESTING DEEPSEEK REASONER WITH EXACT CONSOLIDATION QUESTION');
  console.log('═'.repeat(80));

  if (!process.env.DEEPSEEK_API_KEY) {
    console.log('❌ Please set DEEPSEEK_API_KEY environment variable');
    return;
  }

  // The exact question that's failing
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
    console.log('📤 SENDING TO DEEPSEEK REASONER...');
    console.log('📤 Question length:', consolidationQuestion.length);
    console.log('📤 Question preview:', consolidationQuestion.substring(0, 200) + '...');

    const startTime = Date.now();

    const financialIntelligence = new FinancialIntelligenceService();
    const result = await financialIntelligence.processFinancialCommand(consolidationQuestion);

    const endTime = Date.now();
    const responseTime = ((endTime - startTime) / 1000).toFixed(1);

    console.log('\n📥 DEEPSEEK RESPONSE ANALYSIS:');
    console.log('📥 Response time:', responseTime + 's');
    console.log('📥 Success:', result.success);
    console.log('📥 Has structure:', !!result.structure);
    console.log('📥 Tokens used:', result.tokensUsed);

    if (result.chatResponse) {
      console.log('\n💬 CHAT RESPONSE:');
      console.log('💬 Length:', result.chatResponse.length);
      console.log('💬 Content preview:', result.chatResponse.substring(0, 500) + '...');

      // Check for accounting keywords that indicate proper reasoning
      const accountingKeywords = [
        'consolidation', 'goodwill', 'impairment', 'intercompany', 'elimination',
        'non-controlling', 'minority', 'acquisition', 'fair value', 'depreciation'
      ];

      const foundKeywords = accountingKeywords.filter(keyword =>
        result.chatResponse.toLowerCase().includes(keyword)
      );

      console.log('💬 Accounting keywords found:', foundKeywords.length, '/', accountingKeywords.length);
      console.log('💬 Keywords:', foundKeywords.join(', '));
    }

    if (result.structure) {
      console.log('\n📊 EXCEL STRUCTURE:');
      console.log('📊 Meta mode:', result.structure.meta?.mode);
      console.log('📊 Framework:', result.structure.meta?.framework);
      console.log('📊 Worksheets:', result.structure.workbook?.length);
      console.log('📊 Worksheet names:', result.structure.workbook?.map(w => w.name).join(', '));

      // Check for consolidation-specific content
      const structureStr = JSON.stringify(result.structure).toLowerCase();
      const hasConsolidationContent = [
        'consolidated', 'goodwill', 'impairment', 'elimination', 'nci'
      ].some(term => structureStr.includes(term));

      console.log('📊 Has consolidation content:', hasConsolidationContent);
    }

    // Specific validation for consolidation accounting
    const isCorrectConsolidation = validateConsolidationAccounting(result);
    console.log('\n🎯 CONSOLIDATION VALIDATION:', isCorrectConsolidation ? '✅ PASS' : '❌ FAIL');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('❌ Stack:', error.stack);
  }

  console.log('\n' + '═'.repeat(80));
}

function validateConsolidationAccounting(result) {
  if (!result.success || !result.chatResponse) return false;

  const response = result.chatResponse.toLowerCase();

  // Check for key consolidation concepts
  const requiredConcepts = [
    'goodwill', 'impairment', 'intercompany', 'elimination',
    'non-controlling', 'consolidat'
  ];

  const conceptsFound = requiredConcepts.filter(concept =>
    response.includes(concept)
  ).length;

  console.log('🔍 Required concepts found:', conceptsFound, '/', requiredConcepts.length);

  // Check for specific numerical calculations
  const hasNumericalWorkings = /\d{1,3}(,\d{3})*/.test(response);
  console.log('🔍 Has numerical workings:', hasNumericalWorkings);

  // Should have most concepts and numerical workings
  return conceptsFound >= 4 && hasNumericalWorkings;
}

// Run the test
testDeepSeekReasoning().catch(console.error);