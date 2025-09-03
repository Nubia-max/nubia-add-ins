import React, { useState, useEffect } from 'react';
import { AutomationProgress, automationService } from '../services/automation';
import { ExcelTask } from '../services/excelParser';

interface AutomationStatusProps {
  theme?: 'light' | 'dark';
  onModeSwitch?: (newMode: 'visual' | 'background') => void;
  onAbort?: (taskId: string) => void;
}

interface ActiveTask {
  id: string;
  task: ExcelTask;
  progress: AutomationProgress;
  startTime: Date;
}

export const AutomationStatus: React.FC<AutomationStatusProps> = ({ 
  theme = 'dark', 
  onModeSwitch,
  onAbort 
}) => {
  const [activeTasks, setActiveTasks] = useState<ActiveTask[]>([]);
  const [serviceInfo, setServiceInfo] = useState(automationService.getServiceInfo());
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    // Check service status periodically
    const statusInterval = setInterval(() => {
      setServiceInfo(automationService.getServiceInfo());
    }, 5000);

    return () => clearInterval(statusInterval);
  }, []);

  const addTask = (task: ExcelTask) => {
    const newTask: ActiveTask = {
      id: task.id,
      task,
      progress: {
        taskId: task.id,
        status: 'pending',
        progress: 0
      },
      startTime: new Date()
    };

    setActiveTasks(prev => [...prev, newTask]);

    // Execute task with progress callback
    automationService.executeTask(task, (progress) => {
      updateTaskProgress(task.id, progress);
      addLog(`[${task.id.slice(-8)}] ${automationService.formatProgressMessage(progress)}`);
    });
  };

  const updateTaskProgress = (taskId: string, progress: AutomationProgress) => {
    setActiveTasks(prev => 
      prev.map(task => 
        task.id === taskId 
          ? { ...task, progress }
          : task
      )
    );

    // Remove completed tasks after delay
    if (progress.status === 'completed' || progress.status === 'failed' || progress.status === 'aborted') {
      setTimeout(() => {
        setActiveTasks(prev => prev.filter(task => task.id !== taskId));
      }, 3000);
    }
  };

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 99)]); // Keep last 100 logs
  };

  const handleAbortTask = async (taskId: string) => {
    const success = await automationService.abortTask(taskId);
    if (success) {
      addLog(`[${taskId.slice(-8)}] Task aborted by user`);
      if (onAbort) {
        onAbort(taskId);
      }
    }
  };

  const handleModeSwitch = async (taskId: string, newMode: 'visual' | 'background') => {
    const success = await automationService.switchTaskMode(taskId, newMode);
    if (success) {
      addLog(`[${taskId.slice(-8)}] Switched to ${newMode} mode`);
      if (onModeSwitch) {
        onModeSwitch(newMode);
      }
    }
  };

  const getEstimatedTimeRemaining = (task: ActiveTask): number => {
    if (!task.task.metadata.estimatedDuration) return 0;
    return automationService.estimateTimeRemaining(
      task.progress.progress, 
      task.task.metadata.estimatedDuration
    );
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed': return 'text-green-500';
      case 'failed': return 'text-red-500';
      case 'aborted': return 'text-yellow-500';
      case 'in_progress': return 'text-blue-500';
      default: return theme === 'dark' ? 'text-gray-400' : 'text-gray-600';
    }
  };

  const getModeIcon = (mode: string) => {
    if (mode === 'visual') {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      );
    } else {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      );
    }
  };

  // Note: If you need to expose methods externally, use forwardRef

  if (activeTasks.length === 0 && !serviceInfo.available) {
    return null; // Hide when no tasks and service unavailable
  }

  return (
    <div className={`
      automation-status border rounded-lg p-4 mb-4
      ${theme === 'dark' 
        ? 'bg-surface-800/50 border-surface-700' 
        : 'bg-surface-50 border-surface-200'
      }
    `}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${serviceInfo.available ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
              Automation Service
            </span>
          </div>
          
          {serviceInfo.available && (
            <div className="flex items-center space-x-1 text-xs">
              <span className={theme === 'dark' ? 'text-surface-400' : 'text-surface-600'}>
                Mode: {automationService.getDefaultMode()}
              </span>
              {getModeIcon(automationService.getDefaultMode())}
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowLogs(!showLogs)}
            className={`
              text-xs px-2 py-1 rounded transition-colors duration-200
              ${theme === 'dark' 
                ? 'bg-surface-700 hover:bg-surface-600 text-surface-300' 
                : 'bg-surface-200 hover:bg-surface-300 text-surface-700'
              }
            `}
          >
            {showLogs ? 'Hide Logs' : 'Show Logs'}
          </button>
        </div>
      </div>

      {/* Service Status Warning */}
      {!serviceInfo.available && (
        <div className={`
          mb-3 p-3 rounded border-l-4 border-yellow-500
          ${theme === 'dark' ? 'bg-yellow-500/10' : 'bg-yellow-50'}
        `}>
          <div className="flex items-center">
            <svg className="w-4 h-4 text-yellow-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div>
              <p className={`text-sm font-medium ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-800'}`}>
                Automation service offline
              </p>
              <p className={`text-xs ${theme === 'dark' ? 'text-yellow-300' : 'text-yellow-700'}`}>
                Tasks will run in demo mode. Start the Python service for full automation.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Active Tasks */}
      {activeTasks.length > 0 && (
        <div className="space-y-3">
          {activeTasks.map((task) => (
            <div 
              key={task.id}
              className={`
                border rounded-lg p-3
                ${theme === 'dark' 
                  ? 'bg-surface-900/50 border-surface-600' 
                  : 'bg-white border-surface-300'
                }
              `}
            >
              {/* Task Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1">
                    {getModeIcon(task.task.mode)}
                    <span className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
                      {task.task.type.replace('_', ' ')}
                    </span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${getStatusColor(task.progress.status)}`}>
                    {task.progress.status}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  {/* Time remaining */}
                  {task.progress.status === 'in_progress' && (
                    <span className={`text-xs ${theme === 'dark' ? 'text-surface-400' : 'text-surface-600'}`}>
                      ~{formatTime(getEstimatedTimeRemaining(task))} left
                    </span>
                  )}

                  {/* Mode switch button */}
                  {task.progress.status === 'in_progress' && (
                    <button
                      onClick={() => handleModeSwitch(
                        task.id, 
                        task.task.mode === 'visual' ? 'background' : 'visual'
                      )}
                      className={`
                        text-xs px-2 py-1 rounded transition-colors duration-200
                        ${theme === 'dark' 
                          ? 'bg-surface-700 hover:bg-surface-600 text-surface-300' 
                          : 'bg-surface-200 hover:bg-surface-300 text-surface-700'
                        }
                      `}
                      title={`Switch to ${task.task.mode === 'visual' ? 'background' : 'visual'} mode`}
                    >
                      Switch Mode
                    </button>
                  )}

                  {/* Abort button */}
                  {(task.progress.status === 'in_progress' || task.progress.status === 'pending') && (
                    <button
                      onClick={() => handleAbortTask(task.id)}
                      className="text-xs px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded transition-colors duration-200"
                    >
                      Abort
                    </button>
                  )}
                </div>
              </div>

              {/* Task Description */}
              <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-surface-300' : 'text-surface-700'}`}>
                {task.task.description}
              </p>

              {/* Progress Bar */}
              <div className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs ${theme === 'dark' ? 'text-surface-400' : 'text-surface-600'}`}>
                    {task.progress.currentStep || 'Preparing...'}
                  </span>
                  <span className={`text-xs ${theme === 'dark' ? 'text-surface-400' : 'text-surface-600'}`}>
                    {task.progress.progress}%
                  </span>
                </div>
                <div className={`
                  w-full bg-surface-200 rounded-full h-2
                  ${theme === 'dark' ? 'bg-surface-700' : 'bg-surface-200'}
                `}>
                  <div 
                    className={`
                      h-2 rounded-full transition-all duration-300
                      ${task.progress.status === 'completed' 
                        ? 'bg-green-500' 
                        : task.progress.status === 'failed' 
                        ? 'bg-red-500'
                        : 'bg-blue-500'
                      }
                    `}
                    style={{ width: `${task.progress.progress}%` }}
                  />
                </div>
              </div>

              {/* Error Message */}
              {task.progress.error && (
                <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs">
                  {task.progress.error}
                </div>
              )}

              {/* Task Steps Count */}
              <div className="flex items-center justify-between text-xs">
                <span className={theme === 'dark' ? 'text-surface-500' : 'text-surface-500'}>
                  {task.task.steps.length} steps • {task.task.complexity} • {task.task.mode} mode
                </span>
                <span className={theme === 'dark' ? 'text-surface-500' : 'text-surface-500'}>
                  Started {new Date(task.startTime).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Logs Panel */}
      {showLogs && (
        <div className={`
          mt-4 border rounded-lg p-3
          ${theme === 'dark' 
            ? 'bg-surface-900/30 border-surface-600' 
            : 'bg-surface-100 border-surface-300'
          }
        `}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
              Automation Logs
            </span>
            <button
              onClick={() => setLogs([])}
              className={`
                text-xs px-2 py-1 rounded transition-colors duration-200
                ${theme === 'dark' 
                  ? 'bg-surface-700 hover:bg-surface-600 text-surface-300' 
                  : 'bg-surface-200 hover:bg-surface-300 text-surface-700'
                }
              `}
            >
              Clear
            </button>
          </div>
          
          <div className={`
            max-h-32 overflow-y-auto text-xs space-y-1 font-mono
            ${theme === 'dark' ? 'text-surface-400' : 'text-surface-600'}
          `}>
            {logs.length === 0 ? (
              <p className="italic">No logs yet...</p>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="whitespace-pre-wrap">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AutomationStatus;