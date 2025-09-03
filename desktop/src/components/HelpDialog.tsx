import React, { useState } from 'react';
import { analytics } from '../services/analytics';

interface HelpDialogProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'light' | 'dark';
}

interface HelpSection {
  id: string;
  title: string;
  icon: string;
  content: React.ReactNode;
}

export const HelpDialog: React.FC<HelpDialogProps> = ({
  isOpen,
  onClose,
  theme = 'dark'
}) => {
  const [activeSection, setActiveSection] = useState('getting-started');
  const [searchQuery, setSearchQuery] = useState('');

  const helpSections: HelpSection[] = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: '🚀',
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-white">
            Welcome to Nubia
          </h3>
          
          <div className="space-y-3">
            <div>
              <h4 className="font-medium text-surface-800 dark:text-surface-200 mb-2">
                1. Setting up Excel Integration
              </h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-surface-600 dark:text-surface-400">
                <li>Ensure Microsoft Excel is installed on your computer</li>
                <li>Enable Excel automation in Windows settings if prompted</li>
                <li>Grant Nubia permission to interact with Excel when requested</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-surface-800 dark:text-surface-200 mb-2">
                2. Configuring AI Provider
              </h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-surface-600 dark:text-surface-400">
                <li>Go to Settings → API Configuration</li>
                <li>Choose your preferred AI provider (OpenAI or Anthropic)</li>
                <li>Enter your API key and validate the connection</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-surface-800 dark:text-surface-200 mb-2">
                3. Your First Automation
              </h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-surface-600 dark:text-surface-400">
                <li>Open an Excel file or create a new workbook</li>
                <li>Describe what you want to do in natural language</li>
                <li>Review the suggested automation before executing</li>
              </ul>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'automation-guide',
      title: 'Automation Guide',
      icon: '⚡',
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-white">
            How to Use Automation
          </h3>
          
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-surface-800 dark:text-surface-200 mb-2">
                Natural Language Commands
              </h4>
              <p className="text-sm text-surface-600 dark:text-surface-400 mb-2">
                Describe your tasks in plain English. Here are some examples:
              </p>
              <div className="bg-surface-50 dark:bg-surface-800 rounded-lg p-3 space-y-2">
                <div className="text-sm">
                  <span className="text-blue-600 dark:text-blue-400">"Format column A as currency"</span>
                </div>
                <div className="text-sm">
                  <span className="text-blue-600 dark:text-blue-400">"Create a chart from data in B2:D10"</span>
                </div>
                <div className="text-sm">
                  <span className="text-blue-600 dark:text-blue-400">"Find all cells containing 'error' and highlight them red"</span>
                </div>
                <div className="text-sm">
                  <span className="text-blue-600 dark:text-blue-400">"Sort the table by date column descending"</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium text-surface-800 dark:text-surface-200 mb-2">
                Automation Modes
              </h4>
              <ul className="space-y-2">
                <li className="flex items-start space-x-2">
                  <span className="text-green-500">🎯</span>
                  <div>
                    <span className="font-medium text-sm text-surface-700 dark:text-surface-300">Visual Mode</span>
                    <p className="text-xs text-surface-600 dark:text-surface-400">
                      See each step as it happens in Excel
                    </p>
                  </div>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-blue-500">⚡</span>
                  <div>
                    <span className="font-medium text-sm text-surface-700 dark:text-surface-300">Background Mode</span>
                    <p className="text-xs text-surface-600 dark:text-surface-400">
                      Faster execution without visual feedback
                    </p>
                  </div>
                </li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-surface-800 dark:text-surface-200 mb-2">
                Safety Features
              </h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-surface-600 dark:text-surface-400">
                <li>All automations are previewed before execution</li>
                <li>Automatic backup creation before major changes</li>
                <li>Undo support for most operations</li>
                <li>Confirmation prompts for destructive actions</li>
              </ul>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'keyboard-shortcuts',
      title: 'Keyboard Shortcuts',
      icon: '⌨️',
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-white">
            Keyboard Shortcuts
          </h3>
          
          <div className="grid grid-cols-1 gap-4">
            <div>
              <h4 className="font-medium text-surface-800 dark:text-surface-200 mb-3">
                General
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-surface-600 dark:text-surface-400">Open chat</span>
                  <kbd className="px-2 py-1 bg-surface-100 dark:bg-surface-700 rounded text-xs font-mono">
                    Ctrl + /
                  </kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-surface-600 dark:text-surface-400">New conversation</span>
                  <kbd className="px-2 py-1 bg-surface-100 dark:bg-surface-700 rounded text-xs font-mono">
                    Ctrl + N
                  </kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-surface-600 dark:text-surface-400">Settings</span>
                  <kbd className="px-2 py-1 bg-surface-100 dark:bg-surface-700 rounded text-xs font-mono">
                    Ctrl + ,
                  </kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-surface-600 dark:text-surface-400">Help</span>
                  <kbd className="px-2 py-1 bg-surface-100 dark:bg-surface-700 rounded text-xs font-mono">
                    F1
                  </kbd>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium text-surface-800 dark:text-surface-200 mb-3">
                Chat & Automation
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-surface-600 dark:text-surface-400">Send message</span>
                  <kbd className="px-2 py-1 bg-surface-100 dark:bg-surface-700 rounded text-xs font-mono">
                    Enter
                  </kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-surface-600 dark:text-surface-400">New line in message</span>
                  <kbd className="px-2 py-1 bg-surface-100 dark:bg-surface-700 rounded text-xs font-mono">
                    Shift + Enter
                  </kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-surface-600 dark:text-surface-400">Stop automation</span>
                  <kbd className="px-2 py-1 bg-surface-100 dark:bg-surface-700 rounded text-xs font-mono">
                    Esc
                  </kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-surface-600 dark:text-surface-400">Execute suggested action</span>
                  <kbd className="px-2 py-1 bg-surface-100 dark:bg-surface-700 rounded text-xs font-mono">
                    Ctrl + Enter
                  </kbd>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium text-surface-800 dark:text-surface-200 mb-3">
                Window Management
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-surface-600 dark:text-surface-400">Toggle fullscreen</span>
                  <kbd className="px-2 py-1 bg-surface-100 dark:bg-surface-700 rounded text-xs font-mono">
                    F11
                  </kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-surface-600 dark:text-surface-400">Minimize window</span>
                  <kbd className="px-2 py-1 bg-surface-100 dark:bg-surface-700 rounded text-xs font-mono">
                    Ctrl + M
                  </kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-surface-600 dark:text-surface-400">Toggle sidebar</span>
                  <kbd className="px-2 py-1 bg-surface-100 dark:bg-surface-700 rounded text-xs font-mono">
                    Ctrl + B
                  </kbd>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      icon: '🛠️',
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-white">
            Common Issues & Solutions
          </h3>
          
          <div className="space-y-4">
            <div className="border border-surface-200 dark:border-surface-700 rounded-lg p-4">
              <h4 className="font-medium text-surface-800 dark:text-surface-200 mb-2">
                Excel Connection Issues
              </h4>
              <div className="space-y-2 text-sm text-surface-600 dark:text-surface-400">
                <p><strong>Problem:</strong> "Cannot connect to Excel" error</p>
                <p><strong>Solutions:</strong></p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Ensure Excel is installed and can be launched manually</li>
                  <li>Close all Excel windows and restart Nubia</li>
                  <li>Run Nubia as administrator if on Windows</li>
                  <li>Check Windows COM security settings</li>
                </ul>
              </div>
            </div>
            
            <div className="border border-surface-200 dark:border-surface-700 rounded-lg p-4">
              <h4 className="font-medium text-surface-800 dark:text-surface-200 mb-2">
                API Key Issues
              </h4>
              <div className="space-y-2 text-sm text-surface-600 dark:text-surface-400">
                <p><strong>Problem:</strong> "Invalid API key" or authentication errors</p>
                <p><strong>Solutions:</strong></p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Verify your API key is correct and hasn't expired</li>
                  <li>Check that you have sufficient credits/usage quota</li>
                  <li>Ensure the API key has the required permissions</li>
                  <li>Try regenerating a new API key</li>
                </ul>
              </div>
            </div>
            
            <div className="border border-surface-200 dark:border-surface-700 rounded-lg p-4">
              <h4 className="font-medium text-surface-800 dark:text-surface-200 mb-2">
                Performance Issues
              </h4>
              <div className="space-y-2 text-sm text-surface-600 dark:text-surface-400">
                <p><strong>Problem:</strong> Slow automation or app responsiveness</p>
                <p><strong>Solutions:</strong></p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Close other resource-intensive applications</li>
                  <li>Use background mode for complex automations</li>
                  <li>Break large tasks into smaller chunks</li>
                  <li>Check available memory and disk space</li>
                </ul>
              </div>
            </div>
            
            <div className="border border-surface-200 dark:border-surface-700 rounded-lg p-4">
              <h4 className="font-medium text-surface-800 dark:text-surface-200 mb-2">
                Automation Failures
              </h4>
              <div className="space-y-2 text-sm text-surface-600 dark:text-surface-400">
                <p><strong>Problem:</strong> Automation stops or produces unexpected results</p>
                <p><strong>Solutions:</strong></p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Try rephrasing your request more specifically</li>
                  <li>Ensure the target cells/ranges are accessible</li>
                  <li>Check if the workbook is protected or read-only</li>
                  <li>Use visual mode to see what's happening</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'support',
      title: 'Support & Contact',
      icon: '💬',
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-white">
            Get Help & Support
          </h3>
          
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-2">
                📚 Documentation
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
                Comprehensive guides and tutorials
              </p>
              <button
                onClick={() => {
                  analytics.track('help_documentation_clicked');
                  // Open documentation
                }}
                className="text-sm text-blue-600 dark:text-blue-400 underline hover:no-underline"
              >
                Visit Documentation →
              </button>
            </div>
            
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h4 className="font-medium text-green-800 dark:text-green-300 mb-2">
                💬 Community Forum
              </h4>
              <p className="text-sm text-green-700 dark:text-green-300 mb-2">
                Ask questions and share tips with other users
              </p>
              <button
                onClick={() => {
                  analytics.track('help_community_clicked');
                  // Open community forum
                }}
                className="text-sm text-green-600 dark:text-green-400 underline hover:no-underline"
              >
                Join Community →
              </button>
            </div>
            
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
              <h4 className="font-medium text-purple-800 dark:text-purple-300 mb-2">
                ✉️ Email Support
              </h4>
              <p className="text-sm text-purple-700 dark:text-purple-300 mb-2">
                Get direct help from our support team
              </p>
              <button
                onClick={() => {
                  analytics.track('help_email_support_clicked');
                  window.open('mailto:support@nubia.ai?subject=Nubia%20Support%20Request');
                }}
                className="text-sm text-purple-600 dark:text-purple-400 underline hover:no-underline"
              >
                support@nubia.ai
              </button>
            </div>
            
            <div className="border border-surface-200 dark:border-surface-700 rounded-lg p-4">
              <h4 className="font-medium text-surface-800 dark:text-surface-200 mb-2">
                🐛 Report a Bug
              </h4>
              <p className="text-sm text-surface-600 dark:text-surface-400 mb-2">
                Help us improve by reporting issues
              </p>
              <button
                onClick={() => {
                  analytics.track('help_bug_report_clicked');
                  // Open bug report form
                }}
                className="text-sm text-surface-600 dark:text-surface-400 underline hover:no-underline"
              >
                Report Issue →
              </button>
            </div>
            
            <div className="border border-surface-200 dark:border-surface-700 rounded-lg p-4">
              <h4 className="font-medium text-surface-800 dark:text-surface-200 mb-2">
                💡 Feature Request
              </h4>
              <p className="text-sm text-surface-600 dark:text-surface-400 mb-2">
                Suggest new features or improvements
              </p>
              <button
                onClick={() => {
                  analytics.track('help_feature_request_clicked');
                  // Open feature request form
                }}
                className="text-sm text-surface-600 dark:text-surface-400 underline hover:no-underline"
              >
                Submit Request →
              </button>
            </div>
          </div>
        </div>
      )
    }
  ];

  const filteredSections = searchQuery
    ? helpSections.filter(section =>
        section.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        section.id.includes(searchQuery.toLowerCase())
      )
    : helpSections;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`w-full max-w-4xl h-[80vh] bg-white dark:bg-surface-800 rounded-xl shadow-2xl overflow-hidden ${
        theme === 'dark' ? 'dark' : ''
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-surface-200 dark:border-surface-700">
          <h2 className="text-xl font-semibold text-surface-900 dark:text-white">
            Help & Documentation
          </h2>
          
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex h-full">
          {/* Sidebar */}
          <div className="w-64 bg-surface-50 dark:bg-surface-900 border-r border-surface-200 dark:border-surface-700 overflow-y-auto">
            {/* Search */}
            <div className="p-4 border-b border-surface-200 dark:border-surface-700">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search help..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 pl-10 text-sm border border-surface-300 dark:border-surface-600 rounded-lg bg-white dark:bg-surface-800 text-surface-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
                <svg className="w-4 h-4 text-surface-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Navigation */}
            <div className="p-4 space-y-1">
              {filteredSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => {
                    setActiveSection(section.id);
                    analytics.track('help_section_viewed', { section: section.id });
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center space-x-3 ${
                    activeSection === section.id
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'
                  }`}
                >
                  <span>{section.icon}</span>
                  <span className="text-sm font-medium">{section.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {helpSections.find(s => s.activeSection === activeSection)?.content || 
               helpSections.find(s => s.id === activeSection)?.content}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpDialog;