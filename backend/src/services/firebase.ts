import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getAuth } from 'firebase-admin/auth';
import { logger } from '../utils/logger';

// Firebase configuration from environment
const firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID || 'aibun-ai',
  // Use service account key file for development
  credential: admin.credential.cert(require('../../firebase-service-account.json'))
};

// Initialize Firebase Admin SDK
let app: admin.app.App;
let db: FirebaseFirestore.Firestore;
let storage: any;
let auth: admin.auth.Auth;

export const initializeFirebase = () => {
  try {
    if (!admin.apps.length) {
      app = admin.initializeApp(firebaseConfig);
      logger.info('Firebase Admin SDK initialized successfully');
    } else {
      app = admin.app();
    }

    db = getFirestore(app);
    storage = getStorage(app);
    auth = getAuth(app);

    // Connect to Firebase emulators only in development with explicit flag
    if (process.env.NODE_ENV === 'development' && process.env.USE_FIREBASE_EMULATOR === 'true') {
      // Connect Firestore to emulator
      const settings = {
        host: '127.0.0.1:8080',
        ssl: false
      };
      db.settings(settings);

      logger.info('Connected to Firebase emulators in development mode');
    } else {
      logger.info('Using production Firebase services');
    }

    logger.info('Firebase services initialized:', {
      projectId: firebaseConfig.projectId,
      services: ['Firestore', 'Storage', 'Auth'],
      environment: process.env.NODE_ENV
    });

    return { db, storage, auth };
  } catch (error) {
    logger.error('Firebase initialization failed:', error);
    throw new Error(`Firebase initialization failed: ${error.message}`);
  }
};

// Initialize on import
const { db: firestore, storage: firebaseStorage, auth: firebaseAuth } = initializeFirebase();

export { firestore as db, firebaseStorage as storage, firebaseAuth as auth };

// User interface matching Prisma schema
export interface User {
  id: string;
  email: string;
  firebaseUid: string;
  settings?: any;
  trialEndsAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Subscription interface matching Prisma schema
export interface Subscription {
  id: string;
  userId: string;
  status: string;
  tier: string;
  automationsLimit: number;
  automationsUsed: number;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Chat Session interface
export interface ChatSession {
  id: string;
  userId: string;
  messages: string; // JSON string
  tokensUsed: number;
  createdAt: Date;
  updatedAt: Date;
}

// Conversation History interface (replaces in-memory Map)
export interface ConversationHistory {
  id: string;
  userId: string;
  messages: any[];
  lastExcelStructure: any;
  uploadedDocuments: any[];
  extractedTotals: any[];
  createdAt: Date;
  updatedAt: Date;
}

// Usage Record interface
export interface UsageRecord {
  id: string;
  userId: string;
  subscriptionId?: string;
  automationType: string;
  command: string;
  success: boolean;
  tokensUsed: number;
  executionTimeMs: number;
  errorMessage?: string;
  metadata?: string;
  createdAt: Date;
}

// Automation Template interface
export interface AutomationTemplate {
  id: string;
  userId: string;
  name: string;
  description?: string;
  commands: string; // JSON string
  category?: string;
  isPublic: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Firebase service class for database operations
export class FirebaseService {

  // User operations
  async createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const userRef = db.collection('users').doc();
    const now = new Date();

    const user: User = {
      id: userRef.id,
      ...userData,
      settings: typeof userData.settings === 'string' ? userData.settings : JSON.stringify(userData.settings),
      createdAt: now,
      updatedAt: now
    };

    await userRef.set(user);
    logger.info(`User created: ${user.email}`);
    return user;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const snapshot = await db.collection('users').where('email', '==', email).limit(1).get();
    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as User;
  }

  async getUserById(id: string): Promise<User | null> {
    const doc = await db.collection('users').doc(id).get();
    if (!doc.exists) return null;

    return { id: doc.id, ...doc.data() } as User;
  }

  async getUserByFirebaseUid(firebaseUid: string): Promise<User | null> {
    const snapshot = await db.collection('users').where('firebaseUid', '==', firebaseUid).limit(1).get();
    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as User;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<void> {
    await db.collection('users').doc(id).update({
      ...updates,
      updatedAt: new Date()
    });
  }

  // Firebase Auth token verification
  async verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
    return await auth.verifyIdToken(idToken);
  }

  // Subscription operations
  async createSubscription(subscriptionData: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>): Promise<Subscription> {
    const subRef = db.collection('subscriptions').doc();
    const now = new Date();

    const subscription: Subscription = {
      id: subRef.id,
      ...subscriptionData,
      createdAt: now,
      updatedAt: now
    };

    await subRef.set(subscription);
    return subscription;
  }

  async getSubscriptionByUserId(userId: string): Promise<Subscription | null> {
    const snapshot = await db.collection('subscriptions').where('userId', '==', userId).limit(1).get();
    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Subscription;
  }

  async updateSubscription(id: string, updates: Partial<Subscription>): Promise<void> {
    await db.collection('subscriptions').doc(id).update({
      ...updates,
      updatedAt: new Date()
    });
  }

  // Chat Session operations
  async createChatSession(sessionData: Omit<ChatSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<ChatSession> {
    const sessionRef = db.collection('chatSessions').doc();
    const now = new Date();

    const session: ChatSession = {
      id: sessionRef.id,
      ...sessionData,
      createdAt: now,
      updatedAt: now
    };

    await sessionRef.set(session);
    return session;
  }

  async getChatSessions(userId: string, limit: number = 50): Promise<ChatSession[]> {
    const snapshot = await db.collection('chatSessions')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatSession));
  }

  async deleteChatSession(sessionId: string, userId: string): Promise<void> {
    // Verify ownership before deletion
    const doc = await db.collection('chatSessions').doc(sessionId).get();
    if (doc.exists && (doc.data() as ChatSession).userId === userId) {
      await db.collection('chatSessions').doc(sessionId).delete();
    }
  }

  // Conversation History operations (replaces in-memory Map)
  async getConversationHistory(userId: string): Promise<ConversationHistory | null> {
    const doc = await db.collection('conversationHistory').doc(userId).get();
    if (!doc.exists) return null;

    return { id: doc.id, ...doc.data() } as ConversationHistory;
  }

  async saveConversationHistory(userId: string, history: Omit<ConversationHistory, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<void> {
    const now = new Date();
    const existingDoc = await db.collection('conversationHistory').doc(userId).get();

    if (existingDoc.exists) {
      // Update existing
      await db.collection('conversationHistory').doc(userId).update({
        ...history,
        updatedAt: now
      });
    } else {
      // Create new
      await db.collection('conversationHistory').doc(userId).set({
        id: userId,
        userId,
        ...history,
        createdAt: now,
        updatedAt: now
      });
    }
  }

  async clearConversationHistory(userId: string): Promise<void> {
    await db.collection('conversationHistory').doc(userId).delete();
  }

  // Usage Record operations
  async createUsageRecord(usageData: Omit<UsageRecord, 'id' | 'createdAt'>): Promise<UsageRecord> {
    const usageRef = db.collection('usageRecords').doc();

    const usage: UsageRecord = {
      id: usageRef.id,
      ...usageData,
      createdAt: new Date()
    };

    await usageRef.set(usage);
    return usage;
  }

  // File upload to Firebase Storage
  async uploadFile(buffer: Buffer, fileName: string, userId: string): Promise<string> {
    const bucket = storage.bucket();
    const file = bucket.file(`users/${userId}/uploads/${fileName}`);

    await file.save(buffer, {
      metadata: {
        contentType: 'application/octet-stream'
      }
    });

    // Make file publicly accessible (optional, depends on your security needs)
    await file.makePublic();

    return `https://storage.googleapis.com/${bucket.name}/${file.name}`;
  }


  // Automation Template operations
  async createAutomationTemplate(templateData: Omit<AutomationTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<AutomationTemplate> {
    const templateRef = db.collection('automationTemplates').doc();
    const now = new Date();

    const template: AutomationTemplate = {
      id: templateRef.id,
      ...templateData,
      createdAt: now,
      updatedAt: now
    };

    await templateRef.set(template);
    return template;
  }

  async getAutomationTemplates(options: {
    userId: string;
    category?: string;
    isPublic?: boolean;
  }): Promise<AutomationTemplate[]> {
    let query: any = db.collection('automationTemplates');

    // Filter for user's own templates OR public templates
    query = query.where('userId', '==', options.userId);

    if (options.category) {
      query = query.where('category', '==', options.category);
    }

    if (options.isPublic !== undefined) {
      query = query.where('isPublic', '==', options.isPublic);
    }

    const snapshot = await query.orderBy('usageCount', 'desc').orderBy('createdAt', 'desc').get();

    // Also get public templates if not filtering for user's own
    const publicSnapshot = await db.collection('automationTemplates')
      .where('isPublic', '==', true)
      .orderBy('usageCount', 'desc')
      .orderBy('createdAt', 'desc')
      .get();

    const userTemplates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AutomationTemplate));
    const publicTemplates = publicSnapshot.docs
      .filter(doc => doc.data().userId !== options.userId) // Don't duplicate user's own public templates
      .map(doc => ({ id: doc.id, ...doc.data() } as AutomationTemplate));

    return [...userTemplates, ...publicTemplates];
  }

  async getAutomationTemplateById(id: string): Promise<AutomationTemplate | null> {
    const doc = await db.collection('automationTemplates').doc(id).get();
    if (!doc.exists) return null;

    return { id: doc.id, ...doc.data() } as AutomationTemplate;
  }

  async updateAutomationTemplate(id: string, updates: Partial<AutomationTemplate>): Promise<void> {
    await db.collection('automationTemplates').doc(id).update({
      ...updates,
      updatedAt: new Date()
    });
  }

  // Usage Record operations (simplified for automation controller)
  async getUserUsageRecords(userId: string, automationType?: string): Promise<UsageRecord[]> {
    let query = db.collection('usageRecords').where('userId', '==', userId);

    if (automationType) {
      query = query.where('automationType', '==', automationType);
    }

    const snapshot = await query.orderBy('createdAt', 'desc').limit(100).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UsageRecord));
  }
}

export const firebaseService = new FirebaseService();