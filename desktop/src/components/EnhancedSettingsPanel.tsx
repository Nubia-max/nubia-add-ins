import React, { useState, useEffect } from 'react';
import { useTheme } from '../hooks/useTheme';
import { storageService } from '../services/storage';
import { llmService } from '../services/llm';
import { automationService } from '../services/automation';

interface EnhancedSettingsPanelProps {
  onClose: () => void;
  onClearChat: () => void;
  onExportChat: () => void;
}

type AutomationMode = 'visual' | 'background';

interface UserSettings {
  automationMode: AutomationMode;
  notifications: boolean;
  autoMinimize: boolean;
  soundEffects: boolean;
  voiceEnabled: boolean;
  openaiApiKey: string;
  anthropicApiKey: string;
  apiProvider: 'openai' | 'anthropic';
  shortcuts: {
    toggle: string;
    minimize: string;
  };
}

const defaultSettings: UserSettings = {
  automationMode: 'visual',
  notifications: true,
  autoMinimize: false,
  soundEffects: true,
  voiceEnabled: true,
  openaiApiKey: '',
  anthropicApiKey: '',
  apiProvider: 'openai',
  shortcuts: {
    toggle: 'Ctrl+Space',
    minimize: 'Escape'
  }
};

export const EnhancedSettingsPanel: React.FC<EnhancedSettingsPanelProps> = ({ 
  onClose, 
  onClearChat, 
  onExportChat 
}) => {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [activeTab, setActiveTab] = useState<'general' | 'automation' | 'advanced'>('general');
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<Record<string, 'success' | 'error' | null>>({
    openai: null,
    anthropic: null
  });
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    // Load settings from storage
    const loadSettings = async () => {
      try {
        const openaiKey = await storageService.getOpenAIApiKey();
        const anthropicKey = await storageService.getAnthropicApiKey();
        const currentProvider = await storageService.getCurrentProvider();
        const userPrefs = await storageService.getUserPreferences();
        
        setSettings({
          ...defaultSettings,
          openaiApiKey: openaiKey || '',
          anthropicApiKey: anthropicKey || '',
          apiProvider: currentProvider,
          // Get current automation mode from service  
          automationMode: automationService.getDefaultMode(),
          notifications: true,
          autoMinimize: false
        });
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };

    loadSettings();
  }, []);

  const handleSettingChange = <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
  };

  const handleSave = async () => {
    try {
      // Save API keys to storage
      await storageService.setOpenAIApiKey(settings.openaiApiKey);
      await storageService.setAnthropicApiKey(settings.anthropicApiKey);
      await storageService.setCurrentProvider(settings.apiProvider);
      
      // Save other preferences
      await storageService.setUserPreferences({
        theme: theme as any,
        // TODO: Add other preferences mapping
      });

      console.log('Settings saved successfully');
      onClose();
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const testConnection = async (provider: 'openai' | 'anthropic') => {
    setTestingConnection(provider);
    setConnectionStatus(prev => ({ ...prev, [provider]: null }));

    try {
      // Temporarily save the API key to test
      if (provider === 'openai') {
        await storageService.setOpenAIApiKey(settings.openaiApiKey);
      } else {
        await storageService.setAnthropicApiKey(settings.anthropicApiKey);
      }

      const success = await llmService.testConnection(provider);
      setConnectionStatus(prev => ({ ...prev, [provider]: success ? 'success' : 'error' }));
      
      if (success) {
        console.log(`${provider} connection successful`);
      } else {
        console.error(`${provider} connection failed`);
      }
    } catch (error) {
      console.error(`${provider} connection test failed:`, error);
      setConnectionStatus(prev => ({ ...prev, [provider]: 'error' }));
    } finally {
      setTestingConnection(null);
    }
  };

  const handleClearChat = () => {
    if (confirmClear) {
      onClearChat();
      setConfirmClear(false);
      onClose();
    } else {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
    }
  };

  const tabs = [
    { id: 'general' as const, label: 'General', icon: '⚙️' },
    { id: 'automation' as const, label: 'Automation', icon: '🤖' },
    { id: 'advanced' as const, label: 'Advanced', icon: '🔧' },
  ];

  return (
    <div className="absolute inset-0 z-50 flex">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Settings Panel */}
      <div className={`
        relative ml-auto h-full w-80 flex flex-col animate-slide-in-right
        ${theme === 'dark' 
          ? 'bg-surface-900/95 border-l border-surface-700' 
          : 'bg-white/95 border-l border-surface-200'
        }
        backdrop-blur-xl shadow-2xl
      `}>
        {/* Header */}
        <div className={`
          flex items-center justify-between p-4 border-b
          ${theme === 'dark' ? 'border-surface-700' : 'border-surface-200'}
        `}>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-nubia rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
              Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`
              p-2 rounded-lg transition-colors duration-200
              ${theme === 'dark' 
                ? 'hover:bg-surface-800 text-surface-400 hover:text-white' 
                : 'hover:bg-surface-100 text-surface-600 hover:text-surface-900'
              }
            `}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className={`
          flex border-b
          ${theme === 'dark' ? 'border-surface-700' : 'border-surface-200'}
        `}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex-1 px-4 py-3 text-sm font-medium transition-colors duration-200 border-b-2
                ${activeTab === tab.id
                  ? 'border-primary-500 text-primary-500'
                  : theme === 'dark'
                    ? 'border-transparent text-surface-400 hover:text-white'
                    : 'border-transparent text-surface-600 hover:text-surface-900'
                }
              `}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Theme Setting */}
              <div>
                <label className={`block text-sm font-medium mb-3 ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
                  Appearance
                </label>
                <button
                  onClick={toggleTheme}
                  className={`
                    w-full flex items-center justify-between p-3 rounded-lg border transition-colors duration-200
                    ${theme === 'dark' 
                      ? 'border-surface-700 bg-surface-800 hover:bg-surface-700 text-white' 
                      : 'border-surface-200 bg-surface-50 hover:bg-surface-100 text-surface-900'
                    }
                  `}
                >
                  <div className="flex items-center space-x-3">
                    {theme === 'dark' ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    )}
                    <span className="font-medium">{theme === 'dark' ? 'Dark' : 'Light'} Theme</span>
                  </div>
                  <svg className="w-4 h-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Notifications */}
              <div>
                <label className={`flex items-center justify-between ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
                  <div>
                    <span className="font-medium">Notifications</span>
                    <p className={`text-sm ${theme === 'dark' ? 'text-surface-400' : 'text-surface-600'}`}>
                      Show system notifications
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifications}
                    onChange={(e) => handleSettingChange('notifications', e.target.checked)}
                    className="text-primary-500 focus:ring-primary-500 rounded"
                  />
                </label>
              </div>

              {/* Sound Effects */}
              <div>
                <label className={`flex items-center justify-between ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
                  <div>
                    <span className="font-medium">Sound Effects</span>
                    <p className={`text-sm ${theme === 'dark' ? 'text-surface-400' : 'text-surface-600'}`}>
                      Play sounds for actions
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.soundEffects}
                    onChange={(e) => handleSettingChange('soundEffects', e.target.checked)}
                    className="text-primary-500 focus:ring-primary-500 rounded"
                  />
                </label>
              </div>

              {/* Voice Recording */}
              <div>
                <label className={`flex items-center justify-between ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
                  <div>
                    <span className="font-medium">Voice Recording</span>
                    <p className={`text-sm ${theme === 'dark' ? 'text-surface-400' : 'text-surface-600'}`}>
                      Enable voice input
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.voiceEnabled}
                    onChange={(e) => handleSettingChange('voiceEnabled', e.target.checked)}
                    className="text-primary-500 focus:ring-primary-500 rounded"
                  />
                </label>
              </div>
            </div>
          )}

          {activeTab === 'automation' && (
            <div className="space-y-6">
              {/* Automation Service Status */}
              <div className={`p-4 rounded-lg border ${
                theme === 'dark' 
                  ? 'bg-surface-800 border-surface-700' 
                  : 'bg-surface-50 border-surface-200'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
                    Automation Service
                  </h3>
                  <div className={`flex items-center space-x-2 text-sm ${
                    automationService.isAvailable() ? 'text-green-500' : 'text-red-500'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${
                      automationService.isAvailable() ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    <span>{automationService.isAvailable() ? 'Connected' : 'Offline'}</span>
                  </div>
                </div>
                <div className={`text-sm ${theme === 'dark' ? 'text-surface-400' : 'text-surface-600'}`}>
                  {automationService.isAvailable() 
                    ? 'Python automation service is running and ready for Excel tasks.'
                    : 'Start the Python service to enable full Excel automation capabilities. Running in demo mode.'
                  }
                </div>
                <div className={`mt-3 text-xs ${theme === 'dark' ? 'text-surface-500' : 'text-surface-500'}`}>
                  Service URL: {automationService.getServiceInfo().url}
                </div>
              </div>

              {/* Automation Mode */}
              <div>
                <label className={`block text-sm font-medium mb-3 ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
                  Default Automation Mode
                </label>
                <div className="space-y-3">
                  {[
                    { 
                      value: 'visual' as const, 
                      label: 'Visual Mode', 
                      desc: 'Shows automation steps on screen - good for learning and verification',
                      icon: '👁️'
                    },
                    { 
                      value: 'background' as const, 
                      label: 'Background Mode', 
                      desc: 'Runs operations invisibly - faster for large datasets',
                      icon: '⚡'
                    }
                  ].map((option) => (
                    <label key={option.value} className={`
                      flex items-start space-x-3 cursor-pointer p-3 rounded-lg border transition-colors
                      ${settings.automationMode === option.value
                        ? theme === 'dark' 
                          ? 'bg-primary-500/10 border-primary-500' 
                          : 'bg-primary-50 border-primary-500'
                        : theme === 'dark'
                          ? 'border-surface-700 hover:bg-surface-800/50'
                          : 'border-surface-200 hover:bg-surface-50'
                      }
                    `}>
                      <input
                        type="radio"
                        name="automationMode"
                        value={option.value}
                        checked={settings.automationMode === option.value}
                        onChange={(e) => {
                          const newMode = e.target.value as AutomationMode;
                          handleSettingChange('automationMode', newMode);
                          automationService.setDefaultMode(newMode);
                        }}
                        className="mt-1 text-primary-500 focus:ring-primary-500"
                      />
                      <div className="flex-1">
                        <div className={`font-medium flex items-center space-x-2 ${
                          theme === 'dark' ? 'text-white' : 'text-surface-900'
                        }`}>
                          <span>{option.icon}</span>
                          <span>{option.label}</span>
                        </div>
                        <div className={`text-sm mt-1 ${
                          theme === 'dark' ? 'text-surface-400' : 'text-surface-600'
                        }`}>
                          {option.desc}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Task Preferences */}
              <div>
                <h4 className={`text-sm font-medium mb-3 ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
                  Task Preferences
                </h4>
                <div className="space-y-4">
                  {/* Auto-minimize */}
                  <label className={`flex items-center justify-between ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
                    <div>
                      <span className="font-medium">Auto-minimize after task</span>
                      <p className={`text-sm ${theme === 'dark' ? 'text-surface-400' : 'text-surface-600'}`}>
                        Automatically minimize when task completes
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.autoMinimize}
                      onChange={(e) => handleSettingChange('autoMinimize', e.target.checked)}
                      className="text-primary-500 focus:ring-primary-500 rounded"
                    />
                  </label>

                  {/* Show progress notifications */}
                  <label className={`flex items-center justify-between ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
                    <div>
                      <span className="font-medium">Progress notifications</span>
                      <p className={`text-sm ${theme === 'dark' ? 'text-surface-400' : 'text-surface-600'}`}>
                        Show system notifications for task progress
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.notifications}
                      onChange={(e) => handleSettingChange('notifications', e.target.checked)}
                      className="text-primary-500 focus:ring-primary-500 rounded"
                    />
                  </label>
                </div>
              </div>

              {/* Quick Actions */}
              <div>
                <h4 className={`text-sm font-medium mb-3 ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
                  Quick Actions
                </h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => automationService.clearCompletedTasks()}
                    className={`
                      px-3 py-1.5 text-xs rounded-lg border transition-colors
                      ${theme === 'dark'
                        ? 'bg-surface-800 border-surface-700 text-surface-300 hover:bg-surface-700'
                        : 'bg-white border-surface-300 text-surface-700 hover:bg-surface-50'
                      }
                    `}
                  >
                    Clear Completed Tasks
                  </button>
                  
                  <button
                    onClick={() => {
                      const queueLength = automationService.getQueueLength();
                      alert(`${queueLength} tasks in queue`);
                    }}
                    className={`
                      px-3 py-1.5 text-xs rounded-lg border transition-colors
                      ${theme === 'dark'
                        ? 'bg-surface-800 border-surface-700 text-surface-300 hover:bg-surface-700'
                        : 'bg-white border-surface-300 text-surface-700 hover:bg-surface-50'
                      }
                    `}
                  >
                    View Task Queue ({automationService.getQueueLength()})
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="space-y-6">
              {/* API Configuration */}
              <div>
                <label className={`block text-sm font-medium mb-3 ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
                  AI Provider
                </label>
                <select
                  value={settings.apiProvider}
                  onChange={(e) => handleSettingChange('apiProvider', e.target.value as 'openai' | 'anthropic')}
                  className={`
                    w-full px-3 py-2 rounded-lg border focus:ring-2 focus:ring-primary-500 focus:border-transparent
                    ${theme === 'dark' 
                      ? 'border-surface-700 bg-surface-800 text-white' 
                      : 'border-surface-300 bg-white text-surface-900'
                    }
                  `}
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                </select>
              </div>

              {/* OpenAI API Key */}
              <div>
                <label className={`block text-sm font-medium mb-3 ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
                  OpenAI API Key
                </label>
                <div className="relative">
                  <input
                    type={showOpenAIKey ? 'text' : 'password'}
                    value={settings.openaiApiKey}
                    onChange={(e) => handleSettingChange('openaiApiKey', e.target.value)}
                    placeholder="sk-..."
                    className={`
                      w-full px-3 py-2 pr-20 rounded-lg border focus:ring-2 focus:ring-primary-500 focus:border-transparent
                      ${theme === 'dark' 
                        ? 'border-surface-700 bg-surface-800 text-white placeholder-surface-500' 
                        : 'border-surface-300 bg-white text-surface-900 placeholder-surface-400'
                      }
                    `}
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
                    {settings.openaiApiKey && (
                      <button
                        type="button"
                        onClick={() => testConnection('openai')}
                        disabled={testingConnection === 'openai'}
                        className={`
                          text-xs px-2 py-1 rounded transition-colors duration-200
                          ${connectionStatus.openai === 'success' 
                            ? 'bg-green-500 text-white' 
                            : connectionStatus.openai === 'error'
                            ? 'bg-red-500 text-white'
                            : theme === 'dark'
                            ? 'bg-surface-700 text-surface-300 hover:bg-surface-600'
                            : 'bg-surface-200 text-surface-600 hover:bg-surface-300'
                          }
                        `}
                      >
                        {testingConnection === 'openai' ? '...' : connectionStatus.openai === 'success' ? '✓' : connectionStatus.openai === 'error' ? '✗' : 'Test'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                      className={`
                        p-1 rounded
                        ${theme === 'dark' ? 'text-surface-400 hover:text-white' : 'text-surface-600 hover:text-surface-900'}
                      `}
                    >
                      {showOpenAIKey ? '👁️' : '🔒'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Anthropic API Key */}
              <div>
                <label className={`block text-sm font-medium mb-3 ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
                  Anthropic API Key
                </label>
                <div className="relative">
                  <input
                    type={showAnthropicKey ? 'text' : 'password'}
                    value={settings.anthropicApiKey}
                    onChange={(e) => handleSettingChange('anthropicApiKey', e.target.value)}
                    placeholder="sk-ant-..."
                    className={`
                      w-full px-3 py-2 pr-20 rounded-lg border focus:ring-2 focus:ring-primary-500 focus:border-transparent
                      ${theme === 'dark' 
                        ? 'border-surface-700 bg-surface-800 text-white placeholder-surface-500' 
                        : 'border-surface-300 bg-white text-surface-900 placeholder-surface-400'
                      }
                    `}
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
                    {settings.anthropicApiKey && (
                      <button
                        type="button"
                        onClick={() => testConnection('anthropic')}
                        disabled={testingConnection === 'anthropic'}
                        className={`
                          text-xs px-2 py-1 rounded transition-colors duration-200
                          ${connectionStatus.anthropic === 'success' 
                            ? 'bg-green-500 text-white' 
                            : connectionStatus.anthropic === 'error'
                            ? 'bg-red-500 text-white'
                            : theme === 'dark'
                            ? 'bg-surface-700 text-surface-300 hover:bg-surface-600'
                            : 'bg-surface-200 text-surface-600 hover:bg-surface-300'
                          }
                        `}
                      >
                        {testingConnection === 'anthropic' ? '...' : connectionStatus.anthropic === 'success' ? '✓' : connectionStatus.anthropic === 'error' ? '✗' : 'Test'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                      className={`
                        p-1 rounded
                        ${theme === 'dark' ? 'text-surface-400 hover:text-white' : 'text-surface-600 hover:text-surface-900'}
                      `}
                    >
                      {showAnthropicKey ? '👁️' : '🔒'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Current Provider Status */}
              <div className={`
                p-3 rounded-lg border
                ${theme === 'dark' 
                  ? 'border-surface-700 bg-surface-800/50' 
                  : 'border-surface-200 bg-surface-50'
                }
              `}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
                    Current Provider
                  </span>
                  <span className={`
                    px-2 py-1 text-xs rounded
                    ${settings.apiProvider === 'openai' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-orange-500 text-white'
                    }
                  `}>
                    {settings.apiProvider === 'openai' ? 'OpenAI' : 'Anthropic'}
                  </span>
                </div>
                <p className={`text-xs ${theme === 'dark' ? 'text-surface-400' : 'text-surface-600'}`}>
                  {settings.apiProvider === 'openai' 
                    ? 'Using GPT-4 for responses. Requires OpenAI API key.' 
                    : 'Using Claude for responses. Requires Anthropic API key.'
                  }
                </p>
              </div>

              {/* Chat Actions */}
              <div className="space-y-3">
                <label className={`block text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
                  Chat Management
                </label>
                
                <button
                  onClick={onExportChat}
                  className={`
                    w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-lg border transition-colors duration-200
                    ${theme === 'dark' 
                      ? 'border-surface-700 bg-surface-800 hover:bg-surface-700 text-white' 
                      : 'border-surface-200 bg-surface-50 hover:bg-surface-100 text-surface-900'
                    }
                  `}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Export Chat History</span>
                </button>

                <button
                  onClick={handleClearChat}
                  className={`
                    w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-lg transition-colors duration-200
                    ${confirmClear
                      ? 'bg-error-500 hover:bg-error-600 text-white border border-error-500'
                      : theme === 'dark'
                        ? 'border-surface-700 bg-surface-800 hover:bg-surface-700 text-white border'
                        : 'border-surface-200 bg-surface-50 hover:bg-surface-100 text-surface-900 border'
                    }
                  `}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>{confirmClear ? 'Click again to confirm' : 'Clear Chat History'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`
          border-t p-4 flex justify-between items-center
          ${theme === 'dark' ? 'border-surface-700' : 'border-surface-200'}
        `}>
          <div className={`text-xs ${theme === 'dark' ? 'text-surface-500' : 'text-surface-400'}`}>
            Nubia v1.0.0
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className={`
                px-4 py-2 rounded-lg transition-colors duration-200
                ${theme === 'dark' 
                  ? 'text-surface-400 hover:text-white' 
                  : 'text-surface-600 hover:text-surface-900'
                }
              `}
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
    </div>
  );
};