const { executeRealExcelTask } = require('./src/excelAutomation');

async function testExcelAutomation() {
  console.log('🧪 Testing Excel automation with: "record sales of 5000"');
  
  const result = await executeRealExcelTask('record sales of 5000', (step, message) => {
    console.log(`Step ${step}: ${message}`);
  });
  
  console.log('\n📊 Result:', result);
}

testExcelAutomation().catch(console.error);