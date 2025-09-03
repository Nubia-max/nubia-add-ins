import React, { useState } from 'react';

interface SettingsPanelProps {
  onClose: () => void;
}

type AutomationMode = 'visual' | 'background';

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ onClose }) => {
  const [automationMode, setAutomationMode] = useState<AutomationMode>('visual');
  const [notifications, setNotifications] = useState(true);
  const [autoMinimize, setAutoMinimize] = useState(false);

  const handleSave = () => {
    // Save settings to localStorage or send to backend
    localStorage.setItem('nubia-settings', JSON.stringify({
      automationMode,
      notifications,
      autoMinimize
    }));
    onClose();
  };

  React.useEffect(() => {
    // Load settings from localStorage
    const savedSettings = localStorage.getItem('nubia-settings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setAutomationMode(settings.automationMode || 'visual');
      setNotifications(settings.notifications !== false);
      setAutoMinimize(settings.autoMinimize || false);
    }
  }, []);

  return (
    <div className="absolute inset-0 bg-white z-50 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-surface-200">
        <h2 className="text-lg font-semibold text-surface-800">Settings</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-surface-100 rounded-lg transition-colors duration-200"
        >
          <svg className="w-5 h-5 text-surface-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Settings Content */}
      <div className="p-6 space-y-6">
        {/* Automation Mode */}
        <div>
          <h3 className="text-sm font-medium text-surface-700 mb-3">Automation Mode</h3>
          <div className="space-y-3">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="radio"
                name="automationMode"
                value="visual"
                checked={automationMode === 'visual'}
                onChange={(e) => setAutomationMode(e.target.value as AutomationMode)}
                className="mt-1 text-primary-500 focus:ring-primary-500"
              />
              <div>
                <div className="font-medium text-surface-800">Visual Mode</div>
                <div className="text-sm text-surface-600">
                  Shows automation steps on screen. Good for learning and verification.
                </div>
              </div>
            </label>
            
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="radio"
                name="automationMode"
                value="background"
                checked={automationMode === 'background'}
                onChange={(e) => setAutomationMode(e.target.value as AutomationMode)}
                className="mt-1 text-primary-500 focus:ring-primary-500"
              />
              <div>
                <div className="font-medium text-surface-800">Background Mode</div>
                <div className="text-sm text-surface-600">
                  Runs Excel automation in the background. Faster but no visual feedback.
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* General Settings */}
        <div>
          <h3 className="text-sm font-medium text-surface-700 mb-3">General</h3>
          <div className="space-y-3">
            <label className="flex items-center justify-between">
              <span className="text-surface-800">Enable notifications</span>
              <input
                type="checkbox"
                checked={notifications}
                onChange={(e) => setNotifications(e.target.checked)}
                className="text-primary-500 focus:ring-primary-500 rounded"
              />
            </label>
            
            <label className="flex items-center justify-between">
              <span className="text-surface-800">Auto-minimize after task</span>
              <input
                type="checkbox"
                checked={autoMinimize}
                onChange={(e) => setAutoMinimize(e.target.checked)}
                className="text-primary-500 focus:ring-primary-500 rounded"
              />
            </label>
          </div>
        </div>

        {/* About */}
        <div>
          <h3 className="text-sm font-medium text-surface-700 mb-3">About</h3>
          <div className="text-sm text-surface-600 space-y-1">
            <p>Nubia v1.0.0</p>
            <p>Excel Automation Assistant</p>
            <p className="text-xs text-surface-500 mt-2">
              Built with Electron, React, and FastAPI
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-surface-200 bg-surface-50">
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-surface-600 hover:text-surface-800 transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors duration-200"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};