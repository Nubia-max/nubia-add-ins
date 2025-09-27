// Manual credit addition script
const admin = require('firebase-admin');

// Initialize Firebase Admin with service account
const serviceAccount = {
  projectId: 'aibun-ai',
  clientEmail: 'firebase-adminsdk-fbsvc@aibun-ai.iam.gserviceaccount.com',
  privateKey: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDstYnL3fuRu0Ad\nuBwrE0sIpuNkZ2RettlP0VIRQi1koDKwhDgJA5hWx30VJoCGRigsPBLMNymQR8WI\n2h1MJB6Zzn2RcQ09e4ioo7nG+DP2HqdO5srpoYEMgnm3RoyvHwn+HYTAziFMRSwI\nGEmXJuezLnM6RKboJVODwgG/xs5Injoymk5pxFo7Epldxw6Wl+BHy6LdNbv2Wj/v\nfNJBUYFeVXV8jQDNqzywnIRJcUg5zNLLdYqJ7tivCGZlYfl9qsUCuvNF1uk0yd4z\nqsplMdRkWIVN8dIIqr2n+osTeAFr3xPlItnVSiQJbVhtJs60LHCzleiAlRUqzW9l\n3KVIcYMHAgMBAAECggEAJFtVyNxVkXKjTG1E1lDmS3PmpTtELVAEXMAXzNLPSg9Y\n+ce1G51TvrBxQ9hgET+hV/n6ISev2JtNedGWgmVh1dnja31jvTfGK7DKDgd9Y6Yd\nqH7GV9AYlCVOMJpDbXpk/IToKP0AHEjblHq2guLU366YwDBfOnTROQGJZz1P3dM0\nGn+ISdHqnSIVXUgy1+Haqy4JUrpfaYBWTc8lRZwB2MKUZ02++ddSr+1JW1eduYPr\nnMHr4yF9GC72364X5n/98Gv8aQ97GkH60yzatVkTGp4g0zG7tETm9b7lLnEdIdCX\nWjVvZNCPUIyR0zVZ54DrzApvcLaQdwoXmXrqmSL38QKBgQD2kp06cMTgR7E/1eV4\n4q6VrzAJg0Eugz87SSQsYig1vkxcBR0XcrUzsUyhSI3T8A5KhXjMSWq6DwU6m9wg\ntP3leDyUdHMDpFCXfG6T104JIn1NbXDYZjSX59R1AOY37naYCt6JTBFtOJTXXxMz\na050Zsge+GvQIDF6ak6N0kp6EwKBgQD1wmHR956RoHQoKF6BGcZVZ2dzSRN5dpIY\nr8UqM5BCMhthi1JAI+sV/J3uR4OmT0wpI9F9+9B2EbFNsoHw4OOxmZosB1wpRXjk\nhK8rW+VO8+agRIooohcNA5k4KyEiLHBwl1w7HaUNQcR0PioPb9vq+1A3a6BQI9Lf\nyHljTIFxvQKBgFlQdEll7bp73ZWM6ikmmyy3H4Rimeq6Od5EuSimiYAmJUyzwXzr\n3P0TfPly6YTakKKnxEDjWxh4NmGrcUobpVhIfFEd+UdZbqPgu8ErnSWr641vVg/c\nvbJElG2pXLrn0udyEHfVKP7SHwAAfVkDxpBdZqHpRExITQPVnAy9HqMnAoGBAIzF\nv4qqMGZyZpbqKNgCj500EgnzffhBdwY1CNdXmfaRBSYmzAJ5kJuTjFOFG2AUZCfc\noI9twsce81TyP4RfDY4Z0joOLThm1wzvA/fuN7e19hEvsYP89P87ZHTMH7qXggC8\nctRZ8sVZOtLrGOSmym4bbqOQPtAo9Q3Co+XBWRRxAoGBAJBSpkra/C/4UsnpaVe7\nTBGVQObMhU3tCekiq10FC5Y2PSs8i1bzp7QQ+xKCBN9vicoRnu724/cYrBd6o00g\nuk48MZVPxgHSMzucEQSASDwPBZU2PdV7VLadRbJibcV7J2wYE/vb9d9MINQViVeT\nBHzMOTpI5y4tWpXMK5N9cHfT\n-----END PRIVATE KEY-----\n"
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://aibun-ai.firebase.com"
});

const db = admin.firestore();

async function addCredits() {
  try {
    const userId = 'anonymous';  // Switch to anonymous user
    const creditsToAdd = 200;

    console.log('Adding 200 credits to anonymous user (current Excel user)');

    // Get current anonymous user data
    const userDoc = await db.collection('credits').doc(userId).get();
    let userData = userDoc.data();

    if (!userData) {
      // Create anonymous user if doesn't exist
      userData = {
        userId: userId,
        credits: 6,
        isAnonymous: true,
        createdAt: admin.firestore.Timestamp.now(),
        lastUsed: admin.firestore.Timestamp.now(),
        totalPurchased: 0,
        totalUsed: 4
      };
    }

    console.log('Current anonymous user data:', userData);

    // Add credits
    const newCredits = userData.credits + creditsToAdd;
    const newTotalPurchased = userData.totalPurchased + creditsToAdd;

    await db.collection('credits').doc(userId).set({
      ...userData,
      credits: newCredits,
      totalPurchased: newTotalPurchased
    });

    // Record transaction
    await db.collection('transactions').add({
      userId: userId,
      type: 'purchase',
      credits: creditsToAdd,
      amount: 3000,
      timestamp: admin.firestore.Timestamp.now(),
      success: true
    });

    console.log('✅ Successfully added 200 credits to anonymous user');
    console.log('New balance:', newCredits);
    console.log('Total purchased:', newTotalPurchased);

  } catch (error) {
    console.error('❌ Error adding credits:', error);
  }
}

addCredits().then(() => process.exit(0));