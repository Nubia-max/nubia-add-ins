import React, { useState, useEffect } from 'react';
import { licensing } from '../services/licensing';
import type { LicenseValidationResult, LicenseInfo, TrialInfo } from '../services/licensing';

interface LicensePanelProps {
  theme?: 'light' | 'dark';
  onClose?: () => void;
}

export const LicensePanel: React.FC<LicensePanelProps> = ({
  theme = 'dark',
  onClose
}) => {
  const [validation, setValidation] = useState<LicenseValidationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [licenseKey, setLicenseKey] = useState('');
  const [email, setEmail] = useState('');
  const [showActivation, setShowActivation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingUsage, setRemainingUsage] = useState({ tasks: 0, tokens: 0 });

  useEffect(() => {
    loadLicenseStatus();
  }, []);

  const loadLicenseStatus = async () => {
    try {
      setLoading(true);
      const result = await licensing.validateLicense();
      setValidation(result);
      setRemainingUsage(licensing.getRemainingUsage());
    } catch (error) {
      console.error('Failed to load license status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleActivateLicense = async () => {
    if (!licenseKey.trim() || !email.trim()) {
      setError('Please enter both license key and email');
      return;
    }

    setActivating(true);
    setError(null);

    try {
      const result = await licensing.activateLicense(licenseKey, email);
      
      if (result.isValid) {
        setValidation(result);
        setRemainingUsage(licensing.getRemainingUsage());
        setShowActivation(false);
        setLicenseKey('');
        setEmail('');
      } else {
        setError(result.error || 'License activation failed');
      }
    } catch (error) {
      setError('Failed to activate license. Please check your internet connection.');
    } finally {
      setActivating(false);
    }
  };

  const handleDeactivateLicense = async () => {
    if (window.confirm('Are you sure you want to deactivate this license? You will need to reactivate it to continue using premium features.')) {
      try {
        await licensing.deactivateLicense();
        await loadLicenseStatus();
      } catch (error) {
        console.error('Failed to deactivate license:', error);
      }
    }
  };

  const handleOpenPurchase = () => {
    licensing.openPurchaseUrl();
  };

  const formatUsage = (current: number, max: number): string => {
    if (max === -1) return 'Unlimited';
    return `${current.toLocaleString()} / ${max.toLocaleString()}`;
  };

  const getStatusColor = () => {
    if (!validation) return theme === 'dark' ? 'text-surface-300' : 'text-surface-700';
    
    if (validation.isValid) {
      if (validation.licenseInfo) return 'text-green-500';
      if (validation.trialInfo && !validation.trialInfo.isExpired) return 'text-blue-500';
    }
    
    return 'text-red-500';
  };

  const getStatusIcon = () => {
    if (!validation) return '⏳';
    
    if (validation.isValid) {
      if (validation.licenseInfo) return '✅';
      if (validation.trialInfo) return '🔄';
    }
    
    return '❌';
  };

  const getStatusText = () => {
    if (!validation) return 'Loading...';
    
    if (validation.error) return validation.error;
    
    if (validation.licenseInfo) {
      return `Licensed (${validation.licenseInfo.type})`;
    }
    
    if (validation.trialInfo) {
      if (validation.trialInfo.isExpired) {
        return 'Trial expired';
      }
      return `Trial (${validation.trialInfo.daysRemaining} days left)`;
    }
    
    return 'No license';
  };

  if (loading) {
    return (
      <div className={`license-panel p-4 ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3">Loading license information...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`license-panel p-4 space-y-4 ${
      theme === 'dark' ? 'text-white' : 'text-surface-900'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`font-semibold text-lg ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
            License & Usage
          </h3>
          <div className={`text-sm ${getStatusColor()}`}>
            {getStatusIcon()} {getStatusText()}
          </div>
        </div>
        
        {onClose && (
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              theme === 'dark'
                ? 'hover:bg-surface-800 text-surface-400'
                : 'hover:bg-surface-200 text-surface-600'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* License Info Card */}
      <div className={`p-4 rounded-lg border ${
        theme === 'dark' 
          ? 'bg-surface-800 border-surface-700' 
          : 'bg-surface-50 border-surface-200'
      }`}>
        {validation?.licenseInfo && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
                Licensed Version
              </h4>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                validation.licenseInfo.type === 'enterprise' ? 'bg-purple-500 text-white' :
                validation.licenseInfo.type === 'professional' ? 'bg-blue-500 text-white' :
                'bg-green-500 text-white'
              }`}>
                {validation.licenseInfo.type.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className={theme === 'dark' ? 'text-surface-400' : 'text-surface-600'}>Email:</span>
                <p className="font-medium">{validation.licenseInfo.email}</p>
              </div>
              <div>
                <span className={theme === 'dark' ? 'text-surface-400' : 'text-surface-600'}>Expires:</span>
                <p className="font-medium">
                  {validation.licenseInfo.expiryDate 
                    ? validation.licenseInfo.expiryDate.toLocaleDateString()
                    : 'Never'
                  }
                </p>
              </div>
            </div>

            {/* Feature List */}
            <div className="mt-4">
              <h5 className={`text-sm font-medium mb-2 ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
                Features:
              </h5>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center">
                  <span className={validation.licenseInfo.features.advancedAutomation ? 'text-green-500' : 'text-red-500'}>
                    {validation.licenseInfo.features.advancedAutomation ? '✅' : '❌'}
                  </span>
                  <span className="ml-2">Advanced Automation</span>
                </div>
                <div className="flex items-center">
                  <span className={validation.licenseInfo.features.cloudSync ? 'text-green-500' : 'text-red-500'}>
                    {validation.licenseInfo.features.cloudSync ? '✅' : '❌'}
                  </span>
                  <span className="ml-2">Cloud Sync</span>
                </div>
                <div className="flex items-center">
                  <span className={validation.licenseInfo.features.prioritySupport ? 'text-green-500' : 'text-red-500'}>
                    {validation.licenseInfo.features.prioritySupport ? '✅' : '❌'}
                  </span>
                  <span className="ml-2">Priority Support</span>
                </div>
                <div className="flex items-center">
                  <span className={validation.licenseInfo.features.apiAccess ? 'text-green-500' : 'text-red-500'}>
                    {validation.licenseInfo.features.apiAccess ? '✅' : '❌'}
                  </span>
                  <span className="ml-2">API Access</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleDeactivateLicense}
              className={`w-full mt-4 px-4 py-2 rounded-lg border transition-colors text-sm ${
                theme === 'dark'
                  ? 'border-red-700 text-red-400 hover:bg-red-700/20'
                  : 'border-red-300 text-red-700 hover:bg-red-50'
              }`}
            >
              Deactivate License
            </button>
          </div>
        )}

        {validation?.trialInfo && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
                Trial Version
              </h4>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                validation.trialInfo.daysRemaining > 7 ? 'bg-green-500 text-white' :
                validation.trialInfo.daysRemaining > 3 ? 'bg-yellow-500 text-white' :
                'bg-red-500 text-white'
              }`}>
                {validation.trialInfo.daysRemaining} DAYS LEFT
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className={`text-sm ${theme === 'dark' ? 'text-surface-400' : 'text-surface-600'}`}>
                  Trial Period:
                </span>
                <span className="text-sm font-medium">
                  {validation.trialInfo.startDate.toLocaleDateString()} - {validation.trialInfo.endDate.toLocaleDateString()}
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowActivation(true)}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Upgrade to Licensed Version
            </button>
          </div>
        )}

        {!validation?.isValid && (
          <div className="space-y-3">
            <h4 className={`font-medium text-red-500`}>
              {validation?.error || 'No Valid License'}
            </h4>
            
            <div className="space-y-2">
              <button
                onClick={() => setShowActivation(true)}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Activate License
              </button>
              
              <button
                onClick={handleOpenPurchase}
                className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                  theme === 'dark'
                    ? 'border-surface-700 text-surface-300 hover:bg-surface-700'
                    : 'border-surface-300 text-surface-700 hover:bg-surface-100'
                }`}
              >
                Purchase License
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Usage Stats */}
      <div className={`p-4 rounded-lg border ${
        theme === 'dark' 
          ? 'bg-surface-800 border-surface-700' 
          : 'bg-surface-50 border-surface-200'
      }`}>
        <h4 className={`font-medium mb-3 ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
          Usage Statistics
        </h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className={`text-sm ${theme === 'dark' ? 'text-surface-400' : 'text-surface-600'}`}>
              Tasks This Month:
            </span>
            <p className="font-medium text-lg">
              {validation?.licenseInfo 
                ? formatUsage(
                    validation.licenseInfo.features.maxTasks - remainingUsage.tasks,
                    validation.licenseInfo.features.maxTasks
                  )
                : validation?.trialInfo 
                ? `${validation.trialInfo.tasksUsed} / 50`
                : '0'
              }
            </p>
          </div>
          
          <div>
            <span className={`text-sm ${theme === 'dark' ? 'text-surface-400' : 'text-surface-600'}`}>
              Tokens This Month:
            </span>
            <p className="font-medium text-lg">
              {validation?.licenseInfo 
                ? formatUsage(
                    validation.licenseInfo.features.maxTokens - remainingUsage.tokens,
                    validation.licenseInfo.features.maxTokens
                  )
                : validation?.trialInfo 
                ? `${validation.trialInfo.tokensUsed.toLocaleString()} / 100,000`
                : '0'
              }
            </p>
          </div>
        </div>
      </div>

      {/* License Activation Modal */}
      {showActivation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`w-full max-w-md p-6 rounded-lg ${
            theme === 'dark' ? 'bg-surface-800' : 'bg-white'
          }`}>
            <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
              Activate License
            </h3>

            {error && (
              <div className="mb-4 p-3 rounded bg-red-500/10 border border-red-500/20">
                <p className="text-red-500 text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-white' : 'text-surface-900'
                }`}>
                  License Key:
                </label>
                <input
                  type="text"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  placeholder="Enter your license key"
                  className={`w-full px-3 py-2 rounded border focus:ring-2 focus:ring-blue-500 ${
                    theme === 'dark'
                      ? 'bg-surface-900 border-surface-600 text-white'
                      : 'bg-white border-surface-300 text-surface-900'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-white' : 'text-surface-900'
                }`}>
                  Email:
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className={`w-full px-3 py-2 rounded border focus:ring-2 focus:ring-blue-500 ${
                    theme === 'dark'
                      ? 'bg-surface-900 border-surface-600 text-white'
                      : 'bg-white border-surface-300 text-surface-900'
                  }`}
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowActivation(false);
                  setError(null);
                  setLicenseKey('');
                  setEmail('');
                }}
                className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${
                  theme === 'dark'
                    ? 'border-surface-700 text-surface-300 hover:bg-surface-700'
                    : 'border-surface-300 text-surface-700 hover:bg-surface-100'
                }`}
                disabled={activating}
              >
                Cancel
              </button>
              
              <button
                onClick={handleActivateLicense}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                disabled={activating}
              >
                {activating ? 'Activating...' : 'Activate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LicensePanel;