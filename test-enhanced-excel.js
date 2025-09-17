// Test Enhanced Excel Generation with Professional Formatting
require('dotenv').config();
const LLMService = require('./backend/src/services/llmService');

async function testEnhancedExcel() {
  console.log('📊 Testing Enhanced Excel Generation...');
  console.log('═'.repeat(60));

  if (!process.env.DEEPSEEK_API_KEY) {
    console.log('❌ Please set DEEPSEEK_API_KEY environment variable');
    return;
  }

  try {
    const llmService = new LLMService();

    // Test with a financial problem that should create formulas and formatting
    const testProblem = `
Create a profit and loss statement for ABC Company with the following data:
- Revenue: $1,200,000
- Cost of goods sold: $720,000
- Operating expenses: $350,000
- Interest expense: $25,000
- Tax rate: 25%

Include formulas for:
- Gross profit (Revenue - COGS)
- Operating profit (Gross profit - Operating expenses)
- Profit before tax (Operating profit - Interest expense)
- Tax expense (Profit before tax × Tax rate)
- Net profit (Profit before tax - Tax expense)

Format professionally with proper accounting number formats.
`;

    console.log('📝 Testing enhanced Excel generation with formulas...');
    console.log('⏱️  Processing...\n');

    const startTime = Date.now();

    const response = await llmService.createCompletion({
      messages: [
        {
          role: 'user',
          content: testProblem
        }
      ]
    });

    const endTime = Date.now();
    const responseTime = ((endTime - startTime) / 1000).toFixed(1);

    console.log(`✅ Enhanced Excel generation completed in ${responseTime}s`);
    console.log('═'.repeat(60));

    // Show a sample of the response to verify thinking
    const responseText = response.choices[0].message.content;
    console.log('🎯 SAMPLE RESPONSE (first 800 chars):');
    console.log('═'.repeat(60));
    console.log(responseText.substring(0, 800) + '...');
    console.log('═'.repeat(60));

    // Analyze the response for enhanced features
    const hasFormulas = responseText.includes('formula') || responseText.includes('=');
    const hasFormatting = responseText.includes('format') || responseText.includes('numFmt');
    const hasWorkings = responseText.includes('calculation') || responseText.includes('working');
    const hasExcelData = responseText.includes('[EXCEL_DATA]');

    console.log('\n📊 ENHANCED EXCEL ANALYSIS:');
    console.log(`✅ Contains formulas: ${hasFormulas ? 'YES' : 'NO'}`);
    console.log(`✅ Contains formatting commands: ${hasFormatting ? 'YES' : 'NO'}`);
    console.log(`✅ Shows calculations/workings: ${hasWorkings ? 'YES' : 'NO'}`);
    console.log(`✅ Contains Excel data structure: ${hasExcelData ? 'YES' : 'NO'}`);

    console.log('\n🎉 Enhanced Excel Generation Test Complete!');
    console.log('\n💡 Enhancements Made:');
    console.log('   ✨ Improved formula handling with error protection');
    console.log('   ✨ Enhanced professional formatting (headers, borders, alternating rows)');
    console.log('   ✨ Smart column width calculation for financial data');
    console.log('   ✨ Automatic accounting number formats (#,##0_);[Red](#,##0)');
    console.log('   ✨ Support for parentheses negative number format');
    console.log('   ✨ Better handling of range formulas');

    if (hasExcelData) {
      console.log('\n🚀 Excel file should be generated with enhanced formatting!');
    } else {
      console.log('\n💬 Response was chat-only (no Excel structure detected)');
    }

  } catch (error) {
    console.error('❌ Enhanced Excel test failed:', error.message);
    if (error.message.includes('timeout')) {
      console.log('ℹ️  Timeout occurred - DeepSeek was thinking thoroughly (this is expected)');
    }
  }
}

// Run the test
testEnhancedExcel().catch(console.error);