import React from 'react';
import { environment } from '../config/environment';

interface AboutDialogProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'light' | 'dark';
}

export const AboutDialog: React.FC<AboutDialogProps> = ({
  isOpen,
  onClose,
  theme = 'dark'
}) => {
  if (!isOpen) return null;

  const appVersion = environment.getAppVersion();
  const buildNumber = environment.getBuildNumber();
  const platform = environment.getPlatform();

  const handleLinkClick = (url: string, eventName: string) => {
    if (window.electron) {
      window.electron.invoke('open-external', url);
    }
    
    // Track link clicks
    if (window.analytics) {
      window.analytics.track(eventName);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`w-full max-w-md bg-white dark:bg-surface-800 rounded-xl shadow-2xl overflow-hidden ${
        theme === 'dark' ? 'dark' : ''
      }`}>
        {/* Header */}
        <div className="relative bg-gradient-to-br from-blue-500 to-purple-600 p-6 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            
            <div>
              <h2 className="text-2xl font-bold">Nubia</h2>
              <p className="text-white/90">Intelligent Excel Automation</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Version Info */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className={`text-sm font-medium ${
                theme === 'dark' ? 'text-surface-300' : 'text-surface-700'
              }`}>
                Version:
              </span>
              <span className={`text-sm ${
                theme === 'dark' ? 'text-white' : 'text-surface-900'
              }`}>
                {appVersion}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className={`text-sm font-medium ${
                theme === 'dark' ? 'text-surface-300' : 'text-surface-700'
              }`}>
                Build:
              </span>
              <span className={`text-sm ${
                theme === 'dark' ? 'text-white' : 'text-surface-900'
              }`}>
                {buildNumber}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className={`text-sm font-medium ${
                theme === 'dark' ? 'text-surface-300' : 'text-surface-700'
              }`}>
                Platform:
              </span>
              <span className={`text-sm ${
                theme === 'dark' ? 'text-white' : 'text-surface-900'
              }`}>
                {platform === 'win32' ? 'Windows' : 
                 platform === 'darwin' ? 'macOS' : 
                 platform === 'linux' ? 'Linux' : platform}
              </span>
            </div>
          </div>

          {/* Description */}
          <div>
            <p className={`text-sm leading-relaxed ${
              theme === 'dark' ? 'text-surface-300' : 'text-surface-600'
            }`}>
              Nubia is an intelligent Excel automation tool that helps you streamline your workflows 
              using natural language processing and AI-powered automation. Transform your Excel tasks 
              from tedious manual work into simple conversations.
            </p>
          </div>

          {/* Features */}
          <div>
            <h3 className={`text-sm font-semibold mb-3 ${
              theme === 'dark' ? 'text-white' : 'text-surface-900'
            }`}>
              Key Features:
            </h3>
            <ul className={`space-y-2 text-sm ${
              theme === 'dark' ? 'text-surface-300' : 'text-surface-600'
            }`}>
              <li className="flex items-start space-x-2">
                <span className="text-green-500 mt-0.5">•</span>
                <span>Natural language Excel automation</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-blue-500 mt-0.5">•</span>
                <span>AI-powered task understanding</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-purple-500 mt-0.5">•</span>
                <span>Safe and secure automation</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-yellow-500 mt-0.5">•</span>
                <span>Visual and background execution modes</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-red-500 mt-0.5">•</span>
                <span>Comprehensive audit logging</span>
              </li>
            </ul>
          </div>

          {/* Links */}
          <div className="space-y-3">
            <button
              onClick={() => handleLinkClick('https://nubia.ai', 'about_website_clicked')}
              className={`w-full p-3 rounded-lg border transition-colors text-left flex items-center justify-between ${
                theme === 'dark'
                  ? 'border-surface-600 hover:bg-surface-700 text-surface-300'
                  : 'border-surface-300 hover:bg-surface-50 text-surface-700'
              }`}
            >
              <div className="flex items-center space-x-3">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
                </svg>
                <div>
                  <span className="text-sm font-medium">Visit Website</span>
                  <p className="text-xs opacity-75">nubia.ai</p>
                </div>
              </div>
              <svg className="w-4 h-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>

            <button
              onClick={() => handleLinkClick('https://docs.nubia.ai', 'about_docs_clicked')}
              className={`w-full p-3 rounded-lg border transition-colors text-left flex items-center justify-between ${
                theme === 'dark'
                  ? 'border-surface-600 hover:bg-surface-700 text-surface-300'
                  : 'border-surface-300 hover:bg-surface-50 text-surface-700'
              }`}
            >
              <div className="flex items-center space-x-3">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div>
                  <span className="text-sm font-medium">Documentation</span>
                  <p className="text-xs opacity-75">Learn how to use Nubia</p>
                </div>
              </div>
              <svg className="w-4 h-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>

            <button
              onClick={() => handleLinkClick('mailto:support@nubia.ai', 'about_support_clicked')}
              className={`w-full p-3 rounded-lg border transition-colors text-left flex items-center justify-between ${
                theme === 'dark'
                  ? 'border-surface-600 hover:bg-surface-700 text-surface-300'
                  : 'border-surface-300 hover:bg-surface-50 text-surface-700'
              }`}
            >
              <div className="flex items-center space-x-3">
                <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <div>
                  <span className="text-sm font-medium">Get Support</span>
                  <p className="text-xs opacity-75">support@nubia.ai</p>
                </div>
              </div>
              <svg className="w-4 h-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          </div>

          {/* Copyright */}
          <div className={`pt-4 border-t ${
            theme === 'dark' ? 'border-surface-700' : 'border-surface-200'
          }`}>
            <p className={`text-xs text-center ${
              theme === 'dark' ? 'text-surface-500' : 'text-surface-400'
            }`}>
              © 2024 Nubia Team. All rights reserved.
            </p>
            <p className={`text-xs text-center mt-1 ${
              theme === 'dark' ? 'text-surface-500' : 'text-surface-400'
            }`}>
              Made with ❤️ for Excel power users
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutDialog;