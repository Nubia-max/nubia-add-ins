import React from 'react';
import { KeyboardShortcut } from '../hooks/useKeyboardShortcuts';

interface KeyboardShortcutsHelpProps {
  shortcuts: Array<KeyboardShortcut & { formatted: string }>;
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
}

export const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({
  shortcuts,
  isOpen,
  onClose,
  theme
}) => {
  if (!isOpen) return null;

  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    const category = shortcut.global ? 'Global' : 'Chat';
    if (!acc[category]) acc[category] = [];
    acc[category].push(shortcut);
    return acc;
  }, {} as Record<string, Array<KeyboardShortcut & { formatted: string }>>);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className={`
        relative max-w-md w-full mx-4 rounded-2xl shadow-2xl animate-scale-in
        ${theme === 'dark' 
          ? 'bg-surface-900 border border-surface-700' 
          : 'bg-white border border-surface-200'
        }
      `}>
        {/* Header */}
        <div className={`
          flex items-center justify-between p-6 border-b
          ${theme === 'dark' ? 'border-surface-700' : 'border-surface-200'}
        `}>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-nubia rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <div>
              <h2 className={`text-lg font-bold ${
                theme === 'dark' ? 'text-white' : 'text-surface-900'
              }`}>
                Keyboard Shortcuts
              </h2>
              <p className={`text-sm ${
                theme === 'dark' ? 'text-surface-400' : 'text-surface-600'
              }`}>
                Speed up your workflow
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className={`
              p-2 rounded-lg transition-colors duration-200
              ${theme === 'dark' 
                ? 'hover:bg-surface-800 text-surface-400 hover:text-white' 
                : 'hover:bg-surface-100 text-surface-500 hover:text-surface-900'
              }
            `}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-96 overflow-y-auto">
          {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
            <div key={category} className="mb-6 last:mb-0">
              <h3 className={`text-sm font-semibold mb-3 ${
                theme === 'dark' ? 'text-surface-200' : 'text-surface-700'
              }`}>
                {category}
              </h3>
              
              <div className="space-y-3">
                {categoryShortcuts.map((shortcut, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className={`text-sm ${
                      theme === 'dark' ? 'text-surface-300' : 'text-surface-600'
                    }`}>
                      {shortcut.description}
                    </div>
                    
                    <div className="flex items-center space-x-1">
                      {shortcut.formatted.split(navigator.platform.includes('Mac') ? '' : '+').map((key, keyIndex) => (
                        <React.Fragment key={keyIndex}>
                          <kbd className={`
                            px-2 py-1 text-xs font-mono rounded border shadow-sm
                            ${theme === 'dark' 
                              ? 'bg-surface-800 border-surface-600 text-surface-200' 
                              : 'bg-surface-50 border-surface-300 text-surface-700'
                            }
                          `}>
                            {key}
                          </kbd>
                          {keyIndex < shortcut.formatted.split(navigator.platform.includes('Mac') ? '' : '+').length - 1 && 
                           !navigator.platform.includes('Mac') && (
                            <span className={`text-xs ${
                              theme === 'dark' ? 'text-surface-500' : 'text-surface-400'
                            }`}>
                              +
                            </span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className={`
          px-6 py-4 border-t rounded-b-2xl
          ${theme === 'dark' 
            ? 'bg-surface-800/50 border-surface-700' 
            : 'bg-surface-50 border-surface-200'
          }
        `}>
          <div className="flex items-center justify-between">
            <div className={`text-xs ${
              theme === 'dark' ? 'text-surface-400' : 'text-surface-500'
            }`}>
              Press <kbd className={`
                px-1 py-0.5 text-xs rounded border
                ${theme === 'dark' 
                  ? 'bg-surface-700 border-surface-600 text-surface-200' 
                  : 'bg-white border-surface-300 text-surface-600'
                }
              `}>?</kbd> anytime to show this help
            </div>
            
            <button
              onClick={onClose}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors duration-200 text-sm font-medium"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};