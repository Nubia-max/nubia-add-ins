// Firebase Configuration for Nubia
import admin from 'firebase-admin';
import { logger } from '../utils/logger';

// Initialize Firebase Admin SDK
let firebaseApp: admin.app.App;

export const initializeFirebase = () => {
  try {
    // Check if already initialized
    if (firebaseApp) {
      return firebaseApp;
    }

    // Validate required environment variables
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
      throw new Error('Missing required Firebase environment variables');
    }

    // Initialize with environment variables
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });

    logger.info('Firebase Admin SDK initialized successfully');
    return firebaseApp;

  } catch (error) {
    logger.error('Failed to initialize Firebase:', error);
    logger.error('Environment variables check:', {
      projectId: !!process.env.FIREBASE_PROJECT_ID,
      clientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: !!process.env.FIREBASE_PRIVATE_KEY
    });
    throw new Error('Firebase initialization failed');
  }
};

// Get Firestore instance
export const getFirestore = () => {
  if (!firebaseApp) {
    initializeFirebase();
  }
  return admin.firestore();
};

// Get Firebase Auth instance
export const getAuth = () => {
  if (!firebaseApp) {
    initializeFirebase();
  }
  return admin.auth();
};

// Verify Firebase ID token
export const verifyIdToken = async (idToken: string): Promise<admin.auth.DecodedIdToken | null> => {
  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    logger.error('Token verification failed:', error);
    return null;
  }
};

// Firestore collections
export const COLLECTIONS = {
  USERS: 'users',
  CREDITS: 'user_credits',
  TRANSACTIONS: 'credit_transactions',
  USAGE: 'usage_logs'
};

export default { initializeFirebase, getFirestore, getAuth, verifyIdToken };