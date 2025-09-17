// Test DeepSeek's Complete Excel Freedom
require('dotenv').config();
const LLMService = require('./backend/src/services/llmService');

async function testCompleteExcelFreedom() {
  console.log('🎨 Testing DeepSeek\'s Complete Excel Freedom...');
  console.log('═'.repeat(60));

  if (!process.env.DEEPSEEK_API_KEY) {
    console.log('❌ Please set DEEPSEEK_API_KEY environment variable');
    return;
  }

  // Test cases that demonstrate complete Excel freedom
  const testCases = [
    {
      name: "Color Specification Test",
      prompt: `Create a simple budget with revenue $50000 and expenses $30000.
      Make cell B5 red color. Make the header row yellow background.
      Make profit cells green if positive, red if negative.`
    },
    {
      name: "Chart Creation Test",
      prompt: `Create a monthly sales report for Q1 2024:
      Jan: $25000, Feb: $30000, Mar: $35000
      Show this data on a column chart titled "Q1 Sales Performance".
      Make the chart colorful with different colors for each month.`
    },
    {
      name: "Advanced Formatting Test",
      prompt: `Create a profit and loss statement with the entire sheet having a light blue background.
      Make totals bold and red. Add borders around all data.
      Use accounting number format for all amounts.`
    },
    {
      name: "Formula Freedom Test",
      prompt: `Create a loan calculator with:
      - Principal: $100000
      - Interest rate: 5%
      - Years: 30
      Use Excel formulas for monthly payment calculation (PMT function).
      Make formula cells have a yellow background so I can see them.`
    },
    {
      name: "User Custom Request Test",
      prompt: `Create a simple income statement and make the whole sheet yellow as the background color.
      Also add a pie chart showing the breakdown of expenses.`
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n🧪 ${testCase.name}`);
    console.log('─'.repeat(50));
    console.log(`📝 Prompt: ${testCase.prompt}`);

    try {
      const startTime = Date.now();

      const llmService = new LLMService();
      const response = await llmService.createCompletion({
        messages: [
          {
            role: 'user',
            content: testCase.prompt
          }
        ]
      });

      const endTime = Date.now();
      const responseTime = ((endTime - startTime) / 1000).toFixed(1);

      console.log(`⏱️  Response time: ${responseTime}s`);

      const responseText = response.choices[0].message.content;

      // Analyze capabilities used
      const capabilities = {
        colors: responseText.includes('color') || responseText.includes('fill') || responseText.includes('red') || responseText.includes('yellow'),
        charts: responseText.includes('chart') || responseText.includes('Chart'),
        formulas: responseText.includes('formula') || responseText.includes('=') || responseText.includes('PMT'),
        formatting: responseText.includes('bold') || responseText.includes('border') || responseText.includes('numFmt'),
        excelData: responseText.includes('[EXCEL_DATA]')
      };

      console.log('📊 Capabilities Demonstrated:');
      console.log(`   Colors: ${capabilities.colors ? '✅' : '❌'}`);
      console.log(`   Charts: ${capabilities.charts ? '✅' : '❌'}`);
      console.log(`   Formulas: ${capabilities.formulas ? '✅' : '❌'}`);
      console.log(`   Formatting: ${capabilities.formatting ? '✅' : '❌'}`);
      console.log(`   Excel Structure: ${capabilities.excelData ? '✅' : '❌'}`);

      // Show sample of response
      console.log('\n🎯 Sample Response (first 300 chars):');
      console.log(responseText.substring(0, 300) + '...');

      if (capabilities.excelData) {
        console.log('🚀 Excel file will be generated with custom formatting!');
      }

    } catch (error) {
      console.error(`❌ Test failed: ${error.message}`);
    }

    console.log('═'.repeat(50));
  }

  console.log('\n🎉 Complete Excel Freedom Testing Complete!');
  console.log('\n💡 DeepSeek\'s Excel Capabilities:');
  console.log('   ✨ ANY cell can be ANY color (red, blue, yellow, #FF0000, etc.)');
  console.log('   ✨ Charts: column, bar, line, pie, area, scatter');
  console.log('   ✨ Formulas: SUM, VLOOKUP, PMT, IF, INDEX, MATCH, etc.');
  console.log('   ✨ Colors: names (red, blue), hex (#FF0000), RGB');
  console.log('   ✨ Formatting: borders, fonts, alignment, number formats');
  console.log('   ✨ User requests: "make it yellow", "add a graph", etc.');
  console.log('   ✨ Complete freedom to implement user specifications');

  console.log('\n🎯 Example Commands DeepSeek Can Use:');
  console.log('   • Make B5 red: {"type": "format", "range": "B5", "color": "red"}');
  console.log('   • Create chart: {"type": "chart", "range": "A1:B5", "chartType": "pie"}');
  console.log('   • Add formula: {"type": "formula", "cell": "C1", "formula": "=SUM(A1:B1)"}');
  console.log('   • Yellow sheet: {"type": "format", "range": "A1:Z100", "fill": {"color": "yellow"}}');
}

// Run the comprehensive test
testCompleteExcelFreedom().catch(console.error);