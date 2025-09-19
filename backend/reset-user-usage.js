const admin = require('firebase-admin');

// Initialize Firebase Admin (using the same config as your server)
const serviceAccount = require('./service-account-key.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'aibun-ai'
  });
}

const db = admin.firestore();

async function resetUserUsage(userId) {
  try {
    console.log(`Looking for subscription for user: ${userId}`);

    // Get user's subscription
    const subscriptionsRef = db.collection('subscriptions');
    const snapshot = await subscriptionsRef.where('userId', '==', userId).get();

    if (snapshot.empty) {
      console.log('No subscription found for user');
      return;
    }

    const doc = snapshot.docs[0];
    const subscription = doc.data();

    console.log('Current subscription:', {
      tier: subscription.tier,
      automationsUsed: subscription.automationsUsed,
      automationsLimit: subscription.automationsLimit,
      status: subscription.status
    });

    // Reset usage to 0
    await doc.ref.update({
      automationsUsed: 0
    });

    console.log('✅ Usage reset to 0');

    // Verify the update
    const updatedDoc = await doc.ref.get();
    const updatedData = updatedDoc.data();
    console.log('Updated subscription:', {
      tier: updatedData.tier,
      automationsUsed: updatedData.automationsUsed,
      automationsLimit: updatedData.automationsLimit,
      status: updatedData.status
    });

  } catch (error) {
    console.error('Error resetting usage:', error);
  }
}

// You can replace this with your actual user ID from Firebase Auth
const userId = process.argv[2] || 'your-user-id-here';

if (userId === 'your-user-id-here') {
  console.log('Please provide a user ID as an argument:');
  console.log('node reset-user-usage.js <user-id>');
  process.exit(1);
}

resetUserUsage(userId);