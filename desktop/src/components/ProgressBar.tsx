import React, { useState, useEffect } from 'react';

interface ProgressBarProps {
  progress: number;
  label?: string;
  variant?: 'default' | 'success' | 'error' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  showPercentage?: boolean;
  theme?: 'light' | 'dark';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  label,
  variant = 'default',
  size = 'md',
  animated = false,
  showPercentage = true,
  theme = 'light'
}) => {
  const [displayProgress, setDisplayProgress] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDisplayProgress(Math.min(Math.max(progress, 0), 100));
    }, 100);

    return () => clearTimeout(timer);
  }, [progress]);

  const sizeClasses = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4'
  };

  const variantClasses = {
    default: 'bg-primary-500',
    success: 'bg-success-500',
    error: 'bg-error-500',
    warning: 'bg-warning-500'
  };

  const backgroundClass = theme === 'dark' ? 'bg-surface-700' : 'bg-surface-200';
  const textClass = theme === 'dark' ? 'text-surface-300' : 'text-surface-600';

  return (
    <div className="w-full">
      {(label || showPercentage) && (
        <div className="flex items-center justify-between mb-2">
          {label && (
            <span className={`text-sm font-medium ${textClass}`}>
              {label}
            </span>
          )}
          {showPercentage && (
            <span className={`text-sm font-medium ${textClass}`}>
              {Math.round(displayProgress)}%
            </span>
          )}
        </div>
      )}
      
      <div className={`
        relative w-full ${sizeClasses[size]} ${backgroundClass} rounded-full overflow-hidden
        ${animated ? 'animate-pulse' : ''}
      `}>
        <div
          className={`
            h-full ${variantClasses[variant]} rounded-full transition-all duration-500 ease-out
            ${animated ? 'animate-shimmer' : ''}
          `}
          style={{ width: `${displayProgress}%` }}
        />
        
        {/* Shimmer effect */}
        {animated && displayProgress > 0 && displayProgress < 100 && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        )}
        
        {/* Completion effect */}
        {displayProgress === 100 && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
        )}
      </div>
    </div>
  );
};