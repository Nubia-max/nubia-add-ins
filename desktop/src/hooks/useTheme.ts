import { useState, useEffect } from 'react';
import { storageService } from '../services/storage';

export type Theme = 'light' | 'dark' | 'auto';

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>('dark');
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    // Load saved theme preference
    const loadTheme = async () => {
      try {
        const preferences = await storageService.getUserPreferences();
        setTheme(preferences.theme || 'auto');
      } catch (error) {
        console.error('Failed to load theme preference:', error);
      }
    };

    // Detect system theme
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemTheme(mediaQuery.matches ? 'dark' : 'light');

    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    loadTheme();

    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, []);

  const toggleTheme = async () => {
    const newTheme: Theme = theme === 'light' ? 'dark' : theme === 'dark' ? 'auto' : 'light';
    setTheme(newTheme);
    
    try {
      await storageService.setUserPreferences({ theme: newTheme });
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  };

  const setThemePreference = async (newTheme: Theme) => {
    setTheme(newTheme);
    
    try {
      await storageService.setUserPreferences({ theme: newTheme });
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  };

  // Determine the actual theme to use
  const effectiveTheme = theme === 'auto' ? systemTheme : theme;

  return {
    theme: effectiveTheme,
    themePreference: theme,
    systemTheme,
    toggleTheme,
    setTheme: setThemePreference
  };
};