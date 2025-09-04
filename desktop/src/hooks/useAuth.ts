import { useState, useEffect } from 'react';
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

  const checkAuth = async () => {
    if (!cloudApi.isAuthenticated()) {
      setLoading(false);
      return;
    }

    try {
      const [profileData, subscriptionData] = await Promise.all([
        cloudApi.getProfile(),
        cloudApi.getSubscription()
      ]);
      
      setUser(profileData);
      setSubscription(subscriptionData);
      setError(null);
    } catch (error) {
      console.error('Auth check failed:', error);
      setError(error instanceof Error ? error.message : 'Authentication failed');
      setUser(null);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const result = await cloudApi.login(email, password);
      setUser(result.user);
      await checkAuth(); // Refresh subscription data
      return result;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Login failed');
      throw error;
    }
  };

  const register = async (email: string, password: string) => {
    try {
      const result = await cloudApi.register(email, password);
      setUser(result.user);
      await checkAuth(); // Get initial subscription (trial)
      return result;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Registration failed');
      throw error;
    }
  };

  const logout = () => {
    cloudApi.logout();
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
    if (!subscription) return false;
    
    if (subscription.status !== 'ACTIVE' && subscription.status !== 'TRIAL') {
      return false;
    }

    // Check if trial expired
    if (subscription.status === 'TRIAL' && subscription.billingPeriodEnd) {
      const now = new Date();
      const trialEnd = new Date(subscription.billingPeriodEnd);
      if (now > trialEnd) return false;
    }

    // Check usage limits (-1 means unlimited)
    if (subscription.automationsLimit !== -1) {
      return subscription.automationsUsed < subscription.automationsLimit;
    }

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

  useEffect(() => {
    checkAuth();
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