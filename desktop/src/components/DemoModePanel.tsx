import React, { useState, useEffect } from 'react';
import { demoModeService, DemoScenario, DemoState } from '../services/demoMode';
import { AutomationProgress } from '../services/automation';

interface DemoModePanelProps {
  theme?: 'light' | 'dark';
  onDemoStart?: (scenario: DemoScenario) => void;
  onDemoProgress?: (progress: AutomationProgress) => void;
  onDemoComplete?: () => void;
}

export const DemoModePanel: React.FC<DemoModePanelProps> = ({
  theme = 'dark',
  onDemoStart,
  onDemoProgress,
  onDemoComplete
}) => {
  const [scenarios, setScenarios] = useState<DemoScenario[]>([]);
  const [demoState, setDemoState] = useState<DemoState>(demoModeService.getDemoState());
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    // Load demo scenarios
    setScenarios(demoModeService.getScenarios());
    
    // Update state periodically
    const interval = setInterval(() => {
      setDemoState(demoModeService.getDemoState());
      setLogs(demoModeService.getLogs());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleStartDemo = async (scenarioId: string) => {
    const scenario = scenarios.find(s => s.id === scenarioId);
    if (!scenario) return;

    if (onDemoStart) {
      onDemoStart(scenario);
    }

    const success = await demoModeService.startDemo(scenarioId, (progress) => {
      if (onDemoProgress) {
        onDemoProgress(progress);
      }
      
      if (progress.status === 'completed' && onDemoComplete) {
        onDemoComplete();
      }
    });

    if (!success) {
      console.error('Failed to start demo');
    }
  };

  const handleQuickDemo = async (type: 'chart' | 'table' | 'formula' | 'pivot') => {
    await demoModeService.runQuickDemo(type, (progress) => {
      if (onDemoProgress) {
        onDemoProgress(progress);
      }
      
      if (progress.status === 'completed' && onDemoComplete) {
        onDemoComplete();
      }
    });
  };

  const handleStopDemo = () => {
    demoModeService.stopDemo();
  };

  const handleResetDemo = () => {
    demoModeService.resetDemo();
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'basic': return '🟢';
      case 'intermediate': return '🟡';
      case 'advanced': return '🔴';
      default: return '⚪';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'basic': return 'text-green-500 bg-green-500/10 border-green-500/30';
      case 'intermediate': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
      case 'advanced': return 'text-red-500 bg-red-500/10 border-red-500/30';
      default: return 'text-gray-500 bg-gray-500/10 border-gray-500/30';
    }
  };

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    return minutes > 0 ? `${minutes}m` : `${seconds}s`;
  };

  return (
    <div className={`demo-mode-panel p-4 space-y-4 ${
      theme === 'dark' ? 'text-white' : 'text-surface-900'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`font-semibold text-lg ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
            Demo Mode
          </h3>
          <div className={`text-sm ${theme === 'dark' ? 'text-surface-400' : 'text-surface-600'}`}>
            Experience Excel automation without requiring the Python service
          </div>
        </div>
        
        <div className={`px-3 py-1.5 text-xs rounded-lg border ${
          demoState.isActive 
            ? 'bg-blue-500/10 text-blue-500 border-blue-500/30' 
            : 'bg-gray-500/10 text-gray-500 border-gray-500/30'
        }`}>
          {demoState.isActive ? 'Running Demo' : 'Ready'}
        </div>
      </div>

      {/* Demo Status */}
      {demoState.isActive && demoState.scenario && (
        <div className={`p-4 rounded-lg border ${
          theme === 'dark' 
            ? 'bg-surface-800 border-surface-700' 
            : 'bg-surface-50 border-surface-200'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <h4 className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
              {demoState.scenario.name}
            </h4>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowLogs(!showLogs)}
                className={`text-xs px-2 py-1 rounded transition-colors ${
                  theme === 'dark'
                    ? 'bg-surface-700 text-surface-300 hover:bg-surface-600'
                    : 'bg-surface-200 text-surface-700 hover:bg-surface-300'
                }`}
              >
                {showLogs ? 'Hide' : 'Show'} Logs
              </button>
              <button
                onClick={handleStopDemo}
                className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
              >
                Stop
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className={theme === 'dark' ? 'text-surface-400' : 'text-surface-600'}>
                Task {demoState.currentTaskIndex + 1} of {demoState.scenario.tasks.length}
              </span>
              <span className={theme === 'dark' ? 'text-surface-400' : 'text-surface-600'}>
                {demoState.progress}%
              </span>
            </div>
            <div className={`w-full h-2 rounded-full ${
              theme === 'dark' ? 'bg-surface-700' : 'bg-surface-200'
            }`}>
              <div 
                className="h-2 bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${demoState.progress}%` }}
              />
            </div>
          </div>

          {/* Current Task */}
          <div className={`text-sm ${theme === 'dark' ? 'text-surface-300' : 'text-surface-700'}`}>
            {demoState.scenario.tasks[demoState.currentTaskIndex]?.description}
          </div>
        </div>
      )}

      {/* Logs Panel */}
      {showLogs && logs.length > 0 && (
        <div className={`p-3 rounded-lg border ${
          theme === 'dark' 
            ? 'bg-surface-900 border-surface-700' 
            : 'bg-surface-100 border-surface-300'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
              Demo Logs
            </span>
            <button
              onClick={handleResetDemo}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                theme === 'dark'
                  ? 'bg-surface-700 text-surface-300 hover:bg-surface-600'
                  : 'bg-surface-200 text-surface-700 hover:bg-surface-300'
              }`}
            >
              Clear
            </button>
          </div>
          <div className={`max-h-32 overflow-y-auto text-xs space-y-1 font-mono ${
            theme === 'dark' ? 'text-surface-400' : 'text-surface-600'
          }`}>
            {logs.map((log, index) => (
              <div key={index} className="whitespace-pre-wrap">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Demos */}
      {!demoState.isActive && (
        <div>
          <h4 className={`text-sm font-medium mb-3 ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
            Quick Demos
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: 'chart', label: 'Chart Creation', icon: '📊' },
              { key: 'table', label: 'Table Formatting', icon: '📋' },
              { key: 'formula', label: 'Formula Building', icon: '🧮' },
              { key: 'pivot', label: 'Pivot Tables', icon: '📈' }
            ].map((demo) => (
              <button
                key={demo.key}
                onClick={() => handleQuickDemo(demo.key as any)}
                className={`
                  p-3 rounded-lg border text-left transition-all duration-200 hover:scale-105 hover:shadow-md
                  ${theme === 'dark'
                    ? 'bg-surface-800 border-surface-700 hover:bg-surface-700'
                    : 'bg-white border-surface-200 hover:border-surface-300'
                  }
                `}
              >
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{demo.icon}</span>
                  <span className={`text-sm font-medium ${
                    theme === 'dark' ? 'text-white' : 'text-surface-900'
                  }`}>
                    {demo.label}
                  </span>
                </div>
                <div className={`text-xs mt-1 ${
                  theme === 'dark' ? 'text-surface-400' : 'text-surface-600'
                }`}>
                  ~30 seconds
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Full Demo Scenarios */}
      {!demoState.isActive && (
        <div>
          <h4 className={`text-sm font-medium mb-3 ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
            Full Demo Scenarios
          </h4>
          <div className="space-y-3">
            {scenarios.map((scenario) => (
              <div
                key={scenario.id}
                className={`
                  p-4 rounded-lg border transition-all duration-200 cursor-pointer hover:shadow-md
                  ${selectedScenario === scenario.id
                    ? theme === 'dark' 
                      ? 'bg-primary-500/10 border-primary-500' 
                      : 'bg-primary-50 border-primary-500'
                    : theme === 'dark'
                      ? 'bg-surface-800 border-surface-700 hover:bg-surface-700'
                      : 'bg-white border-surface-200 hover:border-surface-300'
                  }
                `}
                onClick={() => setSelectedScenario(scenario.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className="text-lg">{getCategoryIcon(scenario.category)}</span>
                      <h5 className={`font-medium ${
                        theme === 'dark' ? 'text-white' : 'text-surface-900'
                      }`}>
                        {scenario.name}
                      </h5>
                      <span className={`text-xs px-2 py-1 rounded-full border ${getCategoryColor(scenario.category)}`}>
                        {scenario.category}
                      </span>
                    </div>
                    
                    <p className={`text-sm mb-3 ${
                      theme === 'dark' ? 'text-surface-400' : 'text-surface-600'
                    }`}>
                      {scenario.description}
                    </p>

                    <div className="flex items-center space-x-4 text-xs">
                      <span className={theme === 'dark' ? 'text-surface-500' : 'text-surface-500'}>
                        {scenario.tasks.length} tasks
                      </span>
                      <span className={theme === 'dark' ? 'text-surface-500' : 'text-surface-500'}>
                        ~{formatDuration(scenario.estimatedDuration)}
                      </span>
                    </div>
                  </div>

                  {selectedScenario === scenario.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartDemo(scenario.id);
                      }}
                      className="ml-4 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium"
                    >
                      Start Demo
                    </button>
                  )}
                </div>

                {/* Task list for selected scenario */}
                {selectedScenario === scenario.id && (
                  <div className={`mt-4 pt-4 border-t ${
                    theme === 'dark' ? 'border-surface-600' : 'border-surface-300'
                  }`}>
                    <div className={`text-xs font-medium mb-2 ${
                      theme === 'dark' ? 'text-surface-300' : 'text-surface-700'
                    }`}>
                      Demo Tasks:
                    </div>
                    <div className="space-y-2">
                      {scenario.tasks.map((task, index) => (
                        <div
                          key={task.id}
                          className={`flex items-start space-x-3 text-xs p-2 rounded ${
                            theme === 'dark' ? 'bg-surface-700/50' : 'bg-surface-100'
                          }`}
                        >
                          <span className={`font-mono min-w-0 ${
                            theme === 'dark' ? 'text-surface-500' : 'text-surface-500'
                          }`}>
                            {index + 1}.
                          </span>
                          <span className={`flex-1 ${
                            theme === 'dark' ? 'text-surface-400' : 'text-surface-600'
                          }`}>
                            {task.description}
                          </span>
                          <span className={`text-primary-500 font-mono`}>
                            {formatDuration(task.metadata.estimatedDuration)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Help Text */}
      {!demoState.isActive && (
        <div className={`text-xs p-3 rounded border-l-4 border-blue-500 ${
          theme === 'dark' 
            ? 'bg-blue-500/10 text-blue-300' 
            : 'bg-blue-50 text-blue-700'
        }`}>
          💡 <strong>Demo Mode:</strong> All operations are simulated and do not require Excel or the Python automation service. 
          Perfect for testing, training, or showcasing Nubia's capabilities.
        </div>
      )}
    </div>
  );
};

export default DemoModePanel;