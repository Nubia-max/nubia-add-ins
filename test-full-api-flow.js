// Test the full API flow as the frontend would use it
require('dotenv').config();
const axios = require('axios');

async function testFullAPIFlow() {
  console.log('🌐 TESTING FULL API FLOW (Frontend → Backend → DeepSeek → Excel)');
  console.log('═'.repeat(80));

  const baseURL = 'http://localhost:3001';

  // First register a test user
  let authToken;
  try {
    console.log('👤 Registering test user...');
    const registerResponse = await axios.post(`${baseURL}/api/auth/register`, {
      email: `test-${Date.now()}@example.com`,
      password: 'testpassword123'
    });
    authToken = registerResponse.data.token;
    console.log('✅ User registered successfully');
  } catch (error) {
    console.log('⚠️ Registration failed, trying login...');
    try {
      const loginResponse = await axios.post(`${baseURL}/api/auth/login`, {
        email: 'test@example.com',
        password: 'testpassword123'
      });
      authToken = loginResponse.data.token;
      console.log('✅ User logged in successfully');
    } catch (loginError) {
      console.error('❌ Authentication failed:', loginError.response?.data || loginError.message);
      return;
    }
  }

  // Test the consolidation question via the API
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
    console.log('\n💬 Sending consolidation question to /api/chat...');
    console.log('💬 Message length:', consolidationQuestion.length);

    const startTime = Date.now();

    const chatResponse = await axios.post(`${baseURL}/api/chat`, {
      message: consolidationQuestion,
      includeContext: true
    }, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 300000 // 5 minutes
    });

    const endTime = Date.now();
    const responseTime = ((endTime - startTime) / 1000).toFixed(1);

    console.log('\n📥 API RESPONSE ANALYSIS:');
    console.log('📥 Status:', chatResponse.status);
    console.log('📥 Response time:', responseTime + 's');
    console.log('📥 Response type:', chatResponse.data.type);
    console.log('📥 Success:', chatResponse.data.success);

    if (chatResponse.data.type === 'excel') {
      console.log('\n📊 EXCEL RESPONSE:');
      console.log('📊 Filename:', chatResponse.data.excelData.filename);
      console.log('📊 Filepath:', chatResponse.data.excelData.filepath);
      console.log('📊 Summary:', chatResponse.data.excelData.summary);

      // Check if the Excel structure contains consolidation elements
      if (chatResponse.data.excelData.structure) {
        const structure = chatResponse.data.excelData.structure;
        console.log('📊 Meta mode:', structure.meta?.mode);
        console.log('📊 Framework:', structure.meta?.framework);
        console.log('📊 Worksheets:', structure.workbook?.length);

        const structureStr = JSON.stringify(structure).toLowerCase();
        const hasConsolidation = [
          'consolidat', 'goodwill', 'impairment', 'nci', 'non-controlling'
        ].some(term => structureStr.includes(term));

        console.log('📊 Contains consolidation content:', hasConsolidation);
      }
    }

    console.log('\n💬 CHAT MESSAGE:');
    console.log('💬 Length:', chatResponse.data.message.length);
    console.log('💬 Preview:', chatResponse.data.message.substring(0, 500) + '...');

    // Validate the accounting content
    const message = chatResponse.data.message.toLowerCase();
    const accountingTerms = [
      'goodwill', 'impairment', 'consolidat', 'elimination', 'non-controlling'
    ];

    const termsFound = accountingTerms.filter(term => message.includes(term));
    console.log('💬 Accounting terms found:', termsFound.length, '/', accountingTerms.length);
    console.log('💬 Terms:', termsFound.join(', '));

    // Check for numerical accuracy
    const hasCorrectNumbers = [
      '15,000', '15000', // Goodwill impairment
      '65,000', '65000', // Recoverable amount
      '80,000', '80000'  // Original goodwill
    ].some(num => chatResponse.data.message.includes(num));

    console.log('💬 Contains correct numerical values:', hasCorrectNumbers);

    console.log('\n🎯 OVERALL ASSESSMENT:');
    const isGoodResponse = (
      chatResponse.data.success &&
      termsFound.length >= 3 &&
      hasCorrectNumbers &&
      (chatResponse.data.type === 'excel' || chatResponse.data.type === 'chat')
    );

    console.log('🎯 Response quality:', isGoodResponse ? '✅ EXCELLENT' : '❌ NEEDS IMPROVEMENT');

  } catch (error) {
    console.error('\n❌ API ERROR:');
    console.error('❌ Status:', error.response?.status);
    console.error('❌ Message:', error.response?.data?.error || error.message);
    console.error('❌ Details:', error.response?.data);
  }

  console.log('\n' + '═'.repeat(80));
}

// Run the test
testFullAPIFlow().catch(console.error);