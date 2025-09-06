const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testGPTExcelGeneration() {
  console.log('🧪 Testing GPT-powered Excel generation system...\n');

  const complexTransactions = `june 1-started business with cash 10,000 naira
june 4-opened business bank account with 6000 naira from cash
june 7-purchased office supplies for 2000 naira cash
june 10-sold goods to customer A for 5000 naira on credit
june 15-received 3000 naira from customer A
june 18-paid rent 8000 naira from bank account
june 20-purchased inventory for 12000 naira on credit from supplier X
june 25-sold goods for 15000 naira cash
june 28-paid electricity bill 1500 naira cash
june 30-owner withdrew 4000 naira for personal use`;

  try {
    console.log('📤 Sending complex accounting transactions to GPT...');
    console.log('Transaction data:', complexTransactions.substring(0, 100) + '...\n');

    const response = await fetch('http://localhost:5001/api/generate-excel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userInput: complexTransactions,
        userId: 'test-user'
      })
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ SUCCESS! GPT Excel generation completed\n');
      console.log('📊 Generated File:', result.filename);
      console.log('📍 File Path:', result.filepath);
      console.log('📋 Structure:', result.structure);
      console.log('\n📑 Worksheets Generated:');
      
      result.worksheets.forEach((ws, index) => {
        console.log(`  ${index + 1}. ${ws.name} (${ws.rowCount} rows, ${ws.columnCount} columns)`);
      });

      console.log('\n🎉 This is exactly what we wanted - GPT analyzed the transactions and created proper accounting books!');
      console.log('💡 No more hardcoded Date|Description|Amount tables!');
      
    } else {
      console.log('❌ FAILED:', result.error);
    }

  } catch (error) {
    console.error('🚨 Test failed:', error.message);
    console.log('\n💡 Make sure the backend server is running on port 5001');
    console.log('   Run: BACKEND_PORT=5001 node backend/src/server-simple.js');
  }
}

// Additional test with simple input
async function testSimpleInput() {
  console.log('\n\n🧪 Testing with simple input...\n');

  try {
    const response = await fetch('http://localhost:5001/api/generate-excel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userInput: 'record sale of 5000 to customer John',
        userId: 'test-simple'
      })
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ Simple test also works!');
      console.log('📊 Generated:', result.filename);
      console.log('📋 Worksheets:', result.worksheets.map(w => w.name).join(', '));
    } else {
      console.log('❌ Simple test failed:', result.error);
    }

  } catch (error) {
    console.error('🚨 Simple test error:', error.message);
  }
}

// Run tests
testGPTExcelGeneration()
  .then(() => testSimpleInput())
  .then(() => {
    console.log('\n🎯 Test complete! Check the generated Excel files in ~/Documents/Nubia/');
  });