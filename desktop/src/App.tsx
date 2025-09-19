import React, { useState, useEffect } from 'react';
import BubbleView from './components/BubbleView';
import ChatView from './components/ChatView';
import AuthModal from './components/AuthModal';
import SubscriptionPanel from './components/SubscriptionPanel';
import { useAuth } from './hooks/useAuth';
import './App.css';

declare global {
  interface Window {
    electronAPI?: {
      toggleChat: () => Promise<void>;
      closeChat: () => Promise<void>;
      minimizeToTray: () => Promise<void>;
      getWindowMode: () => Promise<string>;
      executeExcelAutomation: (taskData: any) => Promise<any>;
      onOpenSettings: (callback: () => void) => () => void;
      onAutomationProgress: (callback: (progress: any) => void) => () => void;
      onAutomationComplete: (callback: (result: any) => void) => () => void;
      sendMessage: (channel: string, data: any) => void;
      onMessage: (channel: string, callback: (...args: any[]) => void) => () => void;
    };
  }
}

function App() {
  const [mode, setMode] = useState<'bubble' | 'chat'>('bubble');
  const [isLoading, setIsLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSubscriptionPanel, setShowSubscriptionPanel] = useState(false);
  const {
    user,
    subscription,
    loading: authLoading,
    isAuthenticated,
    canUseAutomation,
    getUsageStatus,
    refreshSubscription
  } = useAuth();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const modeParam = urlParams.get('mode');
    
    if (modeParam === 'chat' || modeParam === 'bubble') {
      setMode(modeParam as 'bubble' | 'chat');
    } else if (window.electronAPI) {
      window.electronAPI.getWindowMode().then((windowMode) => {
        setMode(windowMode === 'chat' ? 'chat' : 'bubble');
      });
    }
    
    setIsLoading(false);
  }, []);

  // Show auth modal if not authenticated and auth loading is complete
  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated && !showAuthModal) {
        console.log('User not authenticated, showing auth modal');
        setShowAuthModal(true);
      } else if (isAuthenticated && showAuthModal) {
        console.log('User authenticated, hiding auth modal');
        setShowAuthModal(false);
      }
    }
  }, [authLoading, isAuthenticated, showAuthModal]);

  const handleAuthSuccess = (userData: any) => {
    console.log('Authentication successful:', userData);
    setShowAuthModal(false);
  };

  if (isLoading || authLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading Nubia...</p>
      </div>
    );
  }

  // Show different content based on authentication state
  const appContent = () => {
    if (mode === 'bubble') {
      return (
        <BubbleView 
          user={user}
          subscription={subscription}
          canUseAutomation={canUseAutomation()}
          usageStatus={getUsageStatus()}
          onShowSubscription={() => setShowSubscriptionPanel(true)}
          onShowAuth={() => setShowAuthModal(true)}
        />
      );
    } else {
      return (
        <ChatView
          user={user}
          subscription={subscription}
          canUseAutomation={canUseAutomation()}
          usageStatus={getUsageStatus()}
          onShowSubscription={() => setShowSubscriptionPanel(true)}
          onShowAuth={() => setShowAuthModal(true)}
          onRefreshSubscription={refreshSubscription}
        />
      );
    }
  };

  return (
    <>
      {appContent()}
      
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
      />
      
      <SubscriptionPanel
        isOpen={showSubscriptionPanel}
        onClose={() => setShowSubscriptionPanel(false)}
        currentSubscription={subscription}
      />
    </>
  );
}

export default App;