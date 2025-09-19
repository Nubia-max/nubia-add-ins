// Script to reset all users' automation usage to 0
require('dotenv').config();

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
    });
    console.log('✅ Firebase Admin initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error.message);
    process.exit(1);
  }
}

const db = admin.firestore();

async function resetAllUsersUsage() {
  try {
    console.log('🔄 Starting to reset all users\' automation usage...');

    // Get all subscriptions
    const subscriptionsSnapshot = await db.collection('subscriptions').get();

    if (subscriptionsSnapshot.empty) {
      console.log('ℹ️ No subscriptions found.');
      return;
    }

    console.log(`📊 Found ${subscriptionsSnapshot.size} subscriptions to reset`);

    // Reset each subscription's automationsUsed to 0
    const batch = db.batch();

    subscriptionsSnapshot.forEach((doc) => {
      const subscriptionRef = doc.ref;
      batch.update(subscriptionRef, {
        automationsUsed: 0,
        updatedAt: new Date()
      });
    });

    await batch.commit();

    console.log('✅ Successfully reset automation usage for all users to 0');
    console.log(`📊 Updated ${subscriptionsSnapshot.size} subscriptions`);

  } catch (error) {
    console.error('❌ Error resetting usage:', error);
  } finally {
    process.exit(0);
  }
}

// Run the reset
resetAllUsersUsage();