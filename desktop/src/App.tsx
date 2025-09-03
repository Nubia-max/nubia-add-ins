import React, { useState, useEffect } from 'react';
import { FloatingBubble } from './components/FloatingBubble';
import { ChatInterface } from './components/ChatInterface';
import { OnboardingFlow } from './components/OnboardingFlow';
import { AuthScreen } from './components/AuthScreen';
import { SocketProvider } from './contexts/SocketContext';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/AuthContext';
import { useTheme } from './hooks/useTheme';

const { ipcRenderer } = window.require('electron');

const AppContent: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  
  const { isAuthenticated, isLoading: authLoading, user, bypassAuth } = useAuth();
  const { theme } = useTheme();
  // TODO: Implement useUserPreferences hook later
  const isFirstTime = false;
  const isConnected = true; // LLM service connection

  useEffect(() => {
    console.log('App initialized');
    // Get initial expanded state from Electron
    ipcRenderer.invoke('get-expanded-state').then((state: boolean) => {
      console.log('Initial expanded state:', state);
      setIsExpanded(state);
    });
    
    // Set up keyboard shortcuts
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+Space or Cmd+Space to toggle
      if ((event.ctrlKey || event.metaKey) && event.code === 'Space') {
        event.preventDefault();
        handleToggleExpand();
      }
      
      // Escape to minimize
      if (event.key === 'Escape' && isExpanded) {
        event.preventDefault();
        handleMinimize();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExpanded]);

  // Show onboarding for first-time users
  useEffect(() => {
    if (isAuthenticated && !authLoading && isFirstTime) {
      // Small delay to ensure the app has rendered
      const timer = setTimeout(() => {
        setIsOnboardingOpen(true);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, isFirstTime, authLoading]);

  // Listen for new messages when minimized
  useEffect(() => {
    if (!isExpanded) {
      // Mock new message detection (in real app, this would come from socket)
      const timer = setTimeout(() => {
        if (Math.random() > 0.7) { // 30% chance of showing new message indicator
          setHasNewMessages(true);
        }
      }, 10000); // Show after 10 seconds

      return () => clearTimeout(timer);
    } else {
      setHasNewMessages(false);
    }
  }, [isExpanded]);

  const handleToggleExpand = async () => {
    console.log('handleToggleExpand called');
    const newExpandedState = await ipcRenderer.invoke('toggle-expand');
    console.log('New expanded state:', newExpandedState);
    setIsExpanded(newExpandedState);
    
    if (newExpandedState) {
      setHasNewMessages(false);
    }
  };

  const handleMinimize = async () => {
    const newExpandedState = await ipcRenderer.invoke('minimize-to-corner');
    setIsExpanded(newExpandedState);
  };

  const handleOnboardingComplete = () => {
    // TODO: Implement completeOnboarding();
    setIsOnboardingOpen(false);
  };

  const handleOnboardingSkip = () => {
    // TODO: Implement completeOnboarding();
    setIsOnboardingOpen(false);
  };

  const handleAuthSuccess = (token: string, userData: any) => {
    console.log('Auth success:', { token, userData });
  };

  // Show different states based on authentication
  if (authLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gradient-nubia">
        <div className="text-center text-white">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse-glow">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold mb-2">Welcome to Nubia</h1>
          <p className="text-white/80 text-sm">Initializing...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <AuthScreen
        onAuthSuccess={handleAuthSuccess}
        onBypassAuth={bypassAuth}
      />
    );
  }

  return (
    <div className={`w-full h-screen relative ${theme === 'dark' ? 'dark' : ''}`}>
      {isExpanded ? (
        <ChatInterface onMinimize={handleMinimize} />
      ) : (
        <FloatingBubble 
          onClick={handleToggleExpand}
          hasNewMessages={hasNewMessages}
          isConnected={isConnected}
        />
      )}
      
      {/* Onboarding Flow */}
      <OnboardingFlow
        isOpen={isOnboardingOpen}
        onComplete={handleOnboardingComplete}
        onSkip={handleOnboardingSkip}
        theme={theme}
      />
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <AppContent />
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;