// Clear cache after manual Firestore edits
const fetch = require('node-fetch');

async function clearCache() {
  try {
    const userId = 'zAPy8SWqqaTmrOCDieE23wPGlf63'; // Your Firebase anonymous user

    console.log('🧹 Clearing cache for user:', userId);

    // Clear specific user cache
    const response = await fetch('http://localhost:3001/api/credits/debug/clear-cache', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-anonymous-id': userId
      },
      body: JSON.stringify({ userId })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Cache cleared successfully:', result);

      // Also clear all cache to be safe
      console.log('🧹 Clearing all cache...');
      const allCacheResponse = await fetch('http://localhost:3001/api/credits/debug/clear-cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({}) // Empty body clears all cache
      });

      if (allCacheResponse.ok) {
        const allResult = await allCacheResponse.json();
        console.log('✅ All cache cleared:', allResult);
        console.log('\n💡 Now refresh your Excel add-in to see updated credits!');
        console.log('💡 Or wait 5 minutes for frontend cache to expire automatically');
      }

    } else {
      const error = await response.text();
      console.log('❌ Cache clear failed:', error);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Make sure the backend server is running on localhost:3001');
    console.log('💡 Try: npm run dev');
  }
}

clearCache();