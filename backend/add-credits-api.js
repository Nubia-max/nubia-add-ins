// Add credits via API (handles caching properly)
const fetch = require('node-fetch');

async function addCreditsViaAPI() {
  try {
    const userId = 'zAPy8SWqqaTmrOCDieE23wPGlf63'; // Your Firebase anonymous user
    const creditsToAdd = 50; // Add 50 more credits

    console.log(`Adding ${creditsToAdd} credits to user ${userId} via API...`);

    // Simulate the API call that the frontend would make
    const response = await fetch('http://localhost:3001/api/credits/manual-add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-anonymous-id': userId,
        'Authorization': 'Bearer test' // Dummy token for manual add
      },
      body: JSON.stringify({
        userId: userId,
        credits: creditsToAdd,
        reason: 'Manual addition via script'
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Credits added successfully:', result);
    } else {
      const error = await response.text();
      console.log('❌ API call failed:', error);

      // Fallback: Direct API call to add credits
      console.log('🔄 Trying direct database update with cache clear...');

      const clearCacheResponse = await fetch('http://localhost:3001/api/credits/clear-cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-anonymous-id': userId
        }
      });

      if (clearCacheResponse.ok) {
        console.log('✅ Cache cleared successfully');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Make sure the backend server is running on localhost:3001');
    console.log('💡 Try: npm run dev');
  }
}

addCreditsViaAPI();