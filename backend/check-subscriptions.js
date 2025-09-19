// Check current subscription data
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK using the same approach as the server
if (!admin.apps.length) {
  try {
    const serviceAccount = require('./firebase-service-account.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'aibun-ai'
    });
    console.log('✅ Firebase Admin initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error.message);
    process.exit(1);
  }
}

const db = admin.firestore();

async function checkSubscriptions() {
  try {
    console.log('🔍 Checking all subscriptions...\n');

    const subscriptionsSnapshot = await db.collection('subscriptions').get();

    if (subscriptionsSnapshot.empty) {
      console.log('ℹ️ No subscriptions found.');
      return;
    }

    console.log(`📊 Found ${subscriptionsSnapshot.size} subscriptions:\n`);

    subscriptionsSnapshot.forEach((doc, index) => {
      const data = doc.data();
      console.log(`Subscription ${index + 1}:`);
      console.log(`  ID: ${doc.id}`);
      console.log(`  User ID: ${data.userId}`);
      console.log(`  Status: "${data.status}"`);
      console.log(`  Tier: "${data.tier}"`);
      console.log(`  Automations Used: ${data.automationsUsed}`);
      console.log(`  Automations Limit: ${data.automationsLimit}`);
      console.log(`  Created: ${data.createdAt?.toDate?.()?.toISOString() || data.createdAt}`);
      console.log(`  Updated: ${data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || 'N/A'}`);
      console.log(''); // blank line
    });

  } catch (error) {
    console.error('❌ Error checking subscriptions:', error);
  } finally {
    process.exit(0);
  }
}

checkSubscriptions();