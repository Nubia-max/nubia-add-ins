// Test the financial intelligence service directly without the full server
require('dotenv').config();
const FinancialIntelligenceService = require('./backend/src/services/financialIntelligence');
const DynamicExcelGenerator = require('./backend/src/services/dynamicExcelGenerator');

async function testDirectFlow() {
  console.log('🔧 TESTING DIRECT SERVICE FLOW (No Server Required)');
  console.log('═'.repeat(80));

  if (!process.env.DEEPSEEK_API_KEY) {
    console.log('❌ Please set DEEPSEEK_API_KEY environment variable');
    return;
  }

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
    console.log('🧠 Step 1: Testing Financial Intelligence Service...');
    const financialIntelligence = new FinancialIntelligenceService();

    const startTime = Date.now();
    const result = await financialIntelligence.processFinancialCommand(consolidationQuestion);
    const responseTime = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n📊 FINANCIAL INTELLIGENCE RESULT:');
    console.log('📊 Response time:', responseTime + 's');
    console.log('📊 Success:', result.success);
    console.log('📊 Has chat response:', !!result.chatResponse);
    console.log('📊 Has structure:', !!result.structure);
    console.log('📊 Tokens used:', result.tokensUsed);

    if (result.chatResponse) {
      console.log('\n💬 CHAT RESPONSE ANALYSIS:');
      console.log('💬 Length:', result.chatResponse.length);
      console.log('💬 First 300 chars:', result.chatResponse.substring(0, 300) + '...');

      // Check for correct accounting concepts
      const response = result.chatResponse.toLowerCase();
      const concepts = ['goodwill', 'impairment', 'consolidat', 'nci', 'non-controlling'];
      const foundConcepts = concepts.filter(c => response.includes(c));
      console.log('💬 Accounting concepts found:', foundConcepts.join(', '));
    }

    if (result.structure) {
      console.log('\n📋 STRUCTURE ANALYSIS:');
      console.log('📋 Meta mode:', result.structure.meta?.mode);
      console.log('📋 Framework:', result.structure.meta?.framework);
      console.log('📋 Worksheets:', result.structure.workbook?.length);
      console.log('📋 Worksheet names:', result.structure.workbook?.map(w => w.name).join(', '));

      // Test Excel generation
      console.log('\n🏗️ Step 2: Testing Excel Generation...');
      const excelGenerator = new DynamicExcelGenerator();

      const excelStartTime = Date.now();
      const excelResult = await excelGenerator.generateFromStructure(result.structure, 'test-user');
      const excelTime = ((Date.now() - excelStartTime) / 1000).toFixed(1);

      console.log('\n📄 EXCEL GENERATION RESULT:');
      console.log('📄 Generation time:', excelTime + 's');
      console.log('📄 Success:', excelResult.success);
      console.log('📄 Filename:', excelResult.filename);
      console.log('📄 Filepath:', excelResult.filepath);

      if (excelResult.success) {
        console.log('✅ Excel file created successfully!');

        // Check if file exists
        const fs = require('fs');
        if (fs.existsSync(excelResult.filepath)) {
          const stats = fs.statSync(excelResult.filepath);
          console.log('📄 File size:', (stats.size / 1024).toFixed(1) + ' KB');
          console.log('📄 File created:', stats.birthtime.toISOString());
        }
      } else {
        console.log('❌ Excel generation failed:', excelResult.error);
      }

      // Final assessment
      console.log('\n🎯 FINAL ASSESSMENT:');
      const hasGoodwillCalculation = result.chatResponse.toLowerCase().includes('15') &&
                                    result.chatResponse.toLowerCase().includes('impairment');
      const hasNCICalculation = result.chatResponse.toLowerCase().includes('non-controlling') ||
                               result.chatResponse.toLowerCase().includes('nci');
      const hasConsolidationAdjustments = result.chatResponse.toLowerCase().includes('elimination') ||
                                          result.chatResponse.toLowerCase().includes('intercompany');

      console.log('🎯 Has goodwill impairment calculation:', hasGoodwillCalculation ? '✅' : '❌');
      console.log('🎯 Has NCI calculation:', hasNCICalculation ? '✅' : '❌');
      console.log('🎯 Has consolidation adjustments:', hasConsolidationAdjustments ? '✅' : '❌');
      console.log('🎯 Excel generated successfully:', excelResult.success ? '✅' : '❌');

      const overallSuccess = hasGoodwillCalculation && hasNCICalculation &&
                            hasConsolidationAdjustments && excelResult.success;

      console.log('\n🏆 OVERALL RESULT:', overallSuccess ? '✅ EXCELLENT' : '⚠️ NEEDS REVIEW');

    } else {
      console.log('❌ No Excel structure generated - this indicates an issue');
    }

  } catch (error) {
    console.error('\n❌ ERROR in direct flow test:');
    console.error('❌ Message:', error.message);
    console.error('❌ Stack:', error.stack);
  }

  console.log('\n' + '═'.repeat(80));
}

// Run the test
testDirectFlow().catch(console.error);