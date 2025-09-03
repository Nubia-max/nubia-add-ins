import React, { useState, useEffect } from 'react';

interface UpdateStatus {
  checking: boolean;
  available: boolean;
  downloading: boolean;
  downloaded: boolean;
  error: string | null;
  progress: number;
  version?: string;
  releaseNotes?: string;
  downloadedDate?: Date;
}

interface UpdateConfig {
  checkOnStartup: boolean;
  checkInterval: number;
  autoDownload: boolean;
  autoInstall: boolean;
  allowPrerelease: boolean;
  notifyUser: boolean;
}

interface UpdatePanelProps {
  theme?: 'light' | 'dark';
  onClose?: () => void;
}

export const UpdatePanel: React.FC<UpdatePanelProps> = ({
  theme = 'dark',
  onClose
}) => {
  const [status, setStatus] = useState<UpdateStatus>({
    checking: false,
    available: false,
    downloading: false,
    downloaded: false,
    error: null,
    progress: 0
  });
  
  const [config, setConfig] = useState<UpdateConfig>({
    checkOnStartup: true,
    checkInterval: 24,
    autoDownload: true,
    autoInstall: false,
    allowPrerelease: false,
    notifyUser: true
  });
  
  const [showSettings, setShowSettings] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null);

  useEffect(() => {
    // Load initial status and config
    loadUpdateStatus();
    loadUpdateConfig();

    // Listen for status changes
    const handleStatusChange = (event: any, newStatus: UpdateStatus) => {
      setStatus(newStatus);
    };

    // Set up IPC listeners (if in Electron context)
    if (window.electron) {
      window.electron.on('update-status-changed', handleStatusChange);
      
      return () => {
        window.electron.removeListener('update-status-changed', handleStatusChange);
      };
    }
  }, []);

  const loadUpdateStatus = async () => {
    try {
      if (window.electron) {
        const currentStatus = await window.electron.invoke('updater-get-status');
        setStatus(currentStatus);
      }
    } catch (error) {
      console.error('Failed to load update status:', error);
    }
  };

  const loadUpdateConfig = async () => {
    try {
      if (window.electron) {
        const currentConfig = await window.electron.invoke('updater-get-config');
        setConfig(currentConfig);
      }
    } catch (error) {
      console.error('Failed to load update config:', error);
    }
  };

  const handleCheckForUpdates = async () => {
    try {
      if (window.electron) {
        await window.electron.invoke('updater-check-for-updates');
        setLastCheckTime(new Date());
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
    }
  };

  const handleDownloadUpdate = async () => {
    try {
      if (window.electron) {
        await window.electron.invoke('updater-download-update');
      }
    } catch (error) {
      console.error('Failed to download update:', error);
    }
  };

  const handleInstallUpdate = async () => {
    try {
      if (window.electron) {
        await window.electron.invoke('updater-install-update');
      }
    } catch (error) {
      console.error('Failed to install update:', error);
    }
  };

  const handleConfigChange = async (newConfig: Partial<UpdateConfig>) => {
    const updatedConfig = { ...config, ...newConfig };
    setConfig(updatedConfig);
    
    try {
      if (window.electron) {
        await window.electron.invoke('updater-set-config', newConfig);
      }
    } catch (error) {
      console.error('Failed to update config:', error);
    }
  };

  const getStatusColor = () => {
    if (status.error) return 'text-red-500';
    if (status.downloaded) return 'text-green-500';
    if (status.available) return 'text-blue-500';
    if (status.checking || status.downloading) return 'text-yellow-500';
    return theme === 'dark' ? 'text-surface-300' : 'text-surface-700';
  };

  const getStatusIcon = () => {
    if (status.error) return '❌';
    if (status.downloaded) return '✅';
    if (status.available) return '🔄';
    if (status.checking) return '🔍';
    if (status.downloading) return '⬇️';
    return '✨';
  };

  const getStatusText = () => {
    if (status.error) return `Error: ${status.error}`;
    if (status.downloaded) return `Update ${status.version} ready to install`;
    if (status.downloading) return `Downloading ${status.version}... ${status.progress}%`;
    if (status.available) return `Update ${status.version} available`;
    if (status.checking) return 'Checking for updates...';
    return 'Up to date';
  };

  const formatReleaseNotes = (notes: string) => {
    // Simple markdown-like formatting
    return notes
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>');
  };

  return (
    <div className={`update-panel p-4 space-y-4 ${
      theme === 'dark' ? 'text-white' : 'text-surface-900'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`font-semibold text-lg ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
            App Updates
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

      {/* Update Status Card */}
      <div className={`p-4 rounded-lg border ${
        theme === 'dark' 
          ? 'bg-surface-800 border-surface-700' 
          : 'bg-surface-50 border-surface-200'
      }`}>
        {/* Progress Bar */}
        {status.downloading && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span>Downloading update...</span>
              <span>{status.progress}%</span>
            </div>
            <div className={`w-full h-2 rounded-full ${
              theme === 'dark' ? 'bg-surface-700' : 'bg-surface-200'
            }`}>
              <div 
                className="h-2 bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${status.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Version Information */}
        {status.available && (
          <div className="mb-4">
            <div className={`font-medium mb-2 ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
              Version {status.version} Available
            </div>
            
            {status.releaseNotes && (
              <div className={`text-sm p-3 rounded border ${
                theme === 'dark' 
                  ? 'bg-surface-900 border-surface-600 text-surface-300' 
                  : 'bg-white border-surface-300 text-surface-700'
              }`}>
                <div className="font-medium mb-2">Release Notes:</div>
                <div 
                  dangerouslySetInnerHTML={{ 
                    __html: formatReleaseNotes(status.releaseNotes) 
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center space-x-3">
          {!status.available && !status.checking && (
            <button
              onClick={handleCheckForUpdates}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Check for Updates
            </button>
          )}

          {status.available && !status.downloaded && !status.downloading && (
            <button
              onClick={handleDownloadUpdate}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              Download Update
            </button>
          )}

          {status.downloaded && (
            <button
              onClick={handleInstallUpdate}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              Install & Restart
            </button>
          )}

          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`px-4 py-2 rounded-lg border transition-colors ${
              theme === 'dark'
                ? 'border-surface-700 text-surface-300 hover:bg-surface-700'
                : 'border-surface-300 text-surface-700 hover:bg-surface-100'
            }`}
          >
            Settings
          </button>
        </div>

        {/* Last Check Time */}
        {lastCheckTime && (
          <div className={`text-xs mt-3 ${
            theme === 'dark' ? 'text-surface-500' : 'text-surface-500'
          }`}>
            Last checked: {lastCheckTime.toLocaleString()}
          </div>
        )}
      </div>

      {/* Update Settings */}
      {showSettings && (
        <div className={`p-4 rounded-lg border ${
          theme === 'dark' 
            ? 'bg-surface-800 border-surface-700' 
            : 'bg-surface-50 border-surface-200'
        }`}>
          <h4 className={`font-medium mb-4 ${theme === 'dark' ? 'text-white' : 'text-surface-900'}`}>
            Update Settings
          </h4>

          <div className="space-y-4">
            {/* Check on Startup */}
            <label className={`flex items-center justify-between ${
              theme === 'dark' ? 'text-white' : 'text-surface-900'
            }`}>
              <div>
                <span className="font-medium">Check on startup</span>
                <p className={`text-sm ${theme === 'dark' ? 'text-surface-400' : 'text-surface-600'}`}>
                  Automatically check for updates when the app starts
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.checkOnStartup}
                onChange={(e) => handleConfigChange({ checkOnStartup: e.target.checked })}
                className="text-primary-500 focus:ring-primary-500"
              />
            </label>

            {/* Auto Download */}
            <label className={`flex items-center justify-between ${
              theme === 'dark' ? 'text-white' : 'text-surface-900'
            }`}>
              <div>
                <span className="font-medium">Auto download updates</span>
                <p className={`text-sm ${theme === 'dark' ? 'text-surface-400' : 'text-surface-600'}`}>
                  Automatically download updates when available
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.autoDownload}
                onChange={(e) => handleConfigChange({ autoDownload: e.target.checked })}
                className="text-primary-500 focus:ring-primary-500"
              />
            </label>

            {/* Notifications */}
            <label className={`flex items-center justify-between ${
              theme === 'dark' ? 'text-white' : 'text-surface-900'
            }`}>
              <div>
                <span className="font-medium">Update notifications</span>
                <p className={`text-sm ${theme === 'dark' ? 'text-surface-400' : 'text-surface-600'}`}>
                  Show notifications when updates are available
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.notifyUser}
                onChange={(e) => handleConfigChange({ notifyUser: e.target.checked })}
                className="text-primary-500 focus:ring-primary-500"
              />
            </label>

            {/* Check Interval */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-white' : 'text-surface-900'
              }`}>
                Check interval (hours)
              </label>
              <select
                value={config.checkInterval}
                onChange={(e) => handleConfigChange({ checkInterval: parseInt(e.target.value) })}
                className={`w-full px-3 py-2 rounded border focus:ring-2 focus:ring-primary-500 ${
                  theme === 'dark'
                    ? 'bg-surface-900 border-surface-600 text-white'
                    : 'bg-white border-surface-300 text-surface-900'
                }`}
              >
                <option value={1}>Every hour</option>
                <option value={6}>Every 6 hours</option>
                <option value={12}>Every 12 hours</option>
                <option value={24}>Every 24 hours</option>
                <option value={168}>Every week</option>
              </select>
            </div>

            {/* Allow Prerelease */}
            <label className={`flex items-center justify-between ${
              theme === 'dark' ? 'text-white' : 'text-surface-900'
            }`}>
              <div>
                <span className="font-medium">Beta updates</span>
                <p className={`text-sm ${theme === 'dark' ? 'text-surface-400' : 'text-surface-600'}`}>
                  Include beta and prerelease versions
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.allowPrerelease}
                onChange={(e) => handleConfigChange({ allowPrerelease: e.target.checked })}
                className="text-primary-500 focus:ring-primary-500"
              />
            </label>
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className={`text-xs p-3 rounded border-l-4 border-blue-500 ${
        theme === 'dark' 
          ? 'bg-blue-500/10 text-blue-300' 
          : 'bg-blue-50 text-blue-700'
      }`}>
        💡 <strong>Auto Updates:</strong> Nubia checks for updates automatically to ensure you have the latest features and security improvements.
      </div>
    </div>
  );
};

export default UpdatePanel;