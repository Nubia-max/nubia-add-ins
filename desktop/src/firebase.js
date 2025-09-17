import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

// Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Connect to emulators only if explicitly enabled
if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_USE_FIREBASE_EMULATOR === 'true') {
  try {
    // Only connect to emulators if not already connected
    if (!auth._delegate._config.emulator) {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099');
    }

    if (!db._delegate._config.settings.host.includes('127.0.0.1')) {
      connectFirestoreEmulator(db, '127.0.0.1', 8080);
    }
    console.log('Connected to Firebase emulators');
  } catch (error) {
    console.warn('Failed to connect to emulators, using production Firebase:', error);
  }
} else {
  console.log('Using production Firebase');
}

export default app;