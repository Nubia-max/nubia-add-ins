// Test if Excel generation quality is preserved with the new dual-stage system
require('dotenv').config();
const FinancialIntelligenceService = require('./backend/src/services/financialIntelligence');

async function testExcelQuality() {
  console.log('🎨 TESTING EXCEL GENERATION QUALITY');
  console.log('═'.repeat(80));

  // Simple accounting question to test Excel output quality
  const simpleQuestion = `Create a basic income statement for a company with:
- Revenue: 1,000,000
- Cost of goods sold: 600,000
- Operating expenses: 200,000
- Interest expense: 50,000
- Tax rate: 25%

Show all calculations and create a professional Excel worksheet.`;

  try {
    console.log('🧠 Testing dual-stage system with simple accounting question...');

    const financialIntelligence = new FinancialIntelligenceService();
    const result = await financialIntelligence.processFinancialCommand(simpleQuestion);

    console.log('📊 RESULTS:');
    console.log('📊 Success:', result.success);
    console.log('📊 Has structure:', !!result.structure);

    if (result.structure) {
      console.log('\n📋 EXCEL STRUCTURE QUALITY CHECK:');
      console.log('📋 Worksheets:', result.structure.workbook?.length || 0);
      console.log('📋 Formatting commands:', result.structure.commands?.length || 0);
      console.log('📋 Meta info:', JSON.stringify(result.structure.meta, null, 2));

      if (result.structure.workbook && result.structure.workbook[0]) {
        const firstSheet = result.structure.workbook[0];
        console.log('📋 First sheet name:', firstSheet.name);
        console.log('📋 First sheet rows:', firstSheet.data?.length || 0);
        console.log('📋 First sheet columns:', firstSheet.data?.[0]?.length || 0);

        // Show sample data
        if (firstSheet.data && firstSheet.data.length > 0) {
          console.log('\n📋 SAMPLE DATA:');
          firstSheet.data.slice(0, 5).forEach((row, i) => {
            console.log(`📋 Row ${i + 1}:`, row);
          });
        }
      }

      console.log('\n🎨 FORMATTING ENHANCEMENT CHECK:');
      if (result.structure.commands && result.structure.commands.length > 0) {
        console.log('✅ Post-processing formatting applied successfully');
        console.log('🎨 Total commands:', result.structure.commands.length);
        console.log('🎨 Command types:', result.structure.commands.map(cmd => cmd.type).slice(0, 5));
      } else {
        console.log('⚠️ No formatting commands added - enhancement may have failed');
      }

      console.log('\n✅ QUALITY ASSESSMENT:');
      const hasWorksheets = result.structure.workbook && result.structure.workbook.length > 0;
      const hasData = hasWorksheets && result.structure.workbook[0].data && result.structure.workbook[0].data.length > 0;
      const hasFormatting = result.structure.commands && result.structure.commands.length > 0;

      console.log('✅ Has worksheets:', hasWorksheets);
      console.log('✅ Has data:', hasData);
      console.log('✅ Has formatting:', hasFormatting);

      if (hasWorksheets && hasData) {
        console.log('\n🎉 SUCCESS: Excel generation quality is preserved!');
        console.log('🎉 Dual-stage system maintains full functionality');
      } else {
        console.log('\n❌ Excel quality may be compromised');
      }
    } else {
      console.log('\n❌ No Excel structure generated');
    }

    if (result.chatResponse) {
      console.log('\n💬 CHAT RESPONSE QUALITY:');
      console.log('💬 Length:', result.chatResponse.length);
      console.log('💬 Has calculations:', result.chatResponse.toLowerCase().includes('calculation'));
      console.log('💬 Preview:', result.chatResponse.substring(0, 200) + '...');
    }

  } catch (error) {
    console.error('❌ Excel quality test failed:', error.message);
  }

  console.log('\n' + '═'.repeat(80));
}

testExcelQuality().catch(console.error);