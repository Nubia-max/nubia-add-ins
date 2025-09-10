// Test Rules-First Accounting Engine
require('dotenv').config();
const FinancialIntelligenceService = require('./backend/src/services/financialIntelligence');
const DynamicExcelGenerator = require('./backend/src/services/dynamicExcelGenerator');

async function testRulesFirst() {
  console.log('🎯 Testing Rules-First Accounting Engine');
  
  try {
    // Initialize services
    const financialIntelligence = new FinancialIntelligenceService();
    const excelGenerator = new DynamicExcelGenerator();
    
    // Test message
    const testMessage = "record june 1 started business with cash 10000";
    console.log('📝 Test message:', testMessage);
    
    // Process with rules-first approach
    const result = await financialIntelligence.processFinancialCommand(testMessage);
    
    console.log('✅ Financial Intelligence Result:');
    console.log('- Success:', result.success);
    console.log('- Chat Response:', result.chatResponse);
    console.log('- Tokens Used:', result.tokensUsed);
    
    if (result.structure) {
      console.log('📊 Structure Meta:');
      console.log('- Mode:', result.structure.meta?.mode);
      console.log('- Framework:', result.structure.meta?.framework);
      console.log('- Rules Applied:', result.structure.meta?.rules_applied?.join(', '));
      
      console.log('🔍 Validation Checks:');
      result.structure.meta?.checks?.forEach(check => {
        console.log(`- ${check.check}: ${check.passed ? '✅ PASS' : '❌ FAIL'} - ${check.detail}`);
      });
      
      if (result.structure.workbook) {
        console.log('📋 Workbook Sheets:');
        result.structure.workbook.forEach(sheet => {
          console.log(`- ${sheet.name}: ${sheet.rows?.length || 0} rows`);
        });
      }
      
      // Generate Excel
      console.log('📊 Generating Excel...');
      const excelResult = await excelGenerator.generateWithCompleteFreedom(result.structure, 'test');
      
      if (excelResult.success) {
        console.log('✅ Excel Generation Success:');
        console.log('- Filename:', excelResult.filename);
        console.log('- Filepath:', excelResult.filepath);
        console.log('- Worksheets:', excelResult.worksheets?.map(w => w.name).join(', '));
      } else {
        console.log('❌ Excel generation failed');
      }
    } else {
      console.log('ℹ️ No Excel structure returned (chat-only response)');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error.message.includes('Validation failed')) {
      console.error('🔍 This indicates accounting rules validation failed - this is expected behavior');
    }
  }
}

// Run test
testRulesFirst().catch(console.error);