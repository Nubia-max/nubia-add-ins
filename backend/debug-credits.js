// Debug credit discrepancy script
const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.production' });

// Initialize Firebase Admin using environment variables
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: process.env.FIREBASE_PROJECT_ID
});

const db = admin.firestore();

async function debugCredits() {
  try {
    console.log('🔍 Debugging credit discrepancy...\n');

    // Check all user credit documents (correct collection name)
    const creditsSnapshot = await db.collection('user_credits').get();

    console.log('📊 All user credit records:');
    creditsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log(`- User ID: ${doc.id}`);
      console.log(`  Credits: ${data.credits}`);
      console.log(`  IsAnonymous: ${data.isAnonymous}`);
      console.log(`  TotalPurchased: ${data.totalPurchased}`);
      console.log(`  TotalUsed: ${data.totalUsed}`);
      console.log('');
    });

    // Fix the specific user shown in screenshot
    const userToFix = 'zAPy8SWqqaTmrOCDieE23wPGlf63';
    console.log(`🔧 Fixing user: ${userToFix}`);

    await db.collection('user_credits').doc(userToFix).update({
      isAnonymous: true,  // This should be true for Firebase anonymous users
      lastUpdated: admin.firestore.Timestamp.now()
    });

    console.log('✅ Fixed isAnonymous field to true');

    // Check for any 'anonymous' hardcoded entries
    const anonymousDoc = await db.collection('user_credits').doc('anonymous').get();
    if (anonymousDoc.exists) {
      console.log('⚠️ Found hardcoded "anonymous" user:');
      console.log(anonymousDoc.data());

      // Delete the hardcoded anonymous user
      await db.collection('user_credits').doc('anonymous').delete();
      console.log('🗑️ Deleted hardcoded "anonymous" user');
    }

    console.log('\n✅ Debug complete');

  } catch (error) {
    console.error('❌ Debug error:', error);
  }
}

debugCredits().then(() => process.exit(0));