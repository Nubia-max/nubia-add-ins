import React, { useState, useEffect } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
  theme?: 'light' | 'dark';
}

interface LoadingStep {
  id: string;
  label: string;
  progress: number;
  completed: boolean;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onComplete,
  theme = 'dark'
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [overallProgress, setOverallProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  
  const [loadingSteps, setLoadingSteps] = useState<LoadingStep[]>([
    { id: 'init', label: 'Initializing Nubia...', progress: 0, completed: false },
    { id: 'security', label: 'Loading security modules...', progress: 0, completed: false },
    { id: 'excel', label: 'Detecting Excel installation...', progress: 0, completed: false },
    { id: 'services', label: 'Starting background services...', progress: 0, completed: false },
    { id: 'ui', label: 'Preparing user interface...', progress: 0, completed: false }
  ]);

  useEffect(() => {
    simulateLoading();
  }, []);

  const simulateLoading = async () => {
    const steps = [...loadingSteps];
    
    for (let i = 0; i < steps.length; i++) {
      setCurrentStep(i);
      
      // Simulate progressive loading for current step
      for (let progress = 0; progress <= 100; progress += Math.random() * 15) {
        steps[i].progress = Math.min(100, progress);
        setLoadingSteps([...steps]);
        setOverallProgress(((i * 100 + steps[i].progress) / steps.length));
        
        await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
      }
      
      steps[i].progress = 100;
      steps[i].completed = true;
      setLoadingSteps([...steps]);
      
      // Brief pause between steps
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    setOverallProgress(100);
    
    // Final completion animation
    await new Promise(resolve => setTimeout(resolve, 500));
    setIsComplete(true);
    
    // Fade out
    await new Promise(resolve => setTimeout(resolve, 800));
    onComplete();
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${
      theme === 'dark' 
        ? 'bg-gradient-to-br from-surface-900 via-surface-800 to-surface-900' 
        : 'bg-gradient-to-br from-blue-50 via-white to-blue-50'
    } ${isComplete ? 'animate-fade-out' : ''}`}>
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500 rounded-full filter blur-3xl animate-pulse"></div>
        <div className="absolute top-3/4 right-1/4 w-48 h-48 bg-purple-500 rounded-full filter blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute bottom-1/4 left-1/3 w-32 h-32 bg-green-500 rounded-full filter blur-3xl animate-pulse delay-2000"></div>
      </div>

      <div className="relative z-10 text-center max-w-md mx-auto px-6">
        {/* Logo */}
        <div className={`mb-8 transform transition-all duration-1000 ${
          isComplete ? 'scale-110' : 'scale-100'
        }`}>
          <div className={`w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
            theme === 'dark' 
              ? 'bg-gradient-to-br from-blue-500 to-purple-600' 
              : 'bg-gradient-to-br from-blue-600 to-purple-700'
          } shadow-2xl`}>
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          
          <h1 className={`text-3xl font-bold ${
            theme === 'dark' ? 'text-white' : 'text-surface-900'
          } mb-2`}>
            Nubia
          </h1>
          
          <p className={`text-sm ${
            theme === 'dark' ? 'text-surface-300' : 'text-surface-600'
          }`}>
            Intelligent Excel Automation
          </p>
        </div>

        {/* Loading Progress */}
        <div className="space-y-4">
          {/* Overall Progress Bar */}
          <div>
            <div className={`w-full h-2 rounded-full ${
              theme === 'dark' ? 'bg-surface-700' : 'bg-surface-200'
            } overflow-hidden`}>
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            
            <div className="flex justify-between items-center mt-2">
              <span className={`text-sm ${
                theme === 'dark' ? 'text-surface-400' : 'text-surface-600'
              }`}>
                {Math.round(overallProgress)}% Complete
              </span>
              
              {isComplete && (
                <div className="flex items-center space-x-1 text-green-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-medium">Ready</span>
                </div>
              )}
            </div>
          </div>

          {/* Current Step */}
          <div className="mt-6">
            {loadingSteps.map((step, index) => (
              <div 
                key={step.id}
                className={`flex items-center space-x-3 py-2 transition-all duration-300 ${
                  index === currentStep ? 'opacity-100' : 
                  index < currentStep ? 'opacity-60' : 'opacity-30'
                }`}
              >
                {/* Step Icon */}
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  step.completed 
                    ? 'bg-green-500 text-white' 
                    : index === currentStep 
                    ? 'bg-blue-500 text-white' 
                    : theme === 'dark' 
                    ? 'bg-surface-700 text-surface-400' 
                    : 'bg-surface-200 text-surface-500'
                }`}>
                  {step.completed ? (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : index === currentStep ? (
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  ) : (
                    <div className="w-2 h-2 bg-current rounded-full opacity-50" />
                  )}
                </div>

                {/* Step Label */}
                <span className={`text-sm font-medium flex-1 text-left ${
                  step.completed 
                    ? theme === 'dark' ? 'text-green-400' : 'text-green-600'
                    : index === currentStep 
                    ? theme === 'dark' ? 'text-white' : 'text-surface-900'
                    : theme === 'dark' ? 'text-surface-500' : 'text-surface-500'
                }`}>
                  {step.label}
                </span>

                {/* Step Progress */}
                {index === currentStep && !step.completed && (
                  <div className={`text-xs ${
                    theme === 'dark' ? 'text-surface-400' : 'text-surface-500'
                  }`}>
                    {Math.round(step.progress)}%
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Version Info */}
        <div className={`mt-8 text-xs ${
          theme === 'dark' ? 'text-surface-500' : 'text-surface-400'
        }`}>
          Version 1.0.0
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-out {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        
        .animate-fade-out {
          animation: fade-out 0.8s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;