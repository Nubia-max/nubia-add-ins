import React, { useState, useEffect, useRef } from 'react';
import './BubbleView.css';

interface BubbleViewProps {
  user?: any;
  subscription?: any;
  canUseAutomation?: boolean;
  usageStatus?: any;
  onShowSubscription?: () => void;
  onShowAuth?: () => void;
}

const BubbleView: React.FC<BubbleViewProps> = ({
  user,
  subscription,
  canUseAutomation,
  usageStatus,
  onShowSubscription,
  onShowAuth
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [ripple, setRipple] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);
  
  const handleClick = async (e: React.MouseEvent) => {
    console.log('🔴 BUBBLE CLICKED - Opening chat...');
    e.preventDefault();
    e.stopPropagation();
    
    setRipple(true);
    setTimeout(() => setRipple(false), 600);
    
    if (window.electronAPI) {
      console.log('📞 Calling electronAPI.toggleChat()...');
      await window.electronAPI.toggleChat();
    } else {
      console.log('⚠️ No electronAPI found, opening fallback URL...');
      window.location.href = 'http://localhost:3000/chat';
    }
  };
  
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      e.preventDefault();
    }
  };
  
  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
    }
  };
  
  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging && dragRef.current) {
      const element = dragRef.current;
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      if (Math.abs(e.clientX - centerX) > 5 || Math.abs(e.clientY - centerY) > 5) {
        setIsDragging(false);
      }
    }
  };
  
  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isDragging]);
  
  useEffect(() => {
    const handleSettingsOpen = () => {
      console.log('Opening settings...');
    };
    
    if (window.electronAPI) {
      const unsubscribe = window.electronAPI.onOpenSettings(handleSettingsOpen);
      return unsubscribe;
    }
  }, []);
  
  return (
    <div className="bubble-container">
      <div
        ref={dragRef}
        className={`bubble ${isHovered ? 'hovered' : ''} ${isDragging ? 'dragging' : ''} ${ripple ? 'ripple' : ''}`}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ 
          WebkitAppRegion: 'no-drag',
          zIndex: 9999
        } as React.CSSProperties}
      >
        <div className="bubble-gradient">
          <div className="bubble-icon">
            <svg
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M16 2L4 8V16C4 23.5 8.5 26.74 16 28C23.5 26.74 28 23.5 28 16V8L16 2Z"
                fill="url(#gradient)"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M16 10V16L20 20"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#9333ea" />
                  <stop offset="100%" stopColor="#c084fc" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="bubble-pulse"></div>
        </div>
      </div>
      {isHovered && (
        <div className="bubble-tooltip">
          Click to open Nubia
        </div>
      )}
    </div>
  );
};

export default BubbleView;