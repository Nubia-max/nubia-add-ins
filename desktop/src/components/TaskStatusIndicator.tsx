import React from 'react';
import { ProgressBar } from './ProgressBar';

interface TaskStatusIndicatorProps {
  taskId?: string;
  taskName?: string;
  status: 'idle' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  estimatedTime?: number;
  elapsedTime?: number;
  mode: 'visual' | 'background';
  theme: 'light' | 'dark';
  onCancel?: () => void;
}

const statusConfig = {
  idle: {
    icon: '⏸️',
    color: 'text-surface-500',
    bgColor: 'bg-surface-100',
    label: 'Ready'
  },
  queued: {
    icon: '⏳',
    color: 'text-warning-600',
    bgColor: 'bg-warning-50',
    label: 'Queued'
  },
  running: {
    icon: '🚀',
    color: 'text-primary-600',
    bgColor: 'bg-primary-50',
    label: 'Running'
  },
  completed: {
    icon: '✅',
    color: 'text-success-600',
    bgColor: 'bg-success-50',
    label: 'Completed'
  },
  failed: {
    icon: '❌',
    color: 'text-error-600',
    bgColor: 'bg-error-50',
    label: 'Failed'
  },
  cancelled: {
    icon: '🛑',
    color: 'text-surface-600',
    bgColor: 'bg-surface-100',
    label: 'Cancelled'
  }
};

export const TaskStatusIndicator: React.FC<TaskStatusIndicatorProps> = ({
  taskId,
  taskName,
  status,
  progress = 0,
  estimatedTime,
  elapsedTime,
  mode,
  theme,
  onCancel
}) => {
  const config = statusConfig[status];
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (status === 'idle') {
    return null;
  }

  return (
    <div className={`
      p-4 rounded-xl border transition-all duration-200
      ${theme === 'dark' 
        ? 'bg-surface-800/50 border-surface-700 backdrop-blur-sm' 
        : 'bg-white/50 border-surface-200 backdrop-blur-sm'
      }
    `}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className={`
            w-10 h-10 rounded-lg flex items-center justify-center text-lg
            ${theme === 'dark' ? 'bg-surface-700' : config.bgColor}
          `}>
            {config.icon}
          </div>
          
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <h3 className={`font-semibold text-sm ${
                theme === 'dark' ? 'text-white' : 'text-surface-900'
              }`}>
                {taskName || 'Excel Automation Task'}
              </h3>
              
              <span className={`
                px-2 py-1 rounded-full text-xs font-medium
                ${theme === 'dark' ? 'bg-surface-700 text-surface-300' : 'bg-surface-100 text-surface-600'}
              `}>
                {mode === 'visual' ? '👁️ Visual' : '⚡ Background'}
              </span>
            </div>
            
            <p className={`text-xs mt-1 ${
              theme === 'dark' ? 'text-surface-400' : config.color
            }`}>
              {config.label}
              {taskId && ` • ID: ${taskId.slice(0, 8)}`}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center space-x-2">
          {status === 'running' && onCancel && (
            <button
              onClick={onCancel}
              className={`
                p-2 rounded-lg transition-colors duration-200
                ${theme === 'dark' 
                  ? 'hover:bg-surface-700 text-surface-400 hover:text-error-400' 
                  : 'hover:bg-surface-100 text-surface-500 hover:text-error-500'
                }
              `}
              title="Cancel task"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Progress bar for running tasks */}
      {status === 'running' && (
        <div className="space-y-2">
          <ProgressBar
            progress={progress}
            variant="default"
            size="sm"
            animated={true}
            showPercentage={true}
            theme={theme}
          />
          
          {/* Time information */}
          <div className="flex items-center justify-between text-xs">
            <div className={`flex items-center space-x-4 ${
              theme === 'dark' ? 'text-surface-400' : 'text-surface-500'
            }`}>
              {elapsedTime !== undefined && (
                <span>⏱️ {formatTime(elapsedTime)}</span>
              )}
              {estimatedTime !== undefined && (
                <span>📅 ~{formatTime(estimatedTime)} total</span>
              )}
            </div>
            
            {mode === 'visual' && (
              <span className={`
                px-2 py-1 rounded-full text-xs
                ${theme === 'dark' ? 'bg-primary-900/50 text-primary-300' : 'bg-primary-50 text-primary-600'}
              `}>
                Watch your screen
              </span>
            )}
          </div>
        </div>
      )}

      {/* Completion details */}
      {status === 'completed' && elapsedTime && (
        <div className={`text-xs ${theme === 'dark' ? 'text-surface-400' : 'text-surface-500'}`}>
          Completed in {formatTime(elapsedTime)}
        </div>
      )}

      {/* Error details */}
      {status === 'failed' && (
        <div className={`
          mt-2 p-2 rounded-lg text-xs
          ${theme === 'dark' 
            ? 'bg-error-900/20 text-error-300 border border-error-800' 
            : 'bg-error-50 text-error-600 border border-error-200'
          }
        `}>
          Task failed. Please try again or check your Excel setup.
        </div>
      )}
    </div>
  );
};