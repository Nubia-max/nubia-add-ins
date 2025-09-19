// Script to reset all users' automation usage to 0
// Using the same Firebase setup as the main server

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK using the same approach as the server
if (!admin.apps.length) {
  try {
    // Use the same service account file as the main server
    const serviceAccount = require('./firebase-service-account.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'aibun-ai'
    });
    console.log('✅ Firebase Admin initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error.message);
    console.error('Make sure firebase-service-account.json exists in the backend directory');
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
      const data = doc.data();
      console.log(`Resetting user ${data.userId}: ${data.automationsUsed} -> 0`);

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