import React, { useState, useEffect } from 'react';

interface FloatingBubbleProps {
  onClick: () => void;
  hasNewMessages?: boolean;
  isConnected?: boolean;
}

const NubiaLogo: React.FC<{ className?: string }> = ({ className = "w-8 h-8" }) => (
  <svg 
    className={className}
    viewBox="0 0 32 32" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
        <stop offset="100%" stopColor="rgba(255,255,255,0.6)" />
      </linearGradient>
    </defs>
    {/* Stylized N for Nubia */}
    <path 
      d="M8 6h3l8 12V6h3v20h-3l-8-12v12H8V6z" 
      fill="url(#logoGradient)"
    />
    {/* Accent dot */}
    <circle 
      cx="25" 
      cy="9" 
      r="2" 
      fill="rgba(255,255,255,0.8)"
    />
  </svg>
);

export const FloatingBubble: React.FC<FloatingBubbleProps> = ({ 
  onClick, 
  hasNewMessages = false,
  isConnected = true 
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    if (isHovered) {
      const timer = setTimeout(() => setShowTooltip(true), 500);
      return () => clearTimeout(timer);
    } else {
      setShowTooltip(false);
    }
  }, [isHovered]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('FloatingBubble clicked!'); // Debug log
    onClick();
  };

  return (
    <div 
      className="floating-bubble w-full h-full flex items-center justify-center group relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ 
        position: 'fixed',
        top: 0,
        right: 0,
        zIndex: 999999,
        WebkitAppRegion: 'no-drag',
        pointerEvents: 'auto',
        cursor: 'pointer'
      } as any}
    >
      {/* Debug test button - remove after confirming clicks work */}
      <button 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          zIndex: 999999,
          padding: '20px',
          background: 'red',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          pointerEvents: 'auto',
          WebkitAppRegion: 'no-drag'
        } as any}
        onClick={() => {
          console.log('Test button clicked!');
          alert('Click works!');
        }}
      >
        TEST CLICK ME
      </button>

      {/* Main bubble container */}
      <div className="relative">
        {/* Outer glow ring */}
        <div className={`absolute inset-0 rounded-full transition-all duration-500 ${
          isHovered 
            ? 'bg-gradient-nubia animate-pulse-glow' 
            : 'bg-gradient-nubia animate-pulse-soft'
        } shadow-glow`} />
        
        {/* Glass morphism overlay */}
        <div className="absolute inset-1 bg-gradient-glass rounded-full backdrop-blur-sm border border-white/20" />
        
        {/* Main bubble */}
        <div 
          className={`
            relative w-20 h-20 bg-gradient-nubia rounded-full shadow-glass
            flex items-center justify-center transition-all duration-300 cursor-pointer
            ${isHovered ? 'scale-110 shadow-glow' : 'scale-100 animate-float'}
            ${!isConnected ? 'grayscale opacity-70' : ''}
            backdrop-blur-sm
          `}
          onClick={handleClick}
          onMouseDown={(e) => e.stopPropagation()}
          style={{ 
            WebkitAppRegion: 'no-drag',
            pointerEvents: 'auto',
            zIndex: 9999
          } as any}
        >
          {/* Inner glass highlight */}
          <div className="absolute inset-2 rounded-full bg-white/10 shadow-inner-glass" />
          
          {/* Logo */}
          <div className="relative z-10">
            <NubiaLogo className="w-10 h-10 drop-shadow-sm" />
          </div>
          
          {/* Connection status indicator */}
          <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full transition-all duration-300 ${
            isConnected 
              ? 'bg-success-500 shadow-lg animate-pulse-soft' 
              : 'bg-error-500 animate-bounce-soft'
          }`} />
        </div>
        
        {/* Notification badge */}
        {hasNewMessages && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-error-500 to-error-600 rounded-full flex items-center justify-center shadow-lg animate-notification-badge">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          </div>
        )}
        
        {/* Shimmer effect on hover */}
        {isHovered && (
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer -translate-x-full" />
          </div>
        )}
      </div>
      
      {/* Enhanced tooltip */}
      {showTooltip && (
        <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 z-50 animate-scale-in">
          <div className="bg-surface-900/95 backdrop-blur-sm text-white px-4 py-2 rounded-xl text-sm font-medium shadow-xl border border-white/10">
            {isConnected ? 'Click to open Nubia AI' : 'Reconnecting...'}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-2 h-2 bg-surface-900/95 rotate-45 -translate-y-1" />
          </div>
        </div>
      )}
      
      {/* Ambient particle effect */}
      {isHovered && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white/40 rounded-full animate-float"
              style={{
                left: `${20 + i * 12}%`,
                top: `${30 + (i % 2) * 40}%`,
                animationDelay: `${i * 0.3}s`,
                animationDuration: '3s'
              }}
            />
          ))}
        </div>
      )}
      
      {/* Status text for accessibility */}
      <span className="sr-only">
        Nubia AI Assistant - {isConnected ? 'Connected' : 'Disconnected'}
        {hasNewMessages ? ' - New messages available' : ''}
      </span>
    </div>
  );
};