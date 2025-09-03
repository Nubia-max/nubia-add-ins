import React, { useState, useEffect } from 'react';
import { ErrorInfo, RecoveryAction, errorHandler } from '../services/errorHandler';

interface ErrorPanelProps {
  theme?: 'light' | 'dark';
  onErrorResolved?: (errorId: string) => void;
  compact?: boolean;
}

export const ErrorPanel: React.FC<ErrorPanelProps> = ({
  theme = 'dark',
  onErrorResolved,
  compact = false
}) => {
  const [errors, setErrors] = useState<ErrorInfo[]>([]);
  const [showResolved, setShowResolved] = useState(false);
  const [selectedError, setSelectedError] = useState<string | null>(null);
  const [stats, setStats] = useState(errorHandler.getErrorStats());
  const [executingRecovery, setExecutingRecovery] = useState<string | null>(null);

  useEffect(() => {
    // Load initial errors
    refreshErrors();

    // Listen for new errors
    const handleNewError = (error: ErrorInfo) => {
      refreshErrors();
    };

    errorHandler.addErrorListener(handleNewError);

    // Refresh periodically
    const interval = setInterval(refreshErrors, 5000);

    return () => {
      errorHandler.removeErrorListener(handleNewError);
      clearInterval(interval);
    };
  }, [showResolved]);

  const refreshErrors = () => {
    const allErrors = errorHandler.getErrors();
    setErrors(showResolved ? allErrors : allErrors.filter(e => !e.resolved));
    setStats(errorHandler.getErrorStats());
  };

  const handleRecoveryAction = async (errorId: string, actionId: string) => {
    setExecutingRecovery(`${errorId}_${actionId}`);
    
    try {
      const success = await errorHandler.executeRecoveryAction(errorId, actionId);
      
      if (success) {
        refreshErrors();
        if (onErrorResolved) {
          onErrorResolved(errorId);
        }
      }
    } catch (error) {
      console.error('Recovery action failed:', error);
    } finally {
      setExecutingRecovery(null);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-500 bg-red-500/10 border-red-500/30';
      case 'high': return 'text-orange-500 bg-orange-500/10 border-orange-500/30';
      case 'medium': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
      case 'low': return 'text-blue-500 bg-blue-500/10 border-blue-500/30';
      default: return 'text-gray-500 bg-gray-500/10 border-gray-500/30';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'service': return '⚙️';
      case 'task': return '📋';
      case 'network': return '🌐';
      case 'parsing': return '📝';
      case 'validation': return '✅';
      case 'system': return '💻';
      default: return '❗';
    }
  };

  const formatTimestamp = (timestamp: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return timestamp.toLocaleDateString();
  };

  if (compact && errors.length === 0) {
    return null;
  }

  if (compact) {
    // Compact view for header/status bar
    const unresolvedCount = stats.unresolved;
    const criticalCount = errors.filter(e => !e.resolved && e.severity === 'critical').length;
    
    return (
      <div className={`flex items-center space-x-2 text-sm ${
        criticalCount > 0 
          ? 'text-red-500' 
          : unresolvedCount > 0 
          ? 'text-yellow-500' 
          : 'text-green-500'
      }`}>
        <div className={`w-2 h-2 rounded-full ${
          criticalCount > 0 
            ? 'bg-red-500 animate-pulse' 
            : unresolvedCount > 0 
            ? 'bg-yellow-500' 
            : 'bg-green-500'
        }`} />
        <span>
          {unresolvedCount > 0 
            ? `${unresolvedCount} issue${unresolvedCount !== 1 ? 's' : ''}` 
            : 'All systems operational'
          }
        </span>
      </div>
    );
  }

  return (
    <div className={`error-panel p-4 space-y-4 ${
      theme === 'dark' ? 'text-white' : 'text-surface-900'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`font-semibold text-lg ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
            Error Management
          </h3>
          <div className={`text-sm ${theme === 'dark' ? 'text-surface-400' : 'text-surface-600'}`}>
            {stats.unresolved} active issues • {stats.resolved} resolved
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowResolved(!showResolved)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              theme === 'dark'
                ? 'bg-surface-800 border-surface-700 text-surface-300 hover:bg-surface-700'
                : 'bg-white border-surface-300 text-surface-700 hover:bg-surface-50'
            }`}
          >
            {showResolved ? 'Hide Resolved' : 'Show All'}
          </button>
          
          <button
            onClick={() => errorHandler.clearResolvedErrors()}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              theme === 'dark'
                ? 'bg-surface-800 border-surface-700 text-surface-300 hover:bg-surface-700'
                : 'bg-white border-surface-300 text-surface-700 hover:bg-surface-50'
            }`}
          >
            Clear Resolved
          </button>
        </div>
      </div>

      {/* Error Stats */}
      {stats.total > 0 && (
        <div className={`grid grid-cols-4 gap-4 p-4 rounded-lg border ${
          theme === 'dark' 
            ? 'bg-surface-800 border-surface-700' 
            : 'bg-surface-50 border-surface-200'
        }`}>
          <div className="text-center">
            <div className={`text-2xl font-bold ${stats.bySeverity.critical ? 'text-red-500' : theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
              {stats.bySeverity.critical || 0}
            </div>
            <div className={`text-xs ${theme === 'dark' ? 'text-surface-400' : 'text-surface-600'}`}>
              Critical
            </div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${stats.bySeverity.high ? 'text-orange-500' : theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
              {stats.bySeverity.high || 0}
            </div>
            <div className={`text-xs ${theme === 'dark' ? 'text-surface-400' : 'text-surface-600'}`}>
              High
            </div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${stats.bySeverity.medium ? 'text-yellow-500' : theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
              {stats.bySeverity.medium || 0}
            </div>
            <div className={`text-xs ${theme === 'dark' ? 'text-surface-400' : 'text-surface-600'}`}>
              Medium
            </div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${stats.bySeverity.low ? 'text-blue-500' : theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
              {stats.bySeverity.low || 0}
            </div>
            <div className={`text-xs ${theme === 'dark' ? 'text-surface-400' : 'text-surface-600'}`}>
              Low
            </div>
          </div>
        </div>
      )}

      {/* Error List */}
      {errors.length === 0 ? (
        <div className={`
          text-center py-8 border-2 border-dashed rounded-lg
          ${theme === 'dark' ? 'border-surface-700 text-surface-500' : 'border-surface-300 text-surface-500'}
        `}>
          <div className="text-4xl mb-2">✅</div>
          <p className="text-sm">No errors to display</p>
          <p className="text-xs mt-1">
            {showResolved ? 'No errors found in the system' : 'All issues have been resolved'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {errors.map((error) => (
            <div
              key={error.id}
              className={`
                border rounded-lg p-4 transition-all duration-200
                ${error.resolved 
                  ? theme === 'dark' 
                    ? 'bg-surface-900/30 border-surface-700' 
                    : 'bg-surface-100 border-surface-300 opacity-60'
                  : theme === 'dark'
                    ? 'bg-surface-800 border-surface-700'
                    : 'bg-white border-surface-200'
                }
                ${selectedError === error.id ? 'ring-2 ring-primary-500' : ''}
              `}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  <div className="text-2xl">{getTypeIcon(error.type)}</div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className={`font-medium ${
                        error.resolved 
                          ? theme === 'dark' ? 'text-surface-400' : 'text-surface-600'
                          : theme === 'dark' ? 'text-white' : 'text-surface-900'
                      }`}>
                        {error.message}
                      </span>
                      
                      <span className={`text-xs px-2 py-1 rounded-full border ${getSeverityColor(error.severity)}`}>
                        {error.severity}
                      </span>
                      
                      {error.resolved && (
                        <span className="text-xs px-2 py-1 bg-green-500/10 text-green-500 rounded-full border border-green-500/30">
                          Resolved
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-4 text-xs mb-2">
                      <span className={theme === 'dark' ? 'text-surface-500' : 'text-surface-500'}>
                        {error.type.charAt(0).toUpperCase() + error.type.slice(1)}
                      </span>
                      <span className={theme === 'dark' ? 'text-surface-500' : 'text-surface-500'}>
                        {formatTimestamp(error.timestamp)}
                      </span>
                      {error.taskId && (
                        <span className={`font-mono ${theme === 'dark' ? 'text-surface-500' : 'text-surface-500'}`}>
                          Task: {error.taskId.slice(-8)}
                        </span>
                      )}
                      {error.retryCount > 0 && (
                        <span className={theme === 'dark' ? 'text-surface-500' : 'text-surface-500'}>
                          Retries: {error.retryCount}/{error.maxRetries}
                        </span>
                      )}
                    </div>

                    {error.details && (
                      <div className={`text-sm p-2 rounded mt-2 font-mono ${
                        theme === 'dark' ? 'bg-surface-900 text-surface-400' : 'bg-surface-100 text-surface-600'
                      }`}>
                        {error.details}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => setSelectedError(selectedError === error.id ? null : error.id)}
                    className={`text-xs px-2 py-1 rounded transition-colors ${
                      theme === 'dark'
                        ? 'bg-surface-700 text-surface-300 hover:bg-surface-600'
                        : 'bg-surface-200 text-surface-700 hover:bg-surface-300'
                    }`}
                  >
                    {selectedError === error.id ? 'Hide' : 'Details'}
                  </button>
                </div>
              </div>

              {/* Recovery Actions */}
              {selectedError === error.id && !error.resolved && (
                <div className={`mt-4 pt-4 border-t ${
                  theme === 'dark' ? 'border-surface-700' : 'border-surface-200'
                }`}>
                  <h5 className={`text-sm font-medium mb-3 ${
                    theme === 'dark' ? 'text-white' : 'text-surface-900'
                  }`}>
                    Recovery Actions
                  </h5>
                  
                  {(() => {
                    const actions = errorHandler.getRecoveryActions(error.type);
                    
                    if (actions.length === 0) {
                      return (
                        <div className={`text-sm ${theme === 'dark' ? 'text-surface-400' : 'text-surface-600'}`}>
                          No recovery actions available for this error type.
                        </div>
                      );
                    }
                    
                    return (
                      <div className="space-y-2">
                        {actions.map((action) => (
                          <div 
                            key={action.id}
                            className={`flex items-center justify-between p-3 rounded-lg border ${
                              theme === 'dark' 
                                ? 'bg-surface-900 border-surface-600' 
                                : 'bg-surface-50 border-surface-300'
                            }`}
                          >
                            <div className="flex-1">
                              <div className={`font-medium text-sm ${
                                theme === 'dark' ? 'text-white' : 'text-surface-900'
                              }`}>
                                {action.name}
                                {action.automatic && (
                                  <span className="ml-2 text-xs px-2 py-1 bg-blue-500/10 text-blue-500 rounded-full">
                                    Auto
                                  </span>
                                )}
                              </div>
                              <div className={`text-xs mt-1 ${
                                theme === 'dark' ? 'text-surface-400' : 'text-surface-600'
                              }`}>
                                {action.description}
                              </div>
                            </div>
                            
                            <button
                              onClick={() => handleRecoveryAction(error.id, action.id)}
                              disabled={executingRecovery === `${error.id}_${action.id}`}
                              className="ml-3 px-3 py-1.5 text-xs bg-primary-500 text-white rounded hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {executingRecovery === `${error.id}_${action.id}` ? 'Running...' : 'Execute'}
                            </button>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ErrorPanel;