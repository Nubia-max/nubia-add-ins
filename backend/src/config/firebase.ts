// Firebase Configuration for Nubia
import admin from 'firebase-admin';
import { logger } from '../utils/logger';

// Initialize Firebase Admin SDK
let firebaseApp: admin.app.App;
let firebaseHealthy = false;

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

    // Test Firebase connection
    testFirebaseConnection();

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

// Test Firebase connection health
const testFirebaseConnection = async (): Promise<void> => {
  try {
    // Test Firestore connectivity
    const firestore = getFirestore();
    await firestore.collection('_health_check').doc('test').get();

    // Test Auth connectivity
    const auth = getAuth();
    await auth.listUsers(1); // Just get 1 user to test auth

    firebaseHealthy = true;
    logger.info('Firebase health check passed');

  } catch (error) {
    firebaseHealthy = false;
    logger.warn('Firebase health check failed:', error);
    logger.warn('Firebase services may be degraded - falling back to local storage where possible');
  }
};

// Check Firebase health status
export const isFirebaseHealthy = (): boolean => {
  return firebaseHealthy;
};

// Enhanced Firestore getter with health checking
export const getFirestore = () => {
  if (!firebaseApp) {
    initializeFirebase();
  }

  const firestore = admin.firestore();

  // Configure Firestore settings for better reliability
  try {
    firestore.settings({
      ignoreUndefinedProperties: true,
      timestampsInSnapshots: true
    });
  } catch (error) {
    // Settings may already be configured, ignore
  }

  return firestore;
};

// Enhanced Auth getter
export const getAuth = () => {
  if (!firebaseApp) {
    initializeFirebase();
  }
  return admin.auth();
};

// Enhanced token verification with better error handling
export const verifyIdToken = async (idToken: string): Promise<admin.auth.DecodedIdToken | null> => {
  try {
    if (!firebaseHealthy) {
      logger.warn('Firebase unhealthy, skipping token verification');
      return null;
    }

    const decodedToken = await getAuth().verifyIdToken(idToken, true); // Check revocation
    return decodedToken;

  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Firebase ID token has expired')) {
        logger.warn('Token expired:', error.message);
      } else if (error.message.includes('Firebase ID token has been revoked')) {
        logger.warn('Token revoked:', error.message);
      } else if (error.message.includes('Firebase ID token has invalid signature')) {
        logger.warn('Invalid token signature:', error.message);
      } else {
        logger.error('Token verification failed:', error);
      }
    }
    return null;
  }
};

export const COLLECTIONS = {
  USERS: 'users',
  CREDITS: 'user_credits',
  TRANSACTIONS: 'credit_transactions',
  USAGE: 'usage_logs'
};

export default { initializeFirebase, getFirestore, getAuth, verifyIdToken, isFirebaseHealthy };