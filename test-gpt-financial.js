// Test script for GPT-driven financial document generation
const FinancialIntelligenceService = require('./backend/src/services/financialIntelligence');
const DynamicExcelGenerator = require('./backend/src/services/dynamicExcelGenerator');

async function testFinancialGPT() {
  console.log('🧪 Testing GPT Financial Intelligence System...\n');

  // Initialize services
  const financialAI = new FinancialIntelligenceService();
  const excelGenerator = new DynamicExcelGenerator();

  // Test scenarios with complete GPT freedom
  const testScenarios = [
    {
      name: "Restaurant Sales Tracking",
      command: "Track my restaurant's daily sales, calculate taxes, and manage tips"
    },
    {
      name: "Cryptocurrency Trading",
      command: "I bought Bitcoin for $50,000 and sold it for $75,000 - create all necessary tax documents"
    },
    {
      name: "Small Business Expenses",
      command: "Set up expense tracking for my consulting business with tax deduction categories"
    },
    {
      name: "Loan Application Documents",
      command: "Prepare comprehensive financial documents for my bakery loan application"
    },
    {
      name: "E-commerce Inventory",
      command: "Create inventory management system for my online clothing store with profit calculations"
    }
  ];

  for (const scenario of testScenarios) {
    console.log(`\n🎯 Testing: ${scenario.name}`);
    console.log(`📝 Command: "${scenario.command}"`);
    console.log('─'.repeat(60));

    try {
      // Test GPT intelligence
      console.log('🧠 Processing with GPT...');
      const gptResult = await financialAI.processFinancialCommand(scenario.command);

      if (gptResult.success) {
        console.log('✅ GPT Analysis successful!');
        console.log(`📊 Worksheets planned: ${gptResult.structure.worksheets?.length || 0}`);
        console.log(`🤖 Tokens used: ${gptResult.tokensUsed}`);
        
        // Show what GPT decided to create
        if (gptResult.structure.worksheets) {
          gptResult.structure.worksheets.forEach((sheet, index) => {
            console.log(`   ${index + 1}. ${sheet.name}: ${sheet.columns?.length || 0} columns`);
          });
        }

        // Test Excel generation (without auto-opening)
        console.log('📄 Generating Excel file...');
        const excelResult = await excelGenerator.createExcelFromGPT(
          gptResult.structure,
          { 
            filename: `test-${scenario.name.toLowerCase().replace(/\s+/g, '-')}.xlsx`,
            autoOpen: false 
          }
        );

        if (excelResult.success) {
          console.log('✅ Excel generation successful!');
          console.log(`📁 File: ${excelResult.filename}`);
        } else {
          console.log('❌ Excel generation failed:', excelResult.error);
        }

      } else {
        console.log('❌ GPT processing failed:', gptResult.error);
        if (gptResult.fallback) {
          console.log('🛟 Fallback structure available');
        }
      }

    } catch (error) {
      console.log('❌ Test error:', error.message);
    }

    console.log('\n' + '═'.repeat(60));
  }

  console.log('\n🎊 GPT Financial Intelligence Testing Complete!');
  console.log('\n💡 Key Features Demonstrated:');
  console.log('   ✨ Complete GPT freedom to design any financial document');
  console.log('   ✨ Dynamic worksheet creation based on specific needs');
  console.log('   ✨ Intelligent column structure and formula generation');
  console.log('   ✨ Industry-specific optimizations');
  console.log('   ✨ Professional Excel formatting and styling');
  console.log('   ✨ Fallback handling for any edge cases');
}

// Run the test
if (process.env.OPENAI_API_KEY) {
  testFinancialGPT().catch(console.error);
} else {
  console.log('❌ Please set OPENAI_API_KEY environment variable to run tests');
  console.log('💡 This system gives GPT complete freedom to create ANY financial document!');
  console.log('\n🔧 To test with a real API key:');
  console.log('   export OPENAI_API_KEY="your-key-here"');
  console.log('   node test-gpt-financial.js');
}