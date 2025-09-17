import { useState, useEffect } from 'react';
import { signIn, signUp, signOut as firebaseSignOut, onAuthStateChange, getIdToken } from '../services/auth';
import cloudApi from '../services/cloudApi';

interface User {
  id: string;
  email: string;
  settings?: any;
  createdAt: string;
}

interface Subscription {
  id: string;
  status: string;
  tier: string;
  automationsLimit: number;
  automationsUsed: number;
  billingPeriodEnd?: string;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkAuth = async (firebaseUser?: any) => {
    console.log('🔍 checkAuth called with Firebase user:', firebaseUser);

    if (!firebaseUser) {
      console.log('❌ User not authenticated, clearing state');
      setUser(null);
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      console.log('✅ User authenticated, fetching profile and subscription');

      // Get Firebase ID token for API calls
      const idToken = await getIdToken();
      if (idToken) {
        // Store token for cloudApi
        await storeFirebaseToken(idToken);
      }

      const [profileData, subscriptionData] = await Promise.all([
        cloudApi.getProfile(),
        cloudApi.getSubscription()
      ]);

      console.log('📊 Profile data:', profileData);
      console.log('📊 Subscription data:', subscriptionData);

      setUser(profileData.user || {
        id: firebaseUser.uid,
        email: firebaseUser.email,
        settings: {},
        createdAt: new Date().toISOString()
      });
      setSubscription(subscriptionData);
      setError(null);
    } catch (error) {
      console.error('❌ Auth check failed:', error);
      // Even if backend calls fail, we can still set the Firebase user
      setUser({
        id: firebaseUser.uid,
        email: firebaseUser.email,
        settings: {},
        createdAt: new Date().toISOString()
      });
      setError(null); // Don't show error for initial backend failures
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      console.log('🚀 useAuth.login called');
      const result = await signIn(email, password);
      console.log('✅ Firebase signIn successful:', result);

      if (result.error) {
        throw new Error(result.error);
      }

      // checkAuth will be called by the auth state listener
      console.log('✅ useAuth.login completed');
      return result;
    } catch (error) {
      console.error('❌ useAuth.login failed:', error);
      setError(error instanceof Error ? error.message : 'Login failed');
      throw error;
    }
  };

  const register = async (email: string, password: string) => {
    try {
      console.log('🚀 useAuth.register called');
      const result = await signUp(email, password);
      console.log('✅ Firebase signUp successful:', result);

      if (result.error) {
        throw new Error(result.error);
      }

      // checkAuth will be called by the auth state listener
      console.log('✅ useAuth.register completed');
      return result;
    } catch (error) {
      console.error('❌ useAuth.register failed:', error);
      setError(error instanceof Error ? error.message : 'Registration failed');
      throw error;
    }
  };

  const logout = async () => {
    await firebaseSignOut();
    await cloudApi.logout();
    setUser(null);
    setSubscription(null);
    setError(null);
  };

  const refreshSubscription = async () => {
    if (!user) return;
    
    try {
      const subscriptionData = await cloudApi.getSubscription();
      setSubscription(subscriptionData);
    } catch (error) {
      console.error('Failed to refresh subscription:', error);
    }
  };

  const canUseAutomation = () => {
    if (!subscription) {
      console.log('❌ canUseAutomation: No subscription found');
      return false;
    }

    console.log('🔍 canUseAutomation check:', {
      status: subscription.status,
      used: subscription.automationsUsed,
      limit: subscription.automationsLimit,
      subscription
    });

    if (subscription.status !== 'ACTIVE' && subscription.status !== 'TRIAL' &&
        subscription.status !== 'active' && subscription.status !== 'trial') {
      console.log('❌ canUseAutomation: Invalid status:', subscription.status);
      return false;
    }

    // Check if trial expired
    if ((subscription.status === 'TRIAL' || subscription.status === 'trial') && subscription.billingPeriodEnd) {
      const now = new Date();
      const trialEnd = new Date(subscription.billingPeriodEnd);
      if (now > trialEnd) {
        console.log('❌ canUseAutomation: Trial expired');
        return false;
      }
    }

    // Check usage limits (-1 means unlimited)
    if (subscription.automationsLimit !== -1) {
      const canUse = subscription.automationsUsed < subscription.automationsLimit;
      console.log(`🔍 canUseAutomation: ${subscription.automationsUsed} < ${subscription.automationsLimit} = ${canUse}`);
      return canUse;
    }

    console.log('✅ canUseAutomation: Unlimited usage allowed');
    return true;
  };

  const getUsageStatus = () => {
    if (!subscription) return null;

    const used = subscription.automationsUsed;
    const limit = subscription.automationsLimit;
    const isUnlimited = limit === -1;

    return {
      used,
      limit: isUnlimited ? Infinity : limit,
      remaining: isUnlimited ? Infinity : Math.max(0, limit - used),
      percentage: isUnlimited ? 0 : (used / limit) * 100,
      isUnlimited,
      status: subscription.status,
      tier: subscription.tier
    };
  };

  // Helper function to store Firebase token for cloudApi
  const storeFirebaseToken = async (token: string) => {
    // Check if we're in Electron
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      await (window as any).electronAPI.storeData('nubia_auth_token', token);
    } else {
      // Fallback to localStorage for web
      localStorage.setItem('nubia_auth_token', token);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (firebaseUser) => {
      console.log('🔥 Firebase auth state changed:', firebaseUser);
      await checkAuth(firebaseUser);
    });

    return () => unsubscribe();
  }, []);

  return {
    user,
    subscription,
    loading,
    error,
    login,
    register,
    logout,
    refreshSubscription,
    canUseAutomation,
    getUsageStatus,
    isAuthenticated: !!user,
  };
};