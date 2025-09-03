import React, { useState } from 'react';

interface AutomationModeToggleProps {
  mode: 'visual' | 'background';
  onChange: (mode: 'visual' | 'background') => void;
}

export const AutomationModeToggle: React.FC<AutomationModeToggleProps> = ({ 
  mode, 
  onChange 
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleToggle = () => {
    onChange(mode === 'visual' ? 'background' : 'visual');
  };

  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="flex items-center space-x-2 px-3 py-2 rounded-xl bg-white/20 backdrop-blur-sm border border-white/20 hover:bg-white/30 transition-all duration-200 text-white text-sm font-medium"
        title={`Switch to ${mode === 'visual' ? 'background' : 'visual'} mode`}
      >
        {/* Mode icon */}
        <div className="relative">
          {mode === 'visual' ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          )}
        </div>

        {/* Mode text */}
        <span className="capitalize">
          {mode}
        </span>

        {/* Mode indicator */}
        <div className={`
          w-2 h-2 rounded-full transition-colors duration-200
          ${mode === 'visual' ? 'bg-blue-300' : 'bg-purple-300'}
        `} />
      </button>

      {/* Enhanced tooltip */}
      {isHovered && (
        <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 z-50 animate-scale-in">
          <div className="bg-surface-900/95 backdrop-blur-sm text-white px-4 py-2 rounded-xl text-xs font-medium shadow-xl border border-white/10 whitespace-nowrap">
            <div className="flex flex-col items-center space-y-1">
              <span className="font-semibold">
                {mode === 'visual' ? 'Visual Mode' : 'Background Mode'}
              </span>
              <span className="text-white/70">
                {mode === 'visual' 
                  ? 'On-screen automation with progress' 
                  : 'Fast, invisible file operations'
                }
              </span>
            </div>
            <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-surface-900/95 rotate-45" />
          </div>
        </div>
      )}
    </div>
  );
};