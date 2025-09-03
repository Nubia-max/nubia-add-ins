import React, { useState, useEffect, useRef } from 'react';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  targetElement?: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  highlight?: boolean;
}

interface OnboardingFlowProps {
  isOpen: boolean;
  onComplete: () => void;
  onSkip: () => void;
  theme: 'light' | 'dark';
}

const onboardingSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Nubia! 🎉',
    description: 'Your intelligent accounting assistant is ready to help automate your Excel tasks.',
    position: 'center'
  },
  {
    id: 'bubble',
    title: 'Floating Bubble Interface',
    description: 'Click the floating bubble to expand the chat interface. It stays on top of all windows for easy access.',
    targetElement: '.floating-bubble',
    position: 'right',
    highlight: true
  },
  {
    id: 'chat',
    title: 'Start a Conversation',
    description: 'Type your accounting questions or requests here. I can help with Excel automation, data analysis, and more.',
    targetElement: '.message-input',
    position: 'top',
    highlight: true
  },
  {
    id: 'voice',
    title: 'Voice Commands',
    description: 'Click the microphone to record voice commands. Perfect for hands-free interaction while working.',
    targetElement: '.voice-recorder',
    position: 'top',
    highlight: true
  },
  {
    id: 'settings',
    title: 'Customize Your Experience',
    description: 'Access settings to change theme, automation mode, and configure your preferences.',
    targetElement: '.settings-button',
    position: 'left',
    highlight: true
  },
  {
    id: 'shortcuts',
    title: 'Keyboard Shortcuts',
    description: 'Press Ctrl+Space to toggle the interface, Escape to minimize, and ? for help anytime.',
    position: 'center'
  },
  {
    id: 'complete',
    title: 'You\'re All Set! ✨',
    description: 'Start by asking me to help with your Excel automation tasks. I\'m here whenever you need assistance.',
    position: 'center'
  }
];

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  isOpen,
  onComplete,
  onSkip,
  theme
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);

  const step = onboardingSteps[currentStep];

  useEffect(() => {
    if (!isOpen || !step.targetElement) return;

    const updateTooltipPosition = () => {
      const element = document.querySelector(step.targetElement!);
      if (!element) return;

      const rect = element.getBoundingClientRect();
      const tooltipWidth = 320;
      const tooltipHeight = 200;
      
      let x = rect.left + rect.width / 2;
      let y = rect.top + rect.height / 2;

      // Adjust based on position
      switch (step.position) {
        case 'top':
          y = rect.top - tooltipHeight - 20;
          x = Math.max(20, Math.min(x - tooltipWidth / 2, window.innerWidth - tooltipWidth - 20));
          break;
        case 'bottom':
          y = rect.bottom + 20;
          x = Math.max(20, Math.min(x - tooltipWidth / 2, window.innerWidth - tooltipWidth - 20));
          break;
        case 'left':
          x = rect.left - tooltipWidth - 20;
          y = Math.max(20, Math.min(y - tooltipHeight / 2, window.innerHeight - tooltipHeight - 20));
          break;
        case 'right':
          x = rect.right + 20;
          y = Math.max(20, Math.min(y - tooltipHeight / 2, window.innerHeight - tooltipHeight - 20));
          break;
      }

      setTooltipPosition({ x, y });
    };

    updateTooltipPosition();
    window.addEventListener('resize', updateTooltipPosition);
    
    return () => window.removeEventListener('resize', updateTooltipPosition);
  }, [currentStep, isOpen, step.targetElement, step.position]);

  const nextStep = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const skipOnboarding = () => {
    onSkip();
  };

  if (!isOpen) return null;

  // Highlight target element
  const targetElement = step.targetElement ? document.querySelector(step.targetElement) : null;
  if (targetElement && step.highlight) {
    targetElement.classList.add('onboarding-highlight');
  }

  // Clean up highlights when component unmounts or step changes
  useEffect(() => {
    return () => {
      document.querySelectorAll('.onboarding-highlight').forEach(el => {
        el.classList.remove('onboarding-highlight');
      });
    };
  }, [currentStep]);

  const renderTooltip = () => {
    if (step.position === 'center') {
      return (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
          <div className={`
            max-w-md w-full rounded-2xl shadow-2xl animate-scale-in
            ${theme === 'dark' 
              ? 'bg-surface-900 border border-surface-700' 
              : 'bg-white border border-surface-200'
            }
          `}>
            <div className="p-6">
              <div className="text-center mb-6">
                <h2 className={`text-xl font-bold mb-2 ${
                  theme === 'dark' ? 'text-white' : 'text-surface-900'
                }`}>
                  {step.title}
                </h2>
                <p className={`text-sm leading-relaxed ${
                  theme === 'dark' ? 'text-surface-300' : 'text-surface-600'
                }`}>
                  {step.description}
                </p>
              </div>

              {/* Progress indicator */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className={`text-xs ${
                    theme === 'dark' ? 'text-surface-400' : 'text-surface-500'
                  }`}>
                    Step {currentStep + 1} of {onboardingSteps.length}
                  </span>
                  <span className={`text-xs ${
                    theme === 'dark' ? 'text-surface-400' : 'text-surface-500'
                  }`}>
                    {Math.round(((currentStep + 1) / onboardingSteps.length) * 100)}%
                  </span>
                </div>
                <div className={`w-full h-2 rounded-full ${
                  theme === 'dark' ? 'bg-surface-800' : 'bg-surface-200'
                }`}>
                  <div 
                    className="h-full bg-gradient-nubia rounded-full transition-all duration-300"
                    style={{ width: `${((currentStep + 1) / onboardingSteps.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between">
                <button
                  onClick={skipOnboarding}
                  className={`text-sm px-4 py-2 rounded-lg transition-colors duration-200 ${
                    theme === 'dark' 
                      ? 'text-surface-400 hover:text-white hover:bg-surface-800' 
                      : 'text-surface-500 hover:text-surface-700 hover:bg-surface-100'
                  }`}
                >
                  Skip tour
                </button>

                <div className="flex items-center space-x-3">
                  {currentStep > 0 && (
                    <button
                      onClick={prevStep}
                      className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
                        theme === 'dark' 
                          ? 'bg-surface-800 text-surface-200 hover:bg-surface-700' 
                          : 'bg-surface-100 text-surface-700 hover:bg-surface-200'
                      }`}
                    >
                      Back
                    </button>
                  )}
                  <button
                    onClick={nextStep}
                    className="px-6 py-2 bg-gradient-nubia text-white rounded-lg hover:opacity-90 transition-opacity duration-200 font-medium"
                  >
                    {currentStep === onboardingSteps.length - 1 ? 'Get Started' : 'Next'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div 
        className="fixed z-50 animate-fade-in"
        style={{ 
          left: `${tooltipPosition.x}px`, 
          top: `${tooltipPosition.y}px`
        }}
      >
        <div className={`
          max-w-xs rounded-xl shadow-xl p-4 relative
          ${theme === 'dark' 
            ? 'bg-surface-900 border border-surface-700' 
            : 'bg-white border border-surface-200'
          }
        `}>
          {/* Arrow */}
          <div className={`absolute w-3 h-3 transform rotate-45 ${
            theme === 'dark' ? 'bg-surface-900 border-surface-700' : 'bg-white border-surface-200'
          } ${
            step.position === 'top' ? '-bottom-1.5 left-1/2 -translate-x-1/2 border-r border-b' :
            step.position === 'bottom' ? '-top-1.5 left-1/2 -translate-x-1/2 border-l border-t' :
            step.position === 'left' ? '-right-1.5 top-1/2 -translate-y-1/2 border-t border-r' :
            step.position === 'right' ? '-left-1.5 top-1/2 -translate-y-1/2 border-b border-l' :
            ''
          }`} />

          <div className="relative z-10">
            <h3 className={`font-semibold text-sm mb-2 ${
              theme === 'dark' ? 'text-white' : 'text-surface-900'
            }`}>
              {step.title}
            </h3>
            <p className={`text-xs leading-relaxed mb-4 ${
              theme === 'dark' ? 'text-surface-300' : 'text-surface-600'
            }`}>
              {step.description}
            </p>

            <div className="flex items-center justify-between">
              <div className={`text-xs ${
                theme === 'dark' ? 'text-surface-400' : 'text-surface-500'
              }`}>
                {currentStep + 1}/{onboardingSteps.length}
              </div>

              <div className="flex items-center space-x-2">
                {currentStep > 0 && (
                  <button
                    onClick={prevStep}
                    className={`p-1 rounded transition-colors ${
                      theme === 'dark' 
                        ? 'text-surface-400 hover:text-white' 
                        : 'text-surface-500 hover:text-surface-700'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={nextStep}
                  className="px-3 py-1 bg-gradient-nubia text-white rounded text-xs font-medium hover:opacity-90 transition-opacity"
                >
                  {currentStep === onboardingSteps.length - 1 ? 'Done' : 'Next'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        ref={overlayRef}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in"
        onClick={step.position !== 'center' ? skipOnboarding : undefined}
      />
      
      {/* Skip button (always visible) */}
      <button
        onClick={skipOnboarding}
        className={`
          fixed top-6 right-6 z-50 px-4 py-2 rounded-lg transition-all duration-200
          ${theme === 'dark' 
            ? 'bg-surface-900/90 text-surface-400 hover:text-white border border-surface-700' 
            : 'bg-white/90 text-surface-500 hover:text-surface-700 border border-surface-200'
          }
          backdrop-blur-sm shadow-lg
        `}
      >
        Skip Tour ✕
      </button>

      {/* Tooltip */}
      {renderTooltip()}

      {/* Highlight styles */}
      <style>{`
        :global(.onboarding-highlight) {
          position: relative;
          z-index: 45 !important;
          box-shadow: 0 0 0 4px rgba(168, 85, 247, 0.4), 0 0 32px rgba(168, 85, 247, 0.3) !important;
          border-radius: 8px;
          animation: pulse-highlight 2s infinite;
        }

        :global(@keyframes pulse-highlight) {
          0%, 100% { box-shadow: 0 0 0 4px rgba(168, 85, 247, 0.4), 0 0 32px rgba(168, 85, 247, 0.3); }
          50% { box-shadow: 0 0 0 6px rgba(168, 85, 247, 0.6), 0 0 40px rgba(168, 85, 247, 0.4); }
        }

        :global(.animate-fade-in) {
          animation: fade-in 0.3s ease-out;
        }

        :global(.animate-scale-in) {
          animation: scale-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        :global(@keyframes fade-in) {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        :global(@keyframes scale-in) {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  );
};