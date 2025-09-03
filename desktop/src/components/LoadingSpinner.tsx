import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'primary' | 'secondary' | 'accent' | 'white';
  className?: string;
  text?: string;
  fullScreen?: boolean;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12'
};

const colorClasses = {
  primary: 'border-blue-500',
  secondary: 'border-surface-500',
  accent: 'border-green-500',
  white: 'border-white'
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'primary',
  className = '',
  text,
  fullScreen = false
}) => {
  const spinner = (
    <div className="flex items-center justify-center space-x-3">
      <div
        className={`${sizeClasses[size]} ${colorClasses[color]} border-2 border-t-transparent rounded-full animate-spin ${className}`}
      />
      {text && (
        <span className="text-sm font-medium text-surface-600 dark:text-surface-300">
          {text}
        </span>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white dark:bg-surface-900 bg-opacity-80 dark:bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-50">
        {spinner}
      </div>
    );
  }

  return spinner;
};

export const LoadingSkeleton: React.FC<{
  lines?: number;
  className?: string;
  height?: string;
}> = ({ lines = 3, className = '', height = 'h-4' }) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className={`${height} bg-surface-200 dark:bg-surface-700 rounded animate-pulse ${
            i === lines - 1 ? 'w-3/4' : 'w-full'
          }`}
        />
      ))}
    </div>
  );
};

export const LoadingCard: React.FC<{
  className?: string;
}> = ({ className = '' }) => {
  return (
    <div className={`p-4 border border-surface-200 dark:border-surface-700 rounded-lg animate-pulse ${className}`}>
      <div className="flex items-center space-x-4">
        <div className="w-12 h-12 bg-surface-200 dark:bg-surface-700 rounded-full"></div>
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-surface-200 dark:bg-surface-700 rounded w-3/4"></div>
          <div className="h-3 bg-surface-200 dark:bg-surface-700 rounded w-1/2"></div>
        </div>
      </div>
    </div>
  );
};

export const LoadingTable: React.FC<{
  rows?: number;
  columns?: number;
  className?: string;
}> = ({ rows = 5, columns = 4, className = '' }) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div key={rowIndex} className="flex space-x-4">
          {Array.from({ length: columns }, (_, colIndex) => (
            <div
              key={colIndex}
              className="flex-1 h-10 bg-surface-200 dark:bg-surface-700 rounded animate-pulse"
            />
          ))}
        </div>
      ))}
    </div>
  );
};