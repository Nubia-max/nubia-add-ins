import React, { useState, useEffect } from 'react';
import { analytics } from '../services/analytics';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<OnboardingStepProps>;
  canSkip?: boolean;
  isOptional?: boolean;
}

interface OnboardingStepProps {
  onNext: (data?: any) => void;
  onPrev: () => void;
  onSkip?: () => void;
  stepData?: any;
}

interface OnboardingWizardProps {
  onComplete: (data: any) => void;
  onSkip: () => void;
  theme?: 'light' | 'dark';
}

// Step 1: Welcome
const WelcomeStep: React.FC<OnboardingStepProps> = ({ onNext }) => {
  useEffect(() => {
    analytics.track('onboarding_welcome_viewed');
  }, []);

  return (
    <div className="text-center space-y-6">
      <div className="w-20 h-20 mx-auto bg-blue-500 rounded-full flex items-center justify-center">
        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      
      <h2 className="text-2xl font-bold text-surface-900 dark:text-white">
        Welcome to Nubia
      </h2>
      
      <p className="text-lg text-surface-600 dark:text-surface-300 max-w-md mx-auto">
        Your intelligent Excel automation assistant. Let's get you set up in just a few minutes.
      </p>
      
      <div className="space-y-4">
        <div className="flex items-center space-x-3 text-left max-w-sm mx-auto">
          <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="text-surface-700 dark:text-surface-300">Automate repetitive Excel tasks</span>
        </div>
        
        <div className="flex items-center space-x-3 text-left max-w-sm mx-auto">
          <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="text-surface-700 dark:text-surface-300">Natural language processing</span>
        </div>
        
        <div className="flex items-center space-x-3 text-left max-w-sm mx-auto">
          <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="text-surface-700 dark:text-surface-300">Safe and secure automation</span>
        </div>
      </div>
      
      <button
        onClick={() => onNext()}
        className="px-8 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
      >
        Get Started
      </button>
    </div>
  );
};

// Step 2: Excel Detection
const ExcelDetectionStep: React.FC<OnboardingStepProps> = ({ onNext, onPrev }) => {
  const [isDetecting, setIsDetecting] = useState(true);
  const [excelFound, setExcelFound] = useState<boolean | null>(null);
  const [excelPath, setExcelPath] = useState<string>('');

  useEffect(() => {
    detectExcel();
  }, []);

  const detectExcel = async () => {
    setIsDetecting(true);
    analytics.track('onboarding_excel_detection_started');
    
    try {
      // Simulate Excel detection
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if Excel is installed (this would be actual detection logic)
      const found = await checkExcelInstallation();
      setExcelFound(found);
      
      if (found) {
        setExcelPath('Microsoft Excel detected');
        analytics.track('onboarding_excel_detected');
      } else {
        analytics.track('onboarding_excel_not_found');
      }
    } catch (error) {
      setExcelFound(false);
      analytics.error(error as Error, { context: 'excel_detection' });
    } finally {
      setIsDetecting(false);
    }
  };

  const checkExcelInstallation = async (): Promise<boolean> => {
    // This would use actual system detection
    // For demo purposes, we'll return true
    return Math.random() > 0.3;
  };

  const handleManualPath = () => {
    // Open file dialog to select Excel installation
    if (window.electron) {
      window.electron.invoke('show-open-dialog', {
        title: 'Select Excel Application',
        filters: [
          { name: 'Excel Application', extensions: ['exe', 'app'] }
        ]
      }).then((result: any) => {
        if (!result.canceled && result.filePaths[0]) {
          setExcelPath(result.filePaths[0]);
          setExcelFound(true);
        }
      });
    }
  };

  return (
    <div className="text-center space-y-6">
      <h2 className="text-2xl font-bold text-surface-900 dark:text-white">
        Excel Installation
      </h2>
      
      <p className="text-surface-600 dark:text-surface-300">
        We need to detect your Excel installation to provide the best automation experience.
      </p>

      <div className="bg-surface-50 dark:bg-surface-800 rounded-lg p-6">
        {isDetecting ? (
          <div className="flex items-center justify-center space-x-3">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-surface-600 dark:text-surface-300">Detecting Excel installation...</span>
          </div>
        ) : excelFound ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center space-x-3 text-green-600">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-lg font-medium">Excel Detected!</span>
            </div>
            <p className="text-sm text-surface-600 dark:text-surface-400">{excelPath}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-center space-x-3 text-yellow-600">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="text-lg font-medium">Excel Not Found</span>
            </div>
            
            <p className="text-sm text-surface-600 dark:text-surface-400">
              We couldn't automatically detect Excel. You can either install Excel or specify the path manually.
            </p>
            
            <div className="space-y-3">
              <button
                onClick={handleManualPath}
                className="px-4 py-2 border border-surface-300 dark:border-surface-600 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
              >
                Select Excel Path Manually
              </button>
              
              <button
                onClick={detectExcel}
                className="px-4 py-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              >
                Try Detection Again
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <button
          onClick={onPrev}
          className="px-4 py-2 border border-surface-300 dark:border-surface-600 text-surface-700 dark:text-surface-300 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
        >
          Back
        </button>
        
        <button
          onClick={() => onNext({ excelFound, excelPath })}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
          disabled={isDetecting}
        >
          Continue
        </button>
      </div>
    </div>
  );
};

// Step 3: API Configuration
const ApiConfigStep: React.FC<OnboardingStepProps> = ({ onNext, onPrev, onSkip }) => {
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState<'openai' | 'anthropic'>('openai');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<'success' | 'error' | null>(null);

  const validateApiKey = async () => {
    if (!apiKey.trim()) return;
    
    setIsValidating(true);
    setValidationResult(null);

    try {
      analytics.track('onboarding_api_validation_started', { provider });
      
      // Simulate API validation
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const isValid = apiKey.length > 20; // Simple validation for demo
      setValidationResult(isValid ? 'success' : 'error');
      
      if (isValid) {
        analytics.track('onboarding_api_validation_success', { provider });
      } else {
        analytics.track('onboarding_api_validation_failed', { provider });
      }
    } catch (error) {
      setValidationResult('error');
      analytics.error(error as Error, { context: 'api_validation' });
    } finally {
      setIsValidating(false);
    }
  };

  useEffect(() => {
    if (apiKey && validationResult !== 'success') {
      const timer = setTimeout(() => {
        validateApiKey();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [apiKey, provider]);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-surface-900 dark:text-white mb-2">
          API Configuration
        </h2>
        <p className="text-surface-600 dark:text-surface-300">
          Connect your AI provider to enable intelligent automation features.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
            AI Provider
          </label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as 'openai' | 'anthropic')}
            className="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 rounded-lg bg-white dark:bg-surface-800 text-surface-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="openai">OpenAI (GPT-4)</option>
            <option value="anthropic">Anthropic (Claude)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
            API Key
          </label>
          <div className="relative">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={`Enter your ${provider === 'openai' ? 'OpenAI' : 'Anthropic'} API key`}
              className="w-full px-3 py-2 pr-10 border border-surface-300 dark:border-surface-600 rounded-lg bg-white dark:bg-surface-800 text-surface-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
            
            {isValidating && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
            
            {validationResult === 'success' && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            
            {validationResult === 'error' && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-red-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            )}
          </div>
          
          {validationResult === 'error' && (
            <p className="text-sm text-red-500 mt-1">
              Invalid API key. Please check your key and try again.
            </p>
          )}
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
            Where to get your API key:
          </h4>
          <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
            {provider === 'openai' ? (
              <>
                <li>1. Visit <a href="#" className="underline">platform.openai.com</a></li>
                <li>2. Sign in or create an account</li>
                <li>3. Go to API Keys section</li>
                <li>4. Create a new secret key</li>
              </>
            ) : (
              <>
                <li>1. Visit <a href="#" className="underline">console.anthropic.com</a></li>
                <li>2. Sign in or create an account</li>
                <li>3. Go to API Keys section</li>
                <li>4. Generate a new API key</li>
              </>
            )}
          </ul>
        </div>
      </div>

      <div className="flex justify-between">
        <button
          onClick={onPrev}
          className="px-4 py-2 border border-surface-300 dark:border-surface-600 text-surface-700 dark:text-surface-300 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
        >
          Back
        </button>
        
        <div className="space-x-3">
          {onSkip && (
            <button
              onClick={onSkip}
              className="px-4 py-2 text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
            >
              Skip for now
            </button>
          )}
          
          <button
            onClick={() => onNext({ apiKey, provider, isValid: validationResult === 'success' })}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
            disabled={!apiKey || validationResult !== 'success'}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

// Step 4: Sample Task
const SampleTaskStep: React.FC<OnboardingStepProps> = ({ onNext, onPrev }) => {
  const [selectedTask, setSelectedTask] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [taskResult, setTaskResult] = useState<'success' | 'error' | null>(null);

  const sampleTasks = [
    {
      id: 'format_data',
      title: 'Format Data Table',
      description: 'Clean and format a sample data table with proper headers and styling',
      difficulty: 'Easy'
    },
    {
      id: 'create_chart',
      title: 'Create Chart',
      description: 'Generate a chart from sample data and add it to your worksheet',
      difficulty: 'Medium'
    },
    {
      id: 'pivot_table',
      title: 'Create Pivot Table',
      description: 'Create a pivot table summary from sample data',
      difficulty: 'Advanced'
    }
  ];

  const runSampleTask = async () => {
    if (!selectedTask) return;

    setIsRunning(true);
    setTaskResult(null);

    try {
      analytics.track('onboarding_sample_task_started', { task: selectedTask });
      
      // Simulate task execution
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Simulate success/failure
      const success = Math.random() > 0.2;
      setTaskResult(success ? 'success' : 'error');
      
      if (success) {
        analytics.track('onboarding_sample_task_completed', { task: selectedTask });
      } else {
        analytics.track('onboarding_sample_task_failed', { task: selectedTask });
      }
    } catch (error) {
      setTaskResult('error');
      analytics.error(error as Error, { context: 'sample_task' });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-surface-900 dark:text-white mb-2">
          Try a Sample Task
        </h2>
        <p className="text-surface-600 dark:text-surface-300">
          Let's run a sample automation task to see Nubia in action.
        </p>
      </div>

      <div className="space-y-3">
        {sampleTasks.map((task) => (
          <div
            key={task.id}
            className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
              selectedTask === task.id
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600'
            }`}
            onClick={() => setSelectedTask(task.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-medium text-surface-900 dark:text-white">
                  {task.title}
                </h3>
                <p className="text-sm text-surface-600 dark:text-surface-300 mt-1">
                  {task.description}
                </p>
              </div>
              
              <div className="ml-4 flex items-center space-x-2">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  task.difficulty === 'Easy' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' :
                  task.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300' :
                  'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                }`}>
                  {task.difficulty}
                </span>
                
                {selectedTask === task.id && (
                  <div className="w-4 h-4 border-2 border-blue-500 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedTask && (
        <div className="space-y-4">
          <button
            onClick={runSampleTask}
            disabled={isRunning}
            className="w-full px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 font-medium"
          >
            {isRunning ? 'Running Task...' : 'Run Sample Task'}
          </button>

          {isRunning && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                    Executing automation task...
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    This may take a few moments
                  </p>
                </div>
              </div>
            </div>
          )}

          {taskResult === 'success' && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-green-800 dark:text-green-300">
                    Task completed successfully!
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    Check your Excel worksheet to see the results
                  </p>
                </div>
              </div>
            </div>
          )}

          {taskResult === 'error' && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-300">
                    Task failed to complete
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    Please check your Excel connection and try again
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={onPrev}
          className="px-4 py-2 border border-surface-300 dark:border-surface-600 text-surface-700 dark:text-surface-300 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
        >
          Back
        </button>
        
        <button
          onClick={() => onNext({ selectedTask, taskResult })}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
};

// Step 5: Completion
const CompletionStep: React.FC<OnboardingStepProps> = ({ onNext }) => {
  useEffect(() => {
    analytics.track('onboarding_completed');
  }, []);

  return (
    <div className="text-center space-y-6">
      <div className="w-20 h-20 mx-auto bg-green-500 rounded-full flex items-center justify-center">
        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      
      <h2 className="text-2xl font-bold text-surface-900 dark:text-white">
        You're All Set!
      </h2>
      
      <p className="text-lg text-surface-600 dark:text-surface-300 max-w-md mx-auto">
        Nubia is ready to help you automate your Excel workflows. Start by describing what you'd like to do.
      </p>
      
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
          Quick Tips:
        </h4>
        <ul className="text-sm text-blue-700 dark:text-blue-300 text-left space-y-1">
          <li>• Use natural language to describe your tasks</li>
          <li>• Review automation results before applying</li>
          <li>• Check the help menu for documentation</li>
          <li>• Join our community for tips and support</li>
        </ul>
      </div>
      
      <button
        onClick={() => onNext()}
        className="px-8 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
      >
        Start Using Nubia
      </button>
    </div>
  );
};

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  onComplete,
  onSkip,
  theme = 'dark'
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [stepData, setStepData] = useState<any>({});

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome',
      description: 'Introduction to Nubia',
      component: WelcomeStep
    },
    {
      id: 'excel-detection',
      title: 'Excel Setup',
      description: 'Detect Excel installation',
      component: ExcelDetectionStep
    },
    {
      id: 'api-config',
      title: 'API Configuration',
      description: 'Configure AI provider',
      component: ApiConfigStep,
      canSkip: true,
      isOptional: true
    },
    {
      id: 'sample-task',
      title: 'Sample Task',
      description: 'Try a sample automation',
      component: SampleTaskStep,
      canSkip: true,
      isOptional: true
    },
    {
      id: 'completion',
      title: 'Complete',
      description: 'Setup complete',
      component: CompletionStep
    }
  ];

  const handleNext = (data?: any) => {
    if (data) {
      setStepData(prev => ({ ...prev, [steps[currentStep].id]: data }));
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
      analytics.track('onboarding_step_completed', { 
        step: steps[currentStep].id,
        step_index: currentStep 
      });
    } else {
      onComplete(stepData);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      analytics.track('onboarding_step_back', { 
        step: steps[currentStep].id,
        step_index: currentStep 
      });
    }
  };

  const handleSkip = () => {
    analytics.track('onboarding_skipped', { 
      step: steps[currentStep].id,
      step_index: currentStep 
    });
    onSkip();
  };

  const handleStepSkip = () => {
    handleNext();
  };

  const currentStepData = steps[currentStep];
  const StepComponent = currentStepData.component;

  return (
    <div className={`fixed inset-0 bg-white dark:bg-surface-900 z-50 flex items-center justify-center ${
      theme === 'dark' ? 'dark' : ''
    }`}>
      <div className="w-full max-w-2xl mx-auto p-6">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-surface-600 dark:text-surface-400">
              Step {currentStep + 1} of {steps.length}
            </span>
            
            {currentStep > 0 && (
              <button
                onClick={handleSkip}
                className="text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition-colors"
              >
                Skip Setup
              </button>
            )}
          </div>
          
          <div className="w-full bg-surface-200 dark:bg-surface-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 shadow-xl p-8">
          <StepComponent
            onNext={handleNext}
            onPrev={handlePrev}
            onSkip={currentStepData.canSkip ? handleStepSkip : undefined}
            stepData={stepData[currentStepData.id]}
          />
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;