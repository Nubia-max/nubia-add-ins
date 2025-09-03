import { useState, useEffect, useCallback } from 'react';

interface WindowPosition {
  x: number;
  y: number;
}

interface UserPreferences {
  theme: 'light' | 'dark';
  windowPosition?: WindowPosition;
  automationMode: 'visual' | 'background';
  soundEffects: boolean;
  notifications: boolean;
  autoMinimize: boolean;
  voiceEnabled: boolean;
  shortcuts: {
    toggle: string;
    minimize: string;
    help: string;
  };
  showTooltips: boolean;
  reducedMotion: boolean;
  onboardingCompleted: boolean;
  lastUsed: string;
}

const defaultPreferences: UserPreferences = {
  theme: 'light',
  automationMode: 'visual',
  soundEffects: true,
  notifications: true,
  autoMinimize: false,
  voiceEnabled: true,
  shortcuts: {
    toggle: 'Ctrl+Space',
    minimize: 'Escape',
    help: '?'
  },
  showTooltips: true,
  reducedMotion: false,
  onboardingCompleted: false,
  lastUsed: new Date().toISOString()
};

const STORAGE_KEY = 'nubia-user-preferences';

export const useUserPreferences = () => {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [isLoading, setIsLoading] = useState(true);

  // Load preferences from storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPreferences({ ...defaultPreferences, ...parsed });
      }
      
      // Detect system preferences
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      
      setPreferences(prev => ({
        ...prev,
        theme: prev.theme || (prefersDark ? 'dark' : 'light'),
        reducedMotion: prefersReducedMotion
      }));
    } catch (error) {
      console.error('Error loading user preferences:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save preferences to storage
  const savePreferences = useCallback((newPreferences: Partial<UserPreferences>) => {
    setPreferences(prev => {
      const updated = {
        ...prev,
        ...newPreferences,
        lastUsed: new Date().toISOString()
      };
      
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error('Error saving user preferences:', error);
      }
      
      return updated;
    });
  }, []);

  // Update specific preference
  const updatePreference = useCallback(<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    savePreferences({ [key]: value });
  }, [savePreferences]);

  // Save window position
  const saveWindowPosition = useCallback(async () => {
    if (typeof window !== 'undefined' && window.require) {
      try {
        const { ipcRenderer } = window.require('electron');
        const bounds = await ipcRenderer.invoke('get-window-bounds');
        
        if (bounds) {
          updatePreference('windowPosition', { x: bounds.x, y: bounds.y });
        }
      } catch (error) {
        console.error('Error saving window position:', error);
      }
    }
  }, [updatePreference]);

  // Restore window position
  const restoreWindowPosition = useCallback(async () => {
    if (preferences.windowPosition && typeof window !== 'undefined' && window.require) {
      try {
        const { ipcRenderer } = window.require('electron');
        await ipcRenderer.invoke('set-window-position', preferences.windowPosition);
      } catch (error) {
        console.error('Error restoring window position:', error);
      }
    }
  }, [preferences.windowPosition]);

  // Reset to defaults
  const resetPreferences = useCallback(() => {
    setPreferences(defaultPreferences);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Error resetting preferences:', error);
    }
  }, []);

  // Get preference with fallback
  const getPreference = useCallback(<K extends keyof UserPreferences>(
    key: K,
    fallback?: UserPreferences[K]
  ): UserPreferences[K] => {
    return preferences[key] !== undefined ? preferences[key] : (fallback || defaultPreferences[key]);
  }, [preferences]);

  // Check if first time user
  const isFirstTime = !preferences.onboardingCompleted;

  // Mark onboarding as completed
  const completeOnboarding = useCallback(() => {
    updatePreference('onboardingCompleted', true);
  }, [updatePreference]);

  // Export preferences for backup
  const exportPreferences = useCallback(() => {
    const data = {
      preferences,
      exportedAt: new Date().toISOString(),
      version: '1.0.0'
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `nubia-preferences-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
  }, [preferences]);

  // Import preferences from backup
  const importPreferences = useCallback((file: File) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          if (data.preferences) {
            savePreferences(data.preferences);
            resolve();
          } else {
            reject(new Error('Invalid backup file format'));
          }
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Error reading file'));
      reader.readAsText(file);
    });
  }, [savePreferences]);

  return {
    preferences,
    isLoading,
    isFirstTime,
    savePreferences,
    updatePreference,
    saveWindowPosition,
    restoreWindowPosition,
    resetPreferences,
    getPreference,
    completeOnboarding,
    exportPreferences,
    importPreferences
  };
};